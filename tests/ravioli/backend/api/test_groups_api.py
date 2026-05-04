import pytest
from fastapi.testclient import TestClient
import uuid
from datetime import UTC
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ravioli.backend.main import app
from ravioli.backend.core.database import get_db, Base
from ravioli.backend.core import models

# Setup file-based SQLite
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(name="db_session")
def db_session_fixture(mocker):
    # Remove schema from all tables for SQLite compatibility
    for table in Base.metadata.tables.values():
        table.schema = None
    Base.metadata.create_all(bind=engine)
    
    # Mock SessionLocal in both locations it's used
    mocker.patch("ravioli.backend.core.database.SessionLocal", TestingSessionLocal)
    mocker.patch("ravioli.backend.api.v1.endpoints.analyses.SessionLocal", TestingSessionLocal)
    mocker.patch("ravioli.backend.api.v1.endpoints.data.SessionLocal", TestingSessionLocal)
    
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(name="test_client")
def test_client_fixture(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_create_group_with_owner(test_client, db_session):
    # Create a user first to be the owner
    owner = models.User(id=uuid.uuid4(), name="Steward", email="steward@test.com", role="Steward")
    db_session.add(owner)
    db_session.commit()
    
    group_data = {
        "name": "Test Group",
        "description": "A group for testing",
        "owner_id": str(owner.id)
    }
    
    response = test_client.post("/api/v1/users/groups", json=group_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Group"
    assert data["owner_id"] == str(owner.id)
    assert data["created_by"] is not None
    assert data["updated_by"] is not None

def test_add_group_member(test_client, db_session):
    group = models.UserGroup(id=uuid.uuid4(), name="Test Group")
    user = models.User(id=uuid.uuid4(), name="Member", email="member@test.com")
    db_session.add(group)
    db_session.add(user)
    db_session.commit()
    
    response = test_client.post(f"/api/v1/users/groups/{group.id}/members/{user.id}")
    
    assert response.status_code == 200
    assert response.json()["message"] == "User added to group"
    
    # Verify in DB
    db_session.refresh(group)
    assert user in group.members

def test_analysis_ownership_api(test_client, db_session):
    group_id = str(uuid.uuid4())
    analysis_data = {
        "title": "Group Analysis",
        "description": "Analysis owned by a group",
        "owner": group_id,
        "owner_id": group_id,
        "owner_type": "group"
    }
    
    response = test_client.post("/api/v1/analyses/", json=analysis_data)
    
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Group Analysis"
    assert data["owner"] == group_id
    assert data["created_by"] is not None
    assert data["updated_by"] is not None
    assert data["created_at"] is not None
