from sqlalchemy import create_engine, text
engine = create_engine("postgresql://ravioli_user:ravioli_password@postgres:5432/ravioli_db")
with engine.connect() as conn:
    res = conn.execute(text("SELECT value FROM app.system_settings WHERE key='notion'")).first()
    import sys
    if not res: sys.exit(1)
    val = res[0]
    token = val.get("token")
    
import os
from cryptography.fernet import Fernet
fernet = Fernet(os.environ.get("ENCRYPTION_KEY", "b4pQvE_39Y4sQZ2FpL8vXG_rB0tK9M1xNqU2zP5iO3c="))
decrypted = fernet.decrypt(token.encode()).decode()

from notion_client import Client
client = Client(auth=decrypted)
try:
    res = client.search(filter={"property": "object", "value": "page"})
    pages = res.get("results", [])
    if pages:
        print(f"Found {len(pages)} pages.")
        parent_id = pages[0]["id"]
        print("Using parent:", parent_id)
        client.pages.create(
            parent={"type": "page_id", "page_id": parent_id},
            properties={"title": {"title": [{"text": {"content": "Test Ravioli Create"}}]}}
        )
        print("CREATE SUCCESS")
    else:
        print("NO PAGES FOUND")
except Exception as e:
    print("ERROR")
    print(e)
