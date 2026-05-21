from sqlalchemy import create_engine
engine = create_engine("postgresql://ravioli_user:ravioli_password@localhost:5432/ravioli_db")
with engine.connect() as conn:
    res = conn.execute("SELECT value FROM app.system_settings WHERE key='notion'").first()
    import json, sys
    if not res: sys.exit(1)
    val = json.loads(res[0]) if isinstance(res[0], str) else res[0]
    token = val.get("token")
    
import os
from cryptography.fernet import Fernet
fernet = Fernet(os.environ.get("ENCRYPTION_KEY", "b4pQvE_39Y4sQZ2FpL8vXG_rB0tK9M1xNqU2zP5iO3c="))
decrypted = fernet.decrypt(token.encode()).decode()

from notion_client import Client
client = Client(auth=decrypted)
try:
    res = client.pages.create(
        parent={"type": "workspace", "workspace": True},
        properties={"title": {"title": [{"text": {"content": "Test Create from Script"}}]}}
    )
    print("SUCCESS")
    print(res)
except Exception as e:
    print("ERROR")
    print(e)
