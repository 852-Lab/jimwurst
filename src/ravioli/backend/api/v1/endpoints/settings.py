import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ravioli.backend.core.database import get_db
from ravioli.backend.api.v1.endpoints.data import get_current_user
from ravioli.backend.core import models
from ravioli.backend.core.models import SystemSetting as SystemSettingModel
from ravioli.backend.core.schemas import SystemSetting as SystemSettingSchema, SystemSettingBase
from ravioli.backend.core.encryption import encrypt_value
from ravioli.backend.core.ollama import OllamaClient
from ravioli.backend.data.olap.duckdb_manager import duckdb_manager

logger = logging.getLogger(__name__)

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
        setting = db.query(SystemSettingModel).filter(SystemSettingModel.key == "motherduck").first()
        if not setting or "token" not in setting.value or not setting.value["token"]:
             raise HTTPException(status_code=400, detail="Motherduck token not configured.")
        
        from ravioli.backend.core.encryption import decrypt_value
        token = decrypt_value(setting.value["token"])
        import duckdb
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

    remote_db = duckdb_manager._get_remote_db_name()
    logger.info(f"=== STARTING PUSH ALL TO MOTHERDUCK (Target DB: {remote_db}) ===")

    stmt = select(DataSource).where(DataSource.has_pii == False)
    sources = db.execute(stmt).scalars().all()
    
    tables_to_push = []
    for source in sources:
        if source.schema_name and source.table_name:
            tables_to_push.append((source.schema_name, source.table_name))
            
    results = []
    if tables_to_push:
        try:
            # Trigger our optimized bulk block-level database copy push
            duckdb_manager.push_all_non_pii(tables_to_push)
            
            # Verify which tables were copied
            for schema, table in tables_to_push:
                try:
                    exists = (duckdb_manager.execute_fetchone(
                        f"SELECT count(*) FROM information_schema.tables "
                        f"WHERE table_schema='{schema}' AND table_name='{table}'"
                    ) or (0,))[0] > 0
                except Exception:
                    exists = False
                
                if exists:
                    results.append({"table": f"{schema}.{table}", "status": "success"})
                else:
                    results.append({"table": f"{schema}.{table}", "status": "skipped", "error": "Table does not exist locally"})
        except Exception as e:
            logger.error(f"Failed to push tables in bulk: {e}")
            raise HTTPException(status_code=500, detail=f"Bulk push to Motherduck failed: {str(e)}")
            
    logger.info(f"=== PUSH ALL COMPLETED ({len(results)} tables processed) ===")
    return {"status": "completed", "results": results}

@router.post("/motherduck/pull")
async def pull_all_from_motherduck(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
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
            if "total_local" in res:
                source.row_count = res["total_local"]
                source.updated_by = current_user.id
            results.append({"table": f"{source.schema_name}.{source.table_name}", "status": "success"})
        except Exception:
            logger.exception(f"Failed to pull {source.schema_name}.{source.table_name} from Motherduck")
            results.append({"table": f"{source.schema_name}.{source.table_name}", "status": "failed", "error": "Internal error while syncing table"})
            
    db.commit()
    return {"status": "completed", "results": results}

_SENSITIVE_FIELDS = {"api_key", "token"}
_REDACTED = "••••••••"

def _encrypt_sensitive(value: dict) -> dict:
    out = dict(value)
    for field in _SENSITIVE_FIELDS:
        if field in out and out[field]:
            out[field] = encrypt_value(out[field])
    return out

def _redact_sensitive(value: dict) -> dict:
    out = dict(value)
    for field in _SENSITIVE_FIELDS:
        if field in out and out[field]:
            out[field] = _REDACTED
    return out

@router.get("/md-debug")
async def debug_motherduck(db: Session = Depends(get_db)):
    """Deep debug for Motherduck connection and state."""
    if not duckdb_manager.is_motherduck_connected():
        return {"status": "error", "message": "Motherduck not connected"}
    
    try:
        conn = duckdb_manager.connection
        identity = conn.execute("SELECT current_user(), current_database(), current_schemas(true)").fetchone()
        databases = conn.execute("PRAGMA show_databases").fetchall()
        
        # Look specifically at 'ravioli' database
        try:
            schemas = conn.execute("SELECT schema_name FROM duckdb_schemas() WHERE database_name = 'ravioli'").fetchall()
            tables = conn.execute("SELECT schema_name, table_name FROM duckdb_tables() WHERE database_name = 'ravioli'").fetchall()
        except Exception:
            logger.error("Error querying ravioli schemas/tables", exc_info=True)
            schemas = [("Query failed",)]
            tables = []

        return {
            "identity": {
                "user": identity[0],
                "database": identity[1],
                "schemas": identity[2]
            },
            "databases": [{"name": r[0], "path": r[1] if len(r)>1 else "N/A"} for r in databases],
            "ravioli_schemas": [s[0] for s in schemas],
            "ravioli_tables": [{"schema": t[0], "table": t[1]} for t in tables]
        }
    except Exception:
        logger.error("Unexpected error during Motherduck debug", exc_info=True)
        return {"status": "error", "message": "An internal error occurred"}

@router.get("/{key}", response_model=SystemSettingSchema)
def get_setting(key: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    setting = db.query(SystemSettingModel).filter(SystemSettingModel.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
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
def update_setting(key: str, setting_in: SystemSettingBase, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if key != setting_in.key:
        raise HTTPException(status_code=400, detail="Key in path does not match key in body")

    existing = db.query(SystemSettingModel).filter(SystemSettingModel.key == key).first()
    incoming = dict(setting_in.value)

    for field in _SENSITIVE_FIELDS:
        if field in incoming:
            if incoming[field] == _REDACTED:
                if existing and field in existing.value:
                    incoming[field] = existing.value[field]
                else:
                    incoming[field] = ""
            elif incoming[field]:
                incoming[field] = encrypt_value(incoming[field])

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

    if key == "motherduck":
        from ravioli.backend.data.olap.duckdb_manager import duckdb_manager
        duckdb_manager.reconnect()

    redacted_value = _redact_sensitive(existing.value)
    return SystemSettingSchema(
        key=existing.key, 
        value=redacted_value, 
        updated_at=existing.updated_at,
        owner=existing.owner,
        created_by=existing.created_by,
        updated_by=existing.updated_by
    )
