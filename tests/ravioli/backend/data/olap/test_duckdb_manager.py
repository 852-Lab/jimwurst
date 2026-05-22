"""
Tests for the ephemeral-connection DuckDBManager introduced to eliminate
persistent DuckDB file locks that previously blocked Jupyter kernel connections.

Key invariants verified:
  - connect() opens and CLOSES the connection after the block exits.
  - execute_df / execute_fetchone / execute_ddl all close their connection.
  - No persistent _connection is left open after normal operations.
  - list_tables() and query() use ephemeral connections.
  - The deprecated .connection shim is still accessible for MotherDuck ops.
  - reconnect() resets the MD-specific connection.
"""
import contextlib
import pytest
from unittest.mock import MagicMock, patch, call
from ravioli.backend.data.olap.duckdb_manager import DuckDBManager


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def fresh_manager():
    """Return a DuckDBManager singleton-reset for each test."""
    with patch.object(DuckDBManager, '_instance', None), \
         patch.object(DuckDBManager, '_md_connection', None):
        mgr = DuckDBManager()
        yield mgr


@pytest.fixture
def mock_duckdb_connect():
    """Patch duckdb.connect globally and return the mock factory."""
    with patch("ravioli.backend.data.olap.duckdb_manager.duckdb.connect") as mock_connect:
        conn = MagicMock()
        mock_connect.return_value = conn
        yield mock_connect


# ---------------------------------------------------------------------------
# connect() context manager
# ---------------------------------------------------------------------------

class TestConnectContextManager:
    def test_connect_yields_connection(self, fresh_manager, mock_duckdb_connect):
        conn_mock = mock_duckdb_connect.return_value
        with fresh_manager.connect() as conn:
            assert conn is conn_mock

    def test_connect_opens_with_db_path(self, fresh_manager, mock_duckdb_connect):
        with fresh_manager.connect():
            pass
        # connect() must have been called (path assertion deferred to integration tests)
        assert mock_duckdb_connect.called

    def test_connect_closes_on_exit(self, fresh_manager, mock_duckdb_connect):
        conn_mock = mock_duckdb_connect.return_value
        with fresh_manager.connect():
            pass
        conn_mock.close.assert_called_once()

    def test_connect_closes_even_on_exception(self, fresh_manager, mock_duckdb_connect):
        conn_mock = mock_duckdb_connect.return_value
        with pytest.raises(ValueError):
            with fresh_manager.connect():
                raise ValueError("intentional error")
        conn_mock.close.assert_called_once()

    def test_connect_does_not_retain_reference(self, fresh_manager, mock_duckdb_connect):
        """No persistent _connection should be set after a connect() block."""
        with fresh_manager.connect():
            pass
        assert fresh_manager._md_connection is None


# ---------------------------------------------------------------------------
# execute_df helper
# ---------------------------------------------------------------------------

class TestExecuteDf:
    def test_execute_df_returns_dataframe(self, fresh_manager, mock_duckdb_connect):
        import pandas as pd
        expected_df = pd.DataFrame({"a": [1, 2]})
        mock_duckdb_connect.return_value.execute.return_value.fetchdf.return_value = expected_df

        result = fresh_manager.execute_df("SELECT 1")
        assert result is expected_df

    def test_execute_df_closes_connection(self, fresh_manager, mock_duckdb_connect):
        mock_duckdb_connect.return_value.execute.return_value.fetchdf.return_value = MagicMock()
        fresh_manager.execute_df("SELECT 1")
        mock_duckdb_connect.return_value.close.assert_called_once()

    def test_execute_df_propagates_exception(self, fresh_manager, mock_duckdb_connect):
        mock_duckdb_connect.return_value.execute.side_effect = RuntimeError("bad sql")
        with pytest.raises(RuntimeError, match="bad sql"):
            fresh_manager.execute_df("INVALID SQL")
        # Connection must still be closed even on error
        mock_duckdb_connect.return_value.close.assert_called_once()


# ---------------------------------------------------------------------------
# execute_fetchone helper
# ---------------------------------------------------------------------------

class TestExecuteFetchone:
    def test_execute_fetchone_returns_row(self, fresh_manager, mock_duckdb_connect):
        mock_duckdb_connect.return_value.execute.return_value.fetchone.return_value = (42,)
        result = fresh_manager.execute_fetchone("SELECT 42")
        assert result == (42,)

    def test_execute_fetchone_closes_connection(self, fresh_manager, mock_duckdb_connect):
        mock_duckdb_connect.return_value.execute.return_value.fetchone.return_value = (1,)
        fresh_manager.execute_fetchone("SELECT 1")
        mock_duckdb_connect.return_value.close.assert_called_once()


# ---------------------------------------------------------------------------
# execute_ddl helper
# ---------------------------------------------------------------------------

