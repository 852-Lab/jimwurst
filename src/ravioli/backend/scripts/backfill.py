from ravioli.backend.core.database import engine
from sqlalchemy import text

def backfill():
    user_id = 'd7121089-15d1-4795-9bb7-efd840987623'
    tables = [
        'app.analyses',
        'app.data_sources',
        'app.insights',
        'app.knowledge_pages',
        'app.user_groups'
    ]
    
    with engine.begin() as conn:
        for table in tables:
            table_name = table.split('.')[-1]
            # Get columns for this table
            res = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'app' AND table_name = '{table_name}'"))
            columns = [row[0] for row in res]
            
            # Update audit fields
            if 'created_by' in columns:
                conn.execute(text(f"UPDATE {table} SET created_by = '{user_id}' WHERE created_by IS NULL"))
            if 'updated_by' in columns:
                conn.execute(text(f"UPDATE {table} SET updated_by = '{user_id}' WHERE updated_by IS NULL"))
            
            # Update legacy ownership
            if 'owner_id' in columns:
                conn.execute(text(f"UPDATE {table} SET owner_id = '{user_id}' WHERE owner_id IS NULL"))
            if 'owner_type' in columns:
                conn.execute(text(f"UPDATE {table} SET owner_type = 'user' WHERE owner_type IS NULL"))

        print(f"Backfill completed for user {user_id}")

if __name__ == "__main__":
    backfill()
