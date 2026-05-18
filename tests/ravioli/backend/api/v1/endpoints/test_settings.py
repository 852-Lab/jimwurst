import pytest
import uuid
from datetime import datetime, UTC
from unittest.mock import MagicMock, AsyncMock
from cryptography.fernet import Fernet

# Generate a deterministic test key
_TEST_KEY = Fernet.generate_key().decode()


@pytest.fixture(autouse=True)
def patch_secret_key(mocker):
    """Override the SECRET_KEY so encryption tests are self-contained."""
    mocker.patch(
        "ravioli.backend.core.encryption.settings",
        secret_key=_TEST_KEY,
    )


# ── Encryption utility tests ─────────────────────────────────────────────────

def test_encrypt_and_decrypt_roundtrip(mocker):
    from ravioli.backend.core.encryption import encrypt_value, decrypt_value
    plaintext = "sk-super-secret-api-key"
    ciphertext = encrypt_value(plaintext)
    assert ciphertext != plaintext
    assert decrypt_value(ciphertext) == plaintext


def test_encrypt_empty_string_returns_empty(mocker):
    from ravioli.backend.core.encryption import encrypt_value
    assert encrypt_value("") == ""


def test_decrypt_empty_string_returns_empty(mocker):
    from ravioli.backend.core.encryption import decrypt_value
    assert decrypt_value("") == ""


def test_decrypt_invalid_token_returns_empty(mocker):
    from ravioli.backend.core.encryption import decrypt_value
    assert decrypt_value("not-valid-ciphertext") == ""


# ── Settings endpoint tests ───────────────────────────────────────────────────

def _make_mock_setting(key="ollama", value=None):
    s = MagicMock()
    s.key = key
    s.value = value or {"mode": "default", "base_url": "http://localhost:11434", "api_key": ""}
    s.updated_at = datetime.now(UTC)
    s.owner = None
    s.created_by = uuid.uuid4()
    s.updated_by = uuid.uuid4()
    return s


def test_get_setting_not_found(client, session):
    session.query.return_value.filter.return_value.first.return_value = None
    response = client.get("/api/v1/settings/ollama")
    assert response.status_code == 404
    assert response.json()["detail"] == "Setting not found"


def test_get_setting_returns_redacted_api_key(client, session, mocker):
    mocker.patch("ravioli.backend.core.encryption.settings", secret_key=_TEST_KEY)
    from ravioli.backend.core.encryption import encrypt_value
    encrypted = encrypt_value("my-secret-key")
    mock_setting = _make_mock_setting(value={
        "mode": "cloud", "api_key": encrypted, "default_model": "gemma3:4b"
    })
    session.query.return_value.filter.return_value.first.return_value = mock_setting

    response = client.get("/api/v1/settings/ollama")
    assert response.status_code == 200
    data = response.json()
    # api_key must be redacted, never the actual value
    assert data["value"]["api_key"] == "••••••••"


def test_get_setting_empty_api_key_not_redacted(client, session):
    mock_setting = _make_mock_setting(value={"mode": "default", "api_key": ""})
    session.query.return_value.filter.return_value.first.return_value = mock_setting
    response = client.get("/api/v1/settings/ollama")
    assert response.status_code == 200
    # Empty key should not be replaced with the redacted placeholder
    assert response.json()["value"]["api_key"] == ""


def test_put_setting_creates_new(client, session, current_user, mocker):
    mocker.patch("ravioli.backend.core.encryption.settings", secret_key=_TEST_KEY)
    session.query.return_value.filter.return_value.first.return_value = None

    def set_updated_at(obj):
        from datetime import datetime, UTC
        obj.updated_at = datetime.now(UTC)
        obj.owner = None
        obj.created_by = current_user.id
        obj.updated_by = current_user.id

    session.refresh.side_effect = set_updated_at

    response = client.put("/api/v1/settings/ollama", json={
        "key": "ollama",
        "value": {"mode": "default", "api_key": ""}
    })
    assert response.status_code == 200
    assert response.json()["created_by"] == str(current_user.id)
    assert response.json()["updated_by"] == str(current_user.id)
    session.add.assert_called_once()
    session.commit.assert_called_once()


