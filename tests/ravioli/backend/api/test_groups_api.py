import pytest
from fastapi.testclient import TestClient
import uuid
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

def test_update_group(test_client, db_session):
    group = models.UserGroup(id=uuid.uuid4(), name="Old Group Name", description="Old description")
    db_session.add(group)
    db_session.commit()
    
    update_data = {
        "name": "New Group Name",
        "description": "New description"
    }
    
    response = test_client.patch(f"/api/v1/users/groups/{group.id}", json=update_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Group Name"
    assert data["description"] == "New description"

def test_delete_group(test_client, db_session):
    group = models.UserGroup(id=uuid.uuid4(), name="To be deleted")
    db_session.add(group)
    db_session.commit()
    
    response = test_client.delete(f"/api/v1/users/groups/{group.id}")
    
    assert response.status_code == 200
    assert response.json()["message"] == "Group deleted successfully"
    
    # Verify in DB
    db_group = db_session.query(models.UserGroup).filter(models.UserGroup.id == group.id).first()
    assert db_group is None

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

def test_get_group_by_id(test_client, db_session):
    # Setup owner, group, and member
    owner = models.User(id=uuid.uuid4(), name="Steward Owner", email="steward_owner@test.com", role="Steward")
    group = models.UserGroup(id=uuid.uuid4(), name="Detailed Group", description="Detailed group description", owner_id=owner.id)
    member = models.User(id=uuid.uuid4(), name="Group Member", email="group_member@test.com")
    group.members.append(member)
    
    db_session.add(owner)
    db_session.add(group)
    db_session.add(member)
    db_session.commit()
    
    response = test_client.get(f"/api/v1/users/groups/{group.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Detailed Group"
    assert data["description"] == "Detailed group description"
    assert data["owner_id"] == str(owner.id)
    assert data["owner_user"]["id"] == str(owner.id)
    assert len(data["members"]) == 1
    assert data["members"][0]["id"] == str(member.id)

def test_get_group_by_id_not_found(test_client, db_session):
    fake_id = uuid.uuid4()
    response = test_client.get(f"/api/v1/users/groups/{fake_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Group not found"

