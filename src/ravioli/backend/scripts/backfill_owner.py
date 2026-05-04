from ravioli.backend.core.database import engine
from sqlalchemy import text
from datetime import datetime, UTC

def backfill_owner():
    user_id = 'd7121089-15d1-4795-9bb7-efd840987623'
    now = datetime.now(UTC).isoformat()
    
    with engine.begin() as conn:
        # 1. Ensure the user exists
        user_exists = conn.execute(text(f"SELECT EXISTS(SELECT 1 FROM app.users WHERE id = '{user_id}')")).scalar()
        if not user_exists:
            print(f"User {user_id} not found. Seeding user first.")
            conn.execute(text(f"INSERT INTO app.users (id, name, email, role, status, created_at) VALUES ('{user_id}', 'Jimmy Pang', 'jimmypang@aipassione.com', 'Admin', 'active', '{now}') ON CONFLICT DO NOTHING"))

        # 2. Ensure a group exists for this ID
        group_exists = conn.execute(text(f"SELECT EXISTS(SELECT 1 FROM app.user_groups WHERE id = '{user_id}')")).scalar()
        if not group_exists:
            print(f"Creating personal group for user {user_id}")
            conn.execute(text(f"INSERT INTO app.user_groups (id, name, description, owner_id, created_at, updated_at) VALUES ('{user_id}', 'Personal Group', 'Automatically created personal group', '{user_id}', '{now}', '{now}')"))
        
        # 3. Update all assets to have owner = created_by
        tables = [
            'app.analyses',
            'app.data_sources',
            'app.insights',
            'app.knowledge_pages'
        ]
        
        for table in tables:
            # Set owner = created_by where owner is NULL
            conn.execute(text(f"UPDATE {table} SET owner = created_by WHERE owner IS NULL AND created_by IS NOT NULL"))
            # Ensure our specific user's assets are updated
            conn.execute(text(f"UPDATE {table} SET owner = '{user_id}' WHERE created_by = '{user_id}' AND owner IS NULL"))

        print(f"Backfill for owner column completed using Personal Group pattern.")

if __name__ == "__main__":
    backfill_owner()
