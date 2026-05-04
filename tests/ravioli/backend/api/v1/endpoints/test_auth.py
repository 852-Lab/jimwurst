import uuid
from datetime import datetime, UTC
from unittest.mock import MagicMock
from ravioli.backend.core import models

def test_login_success(client, session):
    """Test successful login."""
    mock_user = MagicMock(spec=models.User)
    mock_user.id = uuid.uuid4()
    mock_user.email = "test@example.com"
    mock_user.name = "Test User"
    mock_user.hashed_password = "password123"
    mock_user.status = "active"
    mock_user.role = "Viewer"
    mock_user.created_at = datetime.now(UTC)
    mock_user.updated_at = datetime.now(UTC)
    mock_user.created_by = None
    mock_user.updated_by = None

    session.query.return_value.filter.return_value.first.return_value = mock_user

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "password123"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"
    assert "ravioli_session" in response.cookies

def test_login_invalid_credentials(client, session):
    """Test login with invalid password."""
    mock_user = MagicMock(spec=models.User)
    mock_user.email = "test@example.com"
    mock_user.hashed_password = "correct_password"
    mock_user.status = "active"

    session.query.return_value.filter.return_value.first.return_value = mock_user

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "wrong_password"}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"

def test_login_user_not_found(client, session):
    """Test login with non-existent user."""
    session.query.return_value.filter.return_value.first.return_value = None

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "password123"}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"

def test_login_invited_user(client, session):
    """Test login for an invited user (should be forbidden until signup)."""
    mock_user = MagicMock(spec=models.User)
    mock_user.email = "invited@example.com"
    mock_user.hashed_password = "password123"
    mock_user.status = "invited"

    session.query.return_value.filter.return_value.first.return_value = mock_user

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "invited@example.com", "password": "password123"}
    )

    assert response.status_code == 403
    assert "Account not activated" in response.json()["detail"]

def test_signup_new_user(client, session):
    """Test self-signup for a new user."""
    session.query.return_value.filter.return_value.first.return_value = None
    
    # Mock the User object created during signup
    def mock_add(obj):
        obj.id = uuid.uuid4()
        obj.created_at = datetime.now(UTC)
        obj.role = "Viewer"
        obj.status = "active"
        obj.updated_at = datetime.now(UTC)
        obj.created_by = None
        obj.updated_by = None
        return obj
    session.add.side_effect = mock_add

    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "New User", "email": "new@example.com", "password": "password123"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == "new@example.com"
    assert response.json()["role"] == "Viewer"
    assert "ravioli_session" in response.cookies

def test_signup_activate_invited_user(client, session):
    """Test signup which activates an already invited user."""
    mock_user = MagicMock(spec=models.User)
    mock_user.id = uuid.uuid4()
    mock_user.email = "invited@example.com"
    mock_user.name = "Invited User"
    mock_user.status = "invited"
    mock_user.created_at = datetime.now(UTC)
    mock_user.updated_at = datetime.now(UTC)
    mock_user.created_by = None
    mock_user.updated_by = None
    mock_user.role = "Viewer"

    session.query.return_value.filter.return_value.first.return_value = mock_user

    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "Activated User", "email": "invited@example.com", "password": "new_password"}
    )

    assert response.status_code == 200
    assert mock_user.status == "active"
    assert mock_user.hashed_password == "new_password"
    assert "ravioli_session" in response.cookies

def test_get_me_authenticated_param(client, session):
    """Test /me endpoint with email in query param."""
    mock_user = MagicMock(spec=models.User)
    mock_user.id = uuid.uuid4()
    mock_user.email = "test@example.com"
    mock_user.name = "Test User"
    mock_user.role = "Viewer"
    mock_user.status = "active"
    mock_user.created_at = datetime.now(UTC)

    session.query.return_value.filter.return_value.first.return_value = mock_user

    response = client.get("/api/v1/auth/me?email=test@example.com")

    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"

def test_get_me_authenticated_cookie(client, session):
    """Test /me endpoint with session cookie."""
    mock_user = MagicMock(spec=models.User)
    mock_user.id = uuid.uuid4()
    mock_user.email = "test@example.com"
    mock_user.name = "Test User"
    mock_user.role = "Viewer"
    mock_user.status = "active"
    mock_user.created_at = datetime.now(UTC)
    
    session.query.return_value.filter.return_value.first.return_value = mock_user

    client.cookies.set("ravioli_session", "test@example.com")
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"

def test_get_me_unauthenticated(client, session):
    """Test /me endpoint without authentication."""
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"
