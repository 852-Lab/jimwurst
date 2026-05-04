from ravioli.backend.core.database import engine
from sqlalchemy import text

def check_id():
    id_val = 'd7121089-15d1-4795-9bb7-efd840987623'
    with engine.connect() as conn:
        is_user = conn.execute(text(f"SELECT EXISTS(SELECT 1 FROM app.users WHERE id = '{id_val}')")).scalar()
        is_group = conn.execute(text(f"SELECT EXISTS(SELECT 1 FROM app.user_groups WHERE id = '{id_val}')")).scalar()
        print(f"Is User: {is_user}, Is Group: {is_group}")

if __name__ == "__main__":
    check_id()
