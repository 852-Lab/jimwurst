import uvicorn
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uuid
from sqlalchemy import text
from ravioli.backend.core import models
from ravioli.backend.core.database import engine, Base, SessionLocal
from ravioli.backend.data.oltp.session import ensure_schema
from ravioli.backend.api.v1.api import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create tables in the specified schemas
# Note: schemas must exist before create_all is called for tables in those schemas
def init_db():
    try:
        # Ensure 'app' schema exists
        ensure_schema("app")
        # Create all tables (new tables only; existing tables are not modified)
        Base.metadata.create_all(bind=engine)
        # Idempotent column migrations for tables that already exist
        _migrate_columns()
        # Seed initial data
        seed_db()
        print("Database tables initialized successfully.")
    except Exception as e:
        print(f"Error initializing database: {e}")

def seed_db():
    """Create initial dummy records if they don't exist."""
    db = SessionLocal()
    try:
        email = "jimmypang@aipassione.com"
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(
                id=uuid.uuid4(),
                name="Jimmy Pang",
                email=email,
                role="Admin",
                hashed_password="password123", # Simple default
                status="active"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Seeded dummy user: {user.name} with Admin role")
        else:
            # Ensure existing user has Admin role and status
            if user.role != "Admin":
                user.role = "Admin"
                user.status = "active"
                user.hashed_password = "password123"
                db.commit()
                print(f"Updated user {user.name} to Admin role")
        
        # Backfill: Populate owner_id for all existing data sources that are NULL
        updated_count = db.query(models.DataSource).filter(models.DataSource.owner_id.is_(None)).update({models.DataSource.owner_id: user.id})
        if updated_count > 0:
            db.commit()
            print(f"Backfilled {updated_count} data sources with owner_id: {user.name}")
            
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

def _migrate_columns():
    """Add new columns to existing tables using IF NOT EXISTS (idempotent)."""
    migrations = [
        # Re-point owner FK to users (drop stale FK constraint if it exists)
        "ALTER TABLE app.insights DROP CONSTRAINT IF EXISTS insights_owner_fkey",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS owner UUID REFERENCES app.users(id)",
        # Drop legacy polymorphic columns
        "ALTER TABLE app.insights DROP COLUMN IF EXISTS owner_id",
        "ALTER TABLE app.insights DROP COLUMN IF EXISTS owner_type",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS assumptions TEXT",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS limitations TEXT",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS insight_metadata JSONB",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",
        # Backfill owner from created_by for rows where owner is NULL
        "UPDATE app.insights SET owner = created_by WHERE owner IS NULL AND created_by IS NOT NULL",

        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS icon JSONB",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS cover JSONB",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS properties JSONB",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES app.knowledge_pages(id)",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS owner UUID REFERENCES app.user_groups(id)",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS owner_id TEXT",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user'",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",

        "ALTER TABLE app.data_sources ADD COLUMN IF NOT EXISTS owner_id UUID",
        "ALTER TABLE app.data_sources ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user'",
        "ALTER TABLE app.data_sources ADD COLUMN IF NOT EXISTS owner UUID REFERENCES app.user_groups(id)",
        "ALTER TABLE app.data_sources ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.data_sources ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",

        # Re-point owner FK to users (drop stale FK constraint if it exists, then add/keep column)
        "ALTER TABLE app.analyses DROP CONSTRAINT IF EXISTS analyses_owner_fkey",
        "ALTER TABLE app.analyses ADD COLUMN IF NOT EXISTS owner UUID REFERENCES app.users(id)",
        # Drop legacy polymorphic columns
        "ALTER TABLE app.analyses DROP COLUMN IF EXISTS owner_id",
        "ALTER TABLE app.analyses DROP COLUMN IF EXISTS owner_type",
        "ALTER TABLE app.analyses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.analyses ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",
        # Backfill owner from created_by for rows where owner is NULL
        "UPDATE app.analyses SET owner = created_by WHERE owner IS NULL AND created_by IS NOT NULL",

        "ALTER TABLE app.user_groups ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES app.users(id)",
        "ALTER TABLE app.user_groups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.user_groups ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.user_groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE app.user_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
        # Rename owner_id -> owner and backfill from created_by
        "ALTER TABLE app.user_groups ADD COLUMN IF NOT EXISTS owner UUID REFERENCES app.users(id)",
        "UPDATE app.user_groups SET owner = owner_id WHERE owner IS NULL AND owner_id IS NOT NULL",
        "UPDATE app.user_groups SET owner = created_by WHERE owner IS NULL AND created_by IS NOT NULL",
        "ALTER TABLE app.user_groups DROP COLUMN IF EXISTS owner_id",

        "ALTER TABLE app.system_settings ADD COLUMN IF NOT EXISTS owner UUID REFERENCES app.user_groups(id)",
        "ALTER TABLE app.system_settings ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.system_settings ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",

        "ALTER TABLE app.users ADD COLUMN IF NOT EXISTS hashed_password TEXT",
        "ALTER TABLE app.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Viewer'",
        "ALTER TABLE app.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'",
        "ALTER TABLE app.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE app.users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.users ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",
        # Safe type migration for content: wraps existing text in a paragraph block
        "ALTER TABLE app.knowledge_pages ALTER COLUMN content TYPE JSONB USING CASE WHEN content IS NULL THEN '[]'::JSONB WHEN content::text ~ '^[\\[\\{]' THEN content::JSONB ELSE jsonb_build_array(jsonb_build_object('type', 'paragraph', 'paragraph', jsonb_build_object('rich_text', jsonb_build_array(jsonb_build_object('type', 'text', 'text', jsonb_build_object('content', content)))))) END",
    ]
    with engine.begin() as conn:
        for stmt in migrations:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                print(f"Migration warning (non-fatal): {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    yield
    # Shutdown (if needed)

app = FastAPI(
    title="Ravioli API",
    description="Backend API for Ravioli AI Data Warehouse",
    version="0.1.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Welcome to Ravioli API", "status": "online"}

# Include v1 routers
app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("ravioli.backend.main:app", host="0.0.0.0", port=8000, reload=True)
# trivial change
