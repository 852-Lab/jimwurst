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
