from ravioli.backend.core.database import engine
from sqlalchemy import text
import sys

def verify():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'analyses'"))
        columns = [row[0] for row in result]
        print(f"Columns in app.analyses: {columns}")
        
        if 'created_by' in columns and 'updated_by' in columns:
            print("SUCCESS: Audit columns found.")
        else:
            print("FAILURE: Audit columns NOT found.")

if __name__ == "__main__":
    verify()