def test_put_setting_encrypts_api_key(client, session, current_user, mocker):
    mocker.patch("ravioli.backend.core.encryption.settings", secret_key=_TEST_KEY)
    session.query.return_value.filter.return_value.first.return_value = None
    captured_value = {}

    def capture_add(obj):
        # Capture the value that will be stored
        captured_value.update(obj.value)

    def set_updated_at(obj):
        from datetime import datetime, UTC
        obj.updated_at = datetime.now(UTC)
        obj.owner = None
        obj.created_by = current_user.id
        obj.updated_by = current_user.id

    session.add.side_effect = capture_add
    session.refresh.side_effect = set_updated_at

    response = client.put("/api/v1/settings/ollama", json={
        "key": "ollama",
        "value": {"mode": "cloud", "api_key": "plaintext-secret"}
    })

    # The captured value should NOT be the plaintext
    assert captured_value.get("api_key") != "plaintext-secret"
    assert captured_value.get("api_key") != ""
    assert response.json()["created_by"] == str(current_user.id)
    assert response.json()["updated_by"] == str(current_user.id)


def test_put_setting_preserves_existing_key_when_redacted(client, session, current_user, mocker):
    mocker.patch("ravioli.backend.core.encryption.settings", secret_key=_TEST_KEY)
    from ravioli.backend.core.encryption import encrypt_value
    existing_encrypted = encrypt_value("original-key")
    existing = _make_mock_setting(value={"mode": "cloud", "api_key": existing_encrypted})
    session.query.return_value.filter.return_value.first.return_value = existing
    
    def mock_refresh(obj):
        obj.updated_at = datetime.now(UTC)
        obj.owner = None
        obj.created_by = current_user.id
        obj.updated_by = current_user.id
    session.refresh.side_effect = mock_refresh

    response = client.put("/api/v1/settings/ollama", json={
        "key": "ollama",
        "value": {"mode": "cloud", "api_key": "••••••••"}
    })
    # The existing encrypted value must not have been overwritten
    assert existing.value["api_key"] == existing_encrypted
    assert response.json()["updated_by"] == str(current_user.id)


def test_put_setting_key_mismatch_returns_400(client, session):
    response = client.put("/api/v1/settings/ollama", json={
        "key": "different_key",
        "value": {"mode": "default"}
    })
    assert response.status_code == 400

@pytest.mark.anyio
async def test_test_ollama_connection_success(client, session, mocker):
    # Mock OllamaClient and its base_url
    mock_ollama = mocker.patch("ravioli.backend.api.v1.endpoints.settings.OllamaClient")
    mock_instance = mock_ollama.return_value
    mock_instance.base_url = "http://test-ollama"
    mock_instance.mode = "default"
    mock_instance.check_connection = AsyncMock(return_value=True)
    
    # Mock httpx
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "models": [{"name": "gemma3:4b"}, {"name": "llama3"}]
    }
    
    mock_httpx = mocker.patch("httpx.AsyncClient.get", new_callable=AsyncMock)
    mock_httpx.return_value = mock_response
    
    response = client.get("/api/v1/settings/ollama/test")
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "Successfully connected" in response.json()["message"]

def test_push_all_to_motherduck_success(client, session, mocker):
    from ravioli.backend.core.models import DataSource

    # Mock duckdb_manager
    mock_duckdb = mocker.patch("ravioli.backend.data.olap.duckdb_manager.duckdb_manager")
    mock_duckdb.is_motherduck_connected.return_value = True
    mock_duckdb._get_remote_db_name.return_value = "ravioli"
    mock_duckdb.push_all_non_pii = MagicMock()
    
    # Mock table existence check in local DuckDB (execute returns True for existence check)
    mock_duckdb.connection.execute.return_value.fetchone.return_value = (1,)

    # Mock DataSource query results
    mock_source = DataSource(
        id=uuid.uuid4(),
        filename="test.csv",
        original_filename="test.csv",
        content_type="text/csv",
        size_bytes=100,
        table_name="test_table",
        schema_name="s_manual",
        status="completed",
        source_type="file",
        has_pii=False,
        owner_type="user",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        created_by=None,
        updated_by=None,
        owner=None,
        owner_id=None
    )
    
    mock_result = MagicMock()
    session.execute.return_value = mock_result
    mock_result.scalars.return_value.all.return_value = [mock_source]

    response = client.post("/api/v1/settings/motherduck/push")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert len(data["results"]) == 1
    assert data["results"][0]["table"] == "s_manual.test_table"
    assert data["results"][0]["status"] == "success"
    
    # Verify push_all_non_pii was called with correct parameters
    mock_duckdb.push_all_non_pii.assert_called_once_with([("s_manual", "test_table")])

