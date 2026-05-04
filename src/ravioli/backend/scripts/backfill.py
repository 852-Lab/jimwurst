from ravioli.backend.core.database import engine
from sqlalchemy import text

def backfill():
    admin_id = 'd7121089-15d1-4795-9bb7-efd840987623'
    tables = [
        'app.analyses',
        'app.data_sources',
        'app.insights',
        'app.knowledge_pages',
        'app.user_groups',
        'app.system_settings',
        'app.users'
    ]
    
    with engine.begin() as conn:
        for table in tables:
            table_name = table.split('.')[-1]
            res = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'app' AND table_name = '{table_name}'"))
            columns = [row[0] for row in res]
            
            if table == 'app.users':
                # For users, set created_by to admin_id unless it's the admin themselves
                conn.execute(text(f"UPDATE app.users SET created_by = '{admin_id}' WHERE created_by IS NULL AND id != '{admin_id}'"))
                conn.execute(text(f"UPDATE app.users SET created_by = id WHERE created_by IS NULL AND id = '{admin_id}'"))
                conn.execute(text(f"UPDATE app.users SET updated_by = '{admin_id}' WHERE updated_by IS NULL"))
                continue

            if 'created_by' in columns:
                conn.execute(text(f"UPDATE {table} SET created_by = '{admin_id}' WHERE created_by IS NULL"))
            if 'updated_by' in columns:
                conn.execute(text(f"UPDATE {table} SET updated_by = '{admin_id}' WHERE updated_by IS NULL"))
            
            if 'owner_id' in columns:
                # Special case for user_groups: owner_id is the steward
                if table != 'app.user_groups':
                    conn.execute(text(f"UPDATE {table} SET owner_id = '{admin_id}' WHERE owner_id IS NULL"))
            if 'owner_type' in columns:
                conn.execute(text(f"UPDATE {table} SET owner_type = 'user' WHERE owner_type IS NULL"))
            if 'owner' in columns:
                conn.execute(text(f"UPDATE {table} SET owner = '{admin_id}' WHERE owner IS NULL"))

        print(f"Backfill completed for admin {admin_id}")

if __name__ == "__main__":
    backfill()
