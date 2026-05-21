import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from ravioli.backend.core import models


@pytest.fixture
def mock_notion_service():
    with patch("ravioli.backend.api.v1.endpoints.knowledge.NotionSyncService") as mock:
        yield mock.return_value


@pytest.fixture
def setup_notion_token(session):
    # Mocking an encrypted token for test
    from ravioli.backend.core.security import encrypt_value
    token_data = {"token": encrypt_value("secret_test_token")}
    
    mock_setting = MagicMock(spec=models.SystemSetting)
    mock_setting.key = "notion"
    mock_setting.value = token_data
    
    # Configure the mock session chain
    session.query.return_value.filter.return_value.first.return_value = mock_setting
    return mock_setting


def test_sync_notion_pages_success(client: TestClient, setup_notion_token, mock_notion_service):
    # Arrange
    mock_notion_service.sync_all_accessible_pages.return_value = 5
    
    # Act
    response = client.post(
        "/api/v1/knowledge/notion/sync",
        json={"sync_all": True}
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["synced_count"] == 5


def test_sync_notion_pages_by_ids(client: TestClient, setup_notion_token, mock_notion_service):
    # Arrange
    mock_notion_service.sync_pages_by_ids.return_value = 2
    
    # Act
    response = client.post(
        "/api/v1/knowledge/notion/sync",
        json={"page_ids": ["id1", "id2"]}
    )
    
    # Assert
    assert response.status_code == 200
    assert response.json()["synced_count"] == 2
    mock_notion_service.sync_pages_by_ids.assert_called_once_with(["id1", "id2"])


def test_sync_notion_pages_missing_token(client: TestClient, session):
    # Configure session mock to return None
    session.query.return_value.filter.return_value.first.return_value = None
    
    response = client.post(
        "/api/v1/knowledge/notion/sync",
        json={"sync_all": True}
    )
    
    assert response.status_code == 400
    assert "Notion token not configured" in response.json()["detail"]


def test_push_notion_pages_success(client: TestClient, setup_notion_token, mock_notion_service):
    # Arrange
    mock_notion_service.push_all_pages.return_value = 3
    
    # Act
    response = client.post(
        "/api/v1/knowledge/notion/push",
        json={"sync_all": True}
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["pushed_count"] == 3


def test_push_notion_pages_by_ids(client: TestClient, setup_notion_token, mock_notion_service):
    # Arrange
    mock_notion_service.push_pages_by_ids.return_value = 1
    
    # Act
    response = client.post(
        "/api/v1/knowledge/notion/push",
        json={"page_ids": ["some_id"]}
    )
    
    # Assert
    assert response.status_code == 200
    assert response.json()["pushed_count"] == 1
    mock_notion_service.push_pages_by_ids.assert_called_once_with(["some_id"])
