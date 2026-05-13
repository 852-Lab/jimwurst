from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ravioli.backend.core.database import get_db
from ravioli.backend.api.v1.endpoints.data import get_current_user
from ravioli.backend.core import models
from ravioli.backend.core.models import SystemSetting as SystemSettingModel
from ravioli.backend.core.schemas import SystemSetting as SystemSettingSchema, SystemSettingBase
from ravioli.backend.core.encryption import encrypt_value, decrypt_value
from ravioli.backend.core.ollama import OllamaClient

router = APIRouter()

@router.get("/ollama/test")
async def test_ollama_connection(db: Session = Depends(get_db)):
    """Test connection to Ollama based on current database settings."""
    try:
        client = OllamaClient(db)
        is_connected = await client.check_connection()
        if is_connected:
            return {
                "status": "success", 
                "message": "Successfully connected to Ollama!"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to connect to Ollama node.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/motherduck/test")
async def test_motherduck_connection(db: Session = Depends(get_db)):
    """Test connection to Motherduck based on current database settings."""
    try:
        from ravioli.backend.data.olap.duckdb_manager import DuckDBManager
        # We need a temporary manager or a way to test without affecting the global one
        # For testing, we can just try to connect to md: with the token
        setting = db.query(SystemSettingModel).filter(SystemSettingModel.key == "motherduck").first()
        if not setting or "token" not in setting.value or not setting.value["token"]:
             raise HTTPException(status_code=400, detail="Motherduck token not configured.")
        
        from ravioli.backend.core.encryption import decrypt_value
        token = decrypt_value(setting.value["token"])
        import duckdb
        # Attempt a temporary connection
        conn = duckdb.connect(f"md:?motherduck_token={token}")
        conn.execute("SELECT 1")
        return {
            "status": "success",
            "message": "Successfully connected to Motherduck!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Motherduck connection failed: {str(e)}")

@router.post("/motherduck/push")
async def push_all_to_motherduck(db: Session = Depends(get_db)):
    """Push all local tables to Motherduck (excluding PII)."""
    from ravioli.backend.data.olap.duckdb_manager import duckdb_manager
    from ravioli.backend.core.models import DataSource
    from sqlalchemy import select

    if not duckdb_manager.is_motherduck_connected():
        raise HTTPException(status_code=400, detail="Motherduck not connected")

    # Get all tables that are NOT PII
    stmt = select(DataSource).where(DataSource.has_pii == False)
    sources = db.execute(stmt).scalars().all()
    
    results = []
    for source in sources:
        if not source.table_name: continue
        try:
            duckdb_manager.sync_table(source.schema_name, source.table_name, direction="push")
            results.append({"table": f"{source.schema_name}.{source.table_name}", "status": "success"})
        except Exception as e:
            results.append({"table": f"{source.schema_name}.{source.table_name}", "status": "failed", "error": str(e)})
            
    return {"status": "completed", "results": results}

@router.post("/motherduck/pull")
async def pull_all_from_motherduck(db: Session = Depends(get_db)):
    """Pull all tables from Motherduck to local."""
    from ravioli.backend.data.olap.duckdb_manager import duckdb_manager
    from ravioli.backend.core.models import DataSource
    from sqlalchemy import select

    if not duckdb_manager.is_motherduck_connected():
        raise HTTPException(status_code=400, detail="Motherduck not connected")

    stmt = select(DataSource)
    sources = db.execute(stmt).scalars().all()
    
    results = []
    for source in sources:
        if not source.table_name: continue
        try:
            res = duckdb_manager.sync_table(source.schema_name, source.table_name, direction="pull")
            # Update row count
            if "total_local" in res:
                source.row_count = res["total_local"]
            results.append({"table": f"{source.schema_name}.{source.table_name}", "status": "success"})
        except Exception as e:
            results.append({"table": f"{source.schema_name}.{source.table_name}", "status": "failed", "error": str(e)})
            
    db.commit()
    return {"status": "completed", "results": results}

# Fields within a setting's value dict that should be encrypted at rest
_SENSITIVE_FIELDS = {"api_key", "token"}

_REDACTED = "••••••••"


def _encrypt_sensitive(value: dict) -> dict:
    """Return a copy of value with sensitive fields encrypted."""
    out = dict(value)
    for field in _SENSITIVE_FIELDS:
        if field in out and out[field]:
            out[field] = encrypt_value(out[field])
    return out


def _redact_sensitive(value: dict) -> dict:
    """Return a copy of value with sensitive fields replaced by a redacted placeholder."""
    out = dict(value)
    for field in _SENSITIVE_FIELDS:
        if field in out and out[field]:
            out[field] = _REDACTED
    return out


@router.get("/{key}", response_model=SystemSettingSchema)
def get_setting(
    key: str, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    setting = db.query(SystemSettingModel).filter(SystemSettingModel.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    # Return a copy with sensitive fields redacted — never expose raw ciphertext or plaintext to the frontend
    redacted_value = _redact_sensitive(setting.value)
    return SystemSettingSchema(
        key=setting.key, 
        value=redacted_value, 
        updated_at=setting.updated_at,
        owner=setting.owner,
        created_by=setting.created_by,
        updated_by=setting.updated_by
    )


@router.put("/{key}", response_model=SystemSettingSchema)
def update_setting(
    key: str, 
    setting_in: SystemSettingBase, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if key != setting_in.key:
        raise HTTPException(status_code=400, detail="Key in path does not match key in body")

    # If the frontend sends back our redacted placeholder, preserve the existing encrypted value
    existing = db.query(SystemSettingModel).filter(SystemSettingModel.key == key).first()
    incoming = dict(setting_in.value)

    for field in _SENSITIVE_FIELDS:
        if field in incoming:
            if incoming[field] == _REDACTED:
                # User did not change the sensitive field — keep the existing encrypted value
                if existing and field in existing.value:
                    incoming[field] = existing.value[field]
                else:
                    incoming[field] = ""
            elif incoming[field]:
                # New plaintext value — encrypt it
                incoming[field] = encrypt_value(incoming[field])
            # Empty string means the user cleared the field

    if existing:
        existing.value = incoming
        existing.updated_by = current_user.id
        if setting_in.owner:
            existing.owner = setting_in.owner
    else:
        existing = SystemSettingModel(
            key=key, 
            value=incoming,
            owner=setting_in.owner or current_user.id,
            created_by=current_user.id,
            updated_by=current_user.id
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)

    # If Motherduck settings changed, refresh the DuckDB connection
    if key == "motherduck":
        from ravioli.backend.data.olap.duckdb_manager import duckdb_manager
        duckdb_manager.reconnect()

    # Return redacted response
    redacted_value = _redact_sensitive(existing.value)
    return SystemSettingSchema(
        key=existing.key, 
        value=redacted_value, 
        updated_at=existing.updated_at,
        owner=existing.owner,
        created_by=existing.created_by,
        updated_by=existing.updated_by
    )
