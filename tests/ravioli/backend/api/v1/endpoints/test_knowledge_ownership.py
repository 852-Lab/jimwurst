import uuid
from datetime import datetime, UTC
from ravioli.backend.core.models import KnowledgePage

def create_mock_page(id=None, title="Test Page", properties=None, content=None, ownership_type="individual"):
    return KnowledgePage(
        id=id or uuid.uuid4(),
        title=title,
        properties=properties if properties is not None else {"title": [{"text": {"content": title}}]},
        content=content or [{"type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Hello"}}]}}],
        icon={"type": "emoji", "emoji": "📄"},
        cover={"type": "external", "external": {"url": "https://example.com/cover.jpg"}},
        owner_type="individual",
        ownership_type=ownership_type,
        source="manual",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )

def test_create_knowledge_page_with_ownership_type(client, session):
    payload = {
        "title": "New Intelligence",
        "properties": {"tags": ["AI", "Notion"]},
        "content": [{"type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Body"}}]}}],
        "ownership_type": "team"
    }
    
    # Mock the return value of create to have timestamps
    mock_page = create_mock_page(title="New Intelligence", ownership_type="team")
    session.add.side_effect = lambda x: setattr(x, 'id', mock_page.id) or setattr(x, 'created_at', mock_page.created_at) or setattr(x, 'updated_at', mock_page.updated_at)
    
    response = client.post("/api/v1/knowledge/", json=payload)
    
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "New Intelligence"
    assert data["ownership_type"] == "team"
    assert session.add.called
    
    # Check that the object added to session has ownership_type
    added_obj = session.add.call_args[0][0]
    assert added_obj.ownership_type == "team"

def test_update_knowledge_page_ownership_type(client, session):
    page_id = uuid.uuid4()
    mock_page = create_mock_page(id=page_id, ownership_type="individual")
    session.query.return_value.filter.return_value.first.return_value = mock_page
    
    payload = {"ownership_type": "team"}
    response = client.patch(f"/api/v1/knowledge/{page_id}", json=payload)
    
    assert response.status_code == 200
    assert mock_page.ownership_type == "team"
    assert session.commit.called
