import os
from notion_client import Client
client = Client(auth=os.environ.get("NOTION_API_KEY"))
res = client.pages.create(
    parent={"type": "workspace", "workspace": True},
    properties={
        "title": {
            "title": [{"text": {"content": "Test Page created from API"}}]
        }
    }
)
print(res)
