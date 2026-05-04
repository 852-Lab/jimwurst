import uuid
from datetime import datetime, UTC
from unittest.mock import MagicMock
from ravioli.backend.core import models

def test_list_users(client, session):
    """Test listing all users."""
    mock_user_1 = MagicMock(spec=models.User)
    mock_user_1.id = uuid.uuid4()
    mock_user_1.email = "user1@example.com"
    mock_user_1.name = "User One"
    mock_user_1.role = "Admin"
    mock_user_1.status = "active"
    mock_user_1.created_at = datetime.now(UTC)
    mock_user_1.updated_at = datetime.now(UTC)
    mock_user_1.created_by = None
    mock_user_1.updated_by = None

    mock_user_2 = MagicMock(spec=models.User)
    mock_user_2.id = uuid.uuid4()
    mock_user_2.email = "user2@example.com"
    mock_user_2.name = "User Two"
    mock_user_2.role = "Viewer"
    mock_user_2.status = "active"
    mock_user_2.created_at = datetime.now(UTC)
    mock_user_2.updated_at = datetime.now(UTC)
    mock_user_2.created_by = None
    mock_user_2.updated_by = None

    session.query.return_value.all.return_value = [mock_user_1, mock_user_2]

    response = client.get("/api/v1/users/")

    assert response.status_code == 200
    assert len(response.json()) == 2
    assert response.json()[0]["email"] == "user1@example.com"

def test_create_user_admin(client, session):
    """Test admin creating a new user (invitation)."""
    session.query.return_value.filter.return_value.first.return_value = None
    
    def mock_add(obj):
        obj.id = uuid.uuid4()
        obj.created_at = datetime.now(UTC)
        obj.updated_at = datetime.now(UTC)
        obj.created_by = None
        obj.updated_by = None
        return obj
    session.add.side_effect = mock_add

    response = client.post(
        "/api/v1/users/",
        json={"name": "Invited User", "email": "invited@example.com", "role": "Steward"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == "invited@example.com"
    assert response.json()["status"] == "invited"
    assert "created_at" in response.json()
    session.add.assert_called_once()
    session.commit.assert_called_once()

def test_create_user_already_exists(client, session):
    """Test creating a user that already exists."""
    session.query.return_value.filter.return_value.first.return_value = MagicMock()

    response = client.post(
        "/api/v1/users/",
        json={"name": "Existing User", "email": "exists@example.com", "role": "Viewer"}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "User already exists"

def test_list_groups(client, session):
    """Test listing user groups."""
    mock_group = MagicMock(spec=models.UserGroup)
    mock_group.id = uuid.uuid4()
    mock_group.name = "Data Scientists"
    mock_group.description = "Core analysis team"
    mock_group.created_at = datetime.now(UTC)
    mock_group.updated_at = datetime.now(UTC)
    mock_group.created_by = None
    mock_group.updated_by = None
    mock_group.owner_id = None

    session.query.return_value.all.return_value = [mock_group]

    response = client.get("/api/v1/users/groups")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Data Scientists"

def test_create_group(client, session):
    """Test creating a new user group."""
    def mock_add(obj):
        obj.id = uuid.uuid4()
        obj.created_at = datetime.now(UTC)
        obj.updated_at = datetime.now(UTC)
        obj.created_by = None
        obj.updated_by = None
        obj.owner_id = None
        return obj
    session.add.side_effect = mock_add

    response = client.post(
        "/api/v1/users/groups",
        json={"name": "New Group", "description": "A test group"}
    )

    assert response.status_code == 200
    assert response.json()["name"] == "New Group"
    assert "created_at" in response.json()
    session.add.assert_called_once()
    session.commit.assert_called_once()

def test_update_user(client, session):
    """Test updating a user's role or status."""
    user_id = uuid.uuid4()
    mock_user = MagicMock(spec=models.User)
    mock_user.id = user_id
    mock_user.role = "Viewer"
    mock_user.name = "Test User"
    mock_user.email = "test@example.com"
    mock_user.status = "active"
    mock_user.created_at = datetime.now(UTC)
    mock_user.updated_at = datetime.now(UTC)
    mock_user.created_by = None
    mock_user.updated_by = None

    session.query.return_value.filter.return_value.first.return_value = mock_user

    response = client.patch(
        f"/api/v1/users/{user_id}",
        json={"role": "Admin", "status": "active"}
    )

    assert response.status_code == 200
    assert mock_user.role == "Admin"
    assert mock_user.status == "active"
    session.commit.assert_called_once()

def test_update_user_not_found(client, session):
    """Test updating a non-existent user."""
    user_id = uuid.uuid4()
    session.query.return_value.filter.return_value.first.return_value = None

    response = client.patch(
        f"/api/v1/users/{user_id}",
        json={"role": "Admin"}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"
