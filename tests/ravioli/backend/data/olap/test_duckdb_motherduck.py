import pytest
from unittest.mock import MagicMock, patch
from ravioli.backend.data.olap.duckdb_manager import DuckDBManager
from ravioli.backend.core.models import SystemSetting

@pytest.fixture
def mock_db_session():
    with patch("ravioli.backend.data.olap.duckdb_manager.SessionLocal") as mock:
        session = MagicMock()
        mock.return_value = session
        yield session

@pytest.fixture
def mock_duckdb():
    with patch("ravioli.backend.data.olap.duckdb_manager.duckdb.connect") as mock:
        conn = MagicMock()
        mock.return_value = conn
        yield mock

@pytest.fixture
def mock_decrypt():
    with patch("ravioli.backend.core.encryption.decrypt_value", side_effect=lambda x: x) as mock:
        yield mock

def test_duckdb_manager_attaches_motherduck(mock_db_session, mock_duckdb, mock_decrypt):
    # Setup mock setting
    mock_setting = SystemSetting(key="motherduck", value={"token": "test-token"})
    mock_db_session.query.return_value.filter.return_value.first.return_value = mock_setting
    
    # Mock current_setting check to return empty so token is set
    mock_duckdb.return_value.execute.return_value.fetchone.return_value = [""]
    
    # Initialize manager (reset singleton for test)
    with patch.object(DuckDBManager, '_instance', None):
        manager = DuckDBManager()
        _ = manager.connection
        
        # Verify duckdb calls
        # Note: self._connection.execute is called several times
        execute_calls = [call[0][0] for call in mock_duckdb.return_value.execute.call_args_list]
        assert any("INSTALL motherduck" in cmd for cmd in execute_calls)
        assert any("SET motherduck_token='test-token'" in cmd for cmd in execute_calls)
        assert any("ATTACH 'md:ravioli' AS ravioli" in cmd for cmd in execute_calls)

def test_duckdb_manager_no_motherduck_if_no_token(mock_db_session, mock_duckdb, mock_decrypt):
    # Setup mock setting with no token
    mock_db_session.query.return_value.filter.return_value.first.return_value = None
    
    with patch.object(DuckDBManager, '_instance', None):
        manager = DuckDBManager()
        _ = manager.connection
        
        # Verify no motherduck calls
        execute_calls = [call[0][0] for call in mock_duckdb.return_value.execute.call_args_list]
        assert not any("ATTACH 'md:'" in cmd for cmd in execute_calls)

def test_duckdb_manager_reconnect(mock_db_session, mock_duckdb, mock_decrypt):
    # Setup mock setting
    mock_db_session.query.return_value.filter.return_value.first.return_value = None
    
    with patch.object(DuckDBManager, '_instance', None):
        manager = DuckDBManager()
        _ = manager.connection
        manager.reconnect()
        _ = manager.connection
        
        # mock_duckdb is the connect mock, so it should be called twice
        assert mock_duckdb.called
        assert mock_duckdb.call_count == 2

def test_push_all_non_pii(mock_duckdb):
    with patch.object(DuckDBManager, '_instance', None):
        manager = DuckDBManager()
        # Mock connection property to avoid attachment logic
        manager._connection = mock_duckdb.return_value
        
        # Mock is_motherduck_connected to return True
        with patch.object(manager, 'is_motherduck_connected', return_value=True):
            # Mock _get_remote_db_name to return 'ravioli'
            with patch.object(manager, '_get_remote_db_name', return_value='ravioli'):
                # Mock table existence checks: table1 exists, table2 does not
                mock_duckdb.return_value.execute.return_value.fetchone.side_effect = [
                    (1,), # table1 exists check
                    (0,), # table2 exists check
                ]
                
                # Mock uuid.uuid4().hex to return 'mockeduuid'
                mock_uuid = MagicMock()
                mock_uuid.hex = "mockeduuid"
                with patch("uuid.uuid4", return_value=mock_uuid):
                    # Mock os.path.exists and os.remove
                    with patch("os.path.exists", return_value=True), patch("os.remove") as mock_remove:
                        import os
                        from ravioli.backend.core.config import settings
                        temp_dir = os.path.dirname(settings.duckdb_path)
                        expected_path = os.path.join(temp_dir, "temp_mockeduuid.duckdb")

                        tables = [("s_manual", "table1"), ("s_manual", "table2")]
                        manager.push_all_non_pii(tables)
                        
                        # Verify temporary file cleanup was triggered
                        mock_remove.assert_called_once_with(expected_path)
                        
                        # Verify executed queries
                        execute_calls = [call[0][0] for call in mock_duckdb.return_value.execute.call_args_list]
                        
                        # Verify we attached the temp db
                        assert any(f"ATTACH '{expected_path}' AS temp_clean_db" in cmd for cmd in execute_calls)
                        # Verify we checked existence of both tables
                        assert any("WHERE table_schema='s_manual' AND table_name='table1'" in cmd for cmd in execute_calls)
                        assert any("WHERE table_schema='s_manual' AND table_name='table2'" in cmd for cmd in execute_calls)
                        # Verify table1 was copied, but table2 was skipped
                        assert any("CREATE TABLE temp_clean_db.\"s_manual\".\"table1\"" in cmd for cmd in execute_calls)
                        assert not any("CREATE TABLE temp_clean_db.\"s_manual\".\"table2\"" in cmd for cmd in execute_calls)
                        # Verify detach and block push
                        assert any("DETACH temp_clean_db" in cmd for cmd in execute_calls)
                        assert any(f"CREATE OR REPLACE DATABASE \"ravioli\" FROM '{expected_path}'" in cmd for cmd in execute_calls)
