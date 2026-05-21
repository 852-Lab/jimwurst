import pytest
from unittest.mock import MagicMock, patch
import uuid
from sqlalchemy.orm import Session

from ravioli.backend.core.notion import NotionSyncService
from ravioli.backend.core import models


@pytest.fixture
def mock_db():
    return MagicMock(spec=Session)


@pytest.fixture
def mock_client():
    with patch("ravioli.backend.core.notion.Client") as mock:
        yield mock.return_value


@pytest.fixture
def notion_service(mock_db, mock_client):
    return NotionSyncService(token="test_token", db=mock_db, user_id=uuid.uuid4())


def test_sanitize_blocks_for_push(notion_service):
    # Test that read-only fields and explicit nulls are stripped recursively
    blocks = [
        {
            "id": "123",
            "type": "paragraph",
            "created_time": "2024-01-01",
            "has_children": False,
            "paragraph": {
                "rich_text": [{"text": {"content": "Hello"}}],
                "icon": None,
                "color": "default"
            }
        },
        {
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [{"text": {"content": "Item 1"}}],
                "children": [
                    {
                        "id": "456",
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{"text": {"content": "Nested"}}],
                            "color": None
                        }
                    }
                ]
            }
        }
    ]

    sanitized = notion_service._sanitize_blocks_for_push(blocks)

    # First block checks
    assert "id" not in sanitized[0]
    assert "created_time" not in sanitized[0]
    assert "has_children" not in sanitized[0]
    assert "icon" not in sanitized[0]["paragraph"]
    assert "color" in sanitized[0]["paragraph"]
    
    # Second block recursive checks
    assert "id" not in sanitized[1]["bulleted_list_item"]["children"][0]
    assert "color" not in sanitized[1]["bulleted_list_item"]["children"][0]["paragraph"]
    assert sanitized[1]["bulleted_list_item"]["children"][0]["paragraph"]["rich_text"][0]["text"]["content"] == "Nested"


def test_push_all_pages_prioritizes_ravioli_pages(notion_service, mock_db):
    # Setup mock local and imported pages
    local_page = models.KnowledgePage(id=uuid.uuid4(), title="Local", source="Ravioli", source_id=None)
    imported_page = models.KnowledgePage(id=uuid.uuid4(), title="Imported", source="notion", source_id="notion_id")
    
    # Configure mock DB to return local pages first, then imported pages when queried sequentially
    mock_db.query().filter().all.side_effect = [
        [local_page],      # Phase 1: local
        [imported_page]    # Phase 2: imported
    ]
    
    # Mock _push_page so we can track order
    notion_service._push_page = MagicMock(return_value=True)
    
    count = notion_service.push_all_pages()
    
    assert count == 2
    # Verify push was called twice, local first then imported
    assert notion_service._push_page.call_args_list[0][0][0] == local_page
    assert notion_service._push_page.call_args_list[1][0][0] == imported_page


def test_push_page_creates_new_page(notion_service, mock_client):
    # Mock page that lacks a source_id
    page = models.KnowledgePage(
        id=uuid.uuid4(),
        title="New Page",
        source="Ravioli",
        source_id=None
    )
    
    # Mock search to return a parent
    mock_client.search.return_value = {"results": [{"id": "parent_123"}]}
    
    # Mock create to return new page ID
    mock_client.pages.create.return_value = {"id": "new_notion_id"}
    mock_client.blocks.children.list.return_value = {"results": [], "has_more": False}
    mock_client.pages.retrieve.return_value = {"last_edited_time": "2024-05-21T00:00:00Z"}
    
    result = notion_service._push_page(page)
    
    assert result is True
    # Verify it searched for a parent
    mock_client.search.assert_called_once_with(filter={"property": "object", "value": "page"})
    
    # Verify it created a page under that parent
    mock_client.pages.create.assert_called_once_with(
        parent={"type": "page_id", "page_id": "parent_123"},
        properties={"title": {"title": [{"text": {"content": "New Page"}}]}}
    )
    
    # Verify it set the local tracking properties
    assert page.source == "Ravioli"
    assert page.source_id == "new_notion_id"


def test_push_page_fails_gracefully_no_parent(notion_service, mock_client):
    # Mock page that lacks a source_id
    page = models.KnowledgePage(
        id=uuid.uuid4(),
        title="New Page",
        source="Ravioli",
        source_id=None
    )
    
    # Mock search to return NO parent
    mock_client.search.return_value = {"results": []}
    
    result = notion_service._push_page(page)
    
    assert result is False
    mock_client.pages.create.assert_not_called()