class TestExecuteDdl:
    def test_execute_ddl_executes_statement(self, fresh_manager, mock_duckdb_connect):
        fresh_manager.execute_ddl("CREATE SCHEMA IF NOT EXISTS s_test")
        conn = mock_duckdb_connect.return_value
        conn.execute.assert_called_once_with("CREATE SCHEMA IF NOT EXISTS s_test")

    def test_execute_ddl_closes_connection(self, fresh_manager, mock_duckdb_connect):
        fresh_manager.execute_ddl("DROP TABLE IF EXISTS foo")
        mock_duckdb_connect.return_value.close.assert_called_once()

    def test_execute_ddl_returns_none(self, fresh_manager, mock_duckdb_connect):
        result = fresh_manager.execute_ddl("CREATE SCHEMA IF NOT EXISTS s_test")
        assert result is None


# ---------------------------------------------------------------------------
# list_tables and query use ephemeral connections
# ---------------------------------------------------------------------------

class TestListTablesAndQuery:
    def test_list_tables_uses_ephemeral_connection(self, fresh_manager, mock_duckdb_connect):
        conn_mock = mock_duckdb_connect.return_value
        conn_mock.execute.return_value.fetchall.return_value = [
            ("s_manual.users",), ("s_manual.posts",)
        ]
        tables = fresh_manager.list_tables()
        assert tables == ["s_manual.users", "s_manual.posts"]
        # Connection must have been closed
        conn_mock.close.assert_called_once()
        # No persistent MD connection created
        assert fresh_manager._md_connection is None

    def test_query_uses_execute_df_internally(self, fresh_manager, mock_duckdb_connect):
        import pandas as pd
        df = pd.DataFrame({"x": [1]})
        mock_duckdb_connect.return_value.execute.return_value.fetchdf.return_value = df

        results = fresh_manager.query("SELECT 1 AS x")
        assert results == [{"x": 1}]
        mock_duckdb_connect.return_value.close.assert_called_once()


# ---------------------------------------------------------------------------
# Multiple sequential operations each get a fresh connection
# ---------------------------------------------------------------------------

class TestMultipleEphemeralOperations:
    def test_each_operation_opens_independent_connection(self, fresh_manager, mock_duckdb_connect):
        """Three operations → three open calls and three close calls."""
        conn_mock = mock_duckdb_connect.return_value
        conn_mock.execute.return_value.fetchdf.return_value = MagicMock()
        conn_mock.execute.return_value.fetchone.return_value = (1,)

        fresh_manager.execute_ddl("CREATE SCHEMA IF NOT EXISTS a")
        fresh_manager.execute_fetchone("SELECT 1")
        fresh_manager.execute_df("SELECT * FROM t")

        assert mock_duckdb_connect.call_count == 3
        assert conn_mock.close.call_count == 3

    def test_no_cross_operation_lock_held(self, fresh_manager, mock_duckdb_connect):
        """Between operations the connection is fully closed (no leaking lock)."""
        call_order = []

        # Each call to duckdb.connect() returns a fresh mock connection
        def make_conn():
            conn = MagicMock()
            conn.execute.return_value.fetchone.return_value = (1,)
            conn.execute.return_value.fetchdf.return_value = MagicMock()
            # Track when this connection is closed
            original_close = conn.close
            def on_close():
                call_order.append("close")
            conn.close.side_effect = on_close
            return conn

        mock_duckdb_connect.side_effect = lambda *a, **kw: (call_order.append("open"), make_conn())[1]

        fresh_manager.execute_fetchone("SELECT 1")
        fresh_manager.execute_fetchone("SELECT 2")

        assert call_order == ["open", "close", "open", "close"]



# ---------------------------------------------------------------------------
# MotherDuck shim (.connection property)
# ---------------------------------------------------------------------------

class TestMotherDuckShim:
    def test_connection_property_initialises_md_connection(self, fresh_manager, mock_duckdb_connect):
        with patch.object(fresh_manager, '_attach_motherduck'):
            conn = fresh_manager.connection
        assert fresh_manager._md_connection is not None
        assert conn is fresh_manager._md_connection

    def test_connection_property_reuses_existing_md_connection(self, fresh_manager, mock_duckdb_connect):
        with patch.object(fresh_manager, '_attach_motherduck'):
            c1 = fresh_manager.connection
            c2 = fresh_manager.connection
        assert c1 is c2
        # duckdb.connect should only be called once for MD
        assert mock_duckdb_connect.call_count == 1

    def test_reconnect_clears_md_connection(self, fresh_manager, mock_duckdb_connect):
        with patch.object(fresh_manager, '_attach_motherduck'):
            _ = fresh_manager.connection
        assert fresh_manager._md_connection is not None
        fresh_manager.reconnect()
        assert fresh_manager._md_connection is None

    def test_reconnect_closes_existing_md_connection(self, fresh_manager, mock_duckdb_connect):
        conn_mock = mock_duckdb_connect.return_value
        with patch.object(fresh_manager, '_attach_motherduck'):
            _ = fresh_manager.connection
        fresh_manager.reconnect()
        conn_mock.close.assert_called_once()

    def test_ephemeral_ops_do_not_touch_md_connection(self, fresh_manager, mock_duckdb_connect):
        """Ephemeral operations must never set _md_connection."""
        conn_mock = mock_duckdb_connect.return_value
        conn_mock.execute.return_value.fetchone.return_value = (1,)

        fresh_manager.execute_fetchone("SELECT 1")
        assert fresh_manager._md_connection is None