def test_debug_motherduck_not_connected(client, session, mocker):
    # Mock duckdb_manager as disconnected
    mock_duckdb = mocker.patch("ravioli.backend.api.v1.endpoints.settings.duckdb_manager")
    mock_duckdb.is_motherduck_connected.return_value = False
    
    response = client.get("/api/v1/settings/md-debug")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "error"
    assert "not connected" in data["message"]

def test_debug_motherduck_success(client, session, mocker):
    # Mock duckdb_manager as connected
    mock_duckdb = mocker.patch("ravioli.backend.api.v1.endpoints.settings.duckdb_manager")
    mock_duckdb.is_motherduck_connected.return_value = True
    
    # Mock queries to identity, databases, schemas, tables
    mock_conn = MagicMock()
    mock_duckdb.connection = mock_conn
    
    # Set up return values for sequential connection execute calls
    mock_identity = MagicMock()
    mock_identity.fetchone.return_value = ("davnnis", "ravioli", ["main"])
    
    mock_databases = MagicMock()
    mock_databases.fetchall.return_value = [("ravioli", "N/A")]
    
    mock_schemas = MagicMock()
    mock_schemas.fetchall.return_value = [("s_manual",)]
    
    mock_tables = MagicMock()
    mock_tables.fetchall.return_value = [("s_manual", "content_table")]
    
    mock_conn.execute.side_effect = [
        mock_identity,    # 1. SELECT current_user()...
        mock_databases,   # 2. PRAGMA show_databases
        mock_schemas,     # 3. SELECT schema_name FROM duckdb_schemas()
        mock_tables       # 4. SELECT schema_name, table_name FROM duckdb_tables()
    ]
    
    response = client.get("/api/v1/settings/md-debug")
    
    assert response.status_code == 200
    data = response.json()
    assert data["identity"]["user"] == "davnnis"
    assert data["identity"]["database"] == "ravioli"
    assert data["databases"][0]["name"] == "ravioli"
    assert data["ravioli_schemas"] == ["s_manual"]
    assert data["ravioli_tables"][0]["table"] == "content_table"


def test_pull_all_from_motherduck_success(client, session, current_user, mocker):
    from ravioli.backend.core.models import DataSource

    # Mock duckdb_manager
    mock_duckdb = mocker.patch("ravioli.backend.data.olap.duckdb_manager.duckdb_manager")
    mock_duckdb.is_motherduck_connected.return_value = True
    mock_duckdb.sync_table.return_value = {"total_local": 42}
    
    # Mock DataSource query results
    mock_source = DataSource(
        id=uuid.uuid4(),
        filename="test.csv",
        original_filename="test.csv",
        content_type="text/csv",
        size_bytes=100,
        table_name="test_table",
        schema_name="s_manual",
        status="completed",
        source_type="file",
        has_pii=False,
        owner_type="user",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        created_by=None,
        updated_by=None,
        owner=None,
        owner_id=None
    )
    
    mock_result = MagicMock()
    session.execute.return_value = mock_result
    mock_result.scalars.return_value.all.return_value = [mock_source]

    response = client.post("/api/v1/settings/motherduck/pull")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert len(data["results"]) == 1
    assert data["results"][0]["table"] == "s_manual.test_table"
    assert data["results"][0]["status"] == "success"
    
    # Verify sync_table was called
    mock_duckdb.sync_table.assert_called_once_with("s_manual", "test_table", direction="pull")
    # Verify audit field was updated
    assert mock_source.row_count == 42
    assert mock_source.updated_by == current_user.id
