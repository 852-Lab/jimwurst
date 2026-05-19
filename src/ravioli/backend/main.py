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
            
        # Seed lineage dummy data if no data sources exist
        if db.query(models.DataSource).count() == 0:
            ds_id = uuid.uuid4()
            ds = models.DataSource(
                id=ds_id,
                filename="spotify_streams_2026.csv",
                original_filename="spotify_streams_2026.csv",
                content_type="text/csv",
                size_bytes=1024 * 45,
                table_name="spotify_streams",
                schema_name="main",
                row_count=12450,
                status="completed",
                owner_id=user.id,
                owner_type="user",
                created_by=user.id,
                updated_by=user.id
            )
            db.add(ds)
            
            ana_id = uuid.uuid4()
            ana = models.Analysis(
                id=ana_id,
                title="Quick Insight: spotify_streams_2026.csv",
                description="Seeded data lineage template analysis.",
                status="completed",
                result="Analyzed Spotify streaming patterns for Q1 2026.",
                analysis_metadata={"file_id": str(ds_id)},
                owner_id=user.id,
                owner_type="user",
                created_by=user.id,
                updated_by=user.id
            )
            db.add(ana)
            
            ins1_id = uuid.uuid4()
            ins1 = models.Insight(
                id=ins1_id,
                analysis_id=ana_id,
                content="Peak streaming activity is concentrated on Friday evenings between 7 PM and 10 PM.",
                source_label="Quick Insight: spotify_streams_2026.csv",
                is_verified=True,
                is_published=True,
                owner_id=user.id,
                owner_type="user",
                created_by=user.id,
                updated_by=user.id
            )
            
            ins2_id = uuid.uuid4()
            ins2 = models.Insight(
                id=ins2_id,
                analysis_id=ana_id,
                content="User retention is 85% higher for curated playlists compared to algorithmic radio.",
                source_label="Quick Insight: spotify_streams_2026.csv",
                is_verified=True,
                is_published=True,
                owner_id=user.id,
                owner_type="user",
                created_by=user.id,
                updated_by=user.id
            )
            
            ins3_id = uuid.uuid4()
            ins3 = models.Insight(
                id=ins3_id,
                analysis_id=ana_id,
                content="Friday promotional campaigns should target curated playlist listeners to maximize conversion.",
                source_label="Quick Insight: spotify_streams_2026.csv",
                is_verified=True,
                is_published=True,
                owner_id=user.id,
                owner_type="user",
                created_by=user.id,
                updated_by=user.id
            )
            
            ins4_id = uuid.uuid4()
            ins4 = models.Insight(
                id=ins4_id,
                analysis_id=ana_id,
                content="Server capacity needs to scale by 2x on Friday evening streams to handle traffic spike.",
                source_label="Quick Insight: spotify_streams_2026.csv",
                is_verified=True,
                is_published=True,
                owner_id=user.id,
                owner_type="user",
                created_by=user.id,
                updated_by=user.id
            )
            
            db.add_all([ins1, ins2, ins3, ins4])
            db.commit()
            
            # Add relationships / derived links (M:M secondary table)
            link1 = models.InsightLink(parent_id=ins1_id, child_id=ins3_id)
            link2 = models.InsightLink(parent_id=ins2_id, child_id=ins3_id)
            link3 = models.InsightLink(parent_id=ins1_id, child_id=ins4_id)
            db.add_all([link1, link2, link3])
            
            kp_id = uuid.uuid4()
            kp = models.KnowledgePage(
                id=kp_id,
                title="Q1 Spotify Marketing Strategy",
                source="insight",
                source_id=str(ins3_id),
                owner_id=str(user.id),
                owner_type="user",
                created_by=user.id,
                updated_by=user.id,
                reviewed_by=user.id
            )
            db.add(kp)
            db.commit()
            print("Seeded lineage dummy data structure successfully.")
            
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

def _migrate_columns():
    """Add new columns to existing tables using IF NOT EXISTS (idempotent)."""
    migrations = [
        "CREATE TABLE IF NOT EXISTS app.insight_links (parent_id UUID REFERENCES app.insights(id) ON DELETE CASCADE, child_id UUID REFERENCES app.insights(id) ON DELETE CASCADE, PRIMARY KEY (parent_id, child_id))",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS assumptions TEXT",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS limitations TEXT",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS insight_metadata JSONB",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS owner UUID REFERENCES app.user_groups(id)",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS owner_id UUID",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user'",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.insights ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES app.users(id)",

        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS icon JSONB",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS cover JSONB",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS properties JSONB",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES app.knowledge_pages(id)",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS owner UUID REFERENCES app.user_groups(id)",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS owner_id TEXT",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user'",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS ownership_type TEXT DEFAULT 'individual'",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.knowledge_pages ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES app.users(id)",

        "ALTER TABLE app.data_sources ADD COLUMN IF NOT EXISTS owner_id UUID",
        "ALTER TABLE app.data_sources ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user'",
        "ALTER TABLE app.data_sources ADD COLUMN IF NOT EXISTS owner UUID REFERENCES app.user_groups(id)",
        "ALTER TABLE app.data_sources ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.data_sources ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",

        "ALTER TABLE app.analyses ADD COLUMN IF NOT EXISTS owner UUID REFERENCES app.user_groups(id)",
        "ALTER TABLE app.analyses ADD COLUMN IF NOT EXISTS owner_id UUID",
        "ALTER TABLE app.analyses ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user'",
        "ALTER TABLE app.analyses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.analyses ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",

        "ALTER TABLE app.user_groups ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES app.users(id)",
        "ALTER TABLE app.user_groups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.user_groups ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",
        "ALTER TABLE app.user_groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE app.user_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",

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
        "ALTER TABLE app.user_group_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE app.user_group_members ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app.users(id)",
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
