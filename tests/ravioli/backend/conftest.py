import pytest
import uuid
from datetime import datetime, UTC
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from ravioli.backend.main import app
from ravioli.backend.core.database import get_db
from ravioli.backend.api.v1.endpoints.data import get_current_user
from ravioli.backend.core.models import User

@pytest.fixture(name="session")
def session_fixture(mocker):
    """Provides a mocked SQLAlchemy session."""
    mock_session = mocker.Mock()
    return mock_session

@pytest.fixture(name="current_user")
def current_user_fixture():
    """Provides a real User model for dependency injection."""
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        name="Test User",
        role="Admin",
        status="active",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        created_by=None,
        updated_by=None
    )
    return user

@pytest.fixture(name="client")
def client_fixture(session, current_user):
    """Provides a TestClient with dependencies overridden."""
    def get_db_override():
        yield session
    
    def get_current_user_override():
        return current_user

    app.dependency_overrides[get_db] = get_db_override
    app.dependency_overrides[get_current_user] = get_current_user_override
    
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
