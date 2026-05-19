import uuid
from unittest.mock import AsyncMock
from datetime import datetime, UTC

def test_create_analysis(client, session, current_user):
    # Prepare mock data
    analysis_id = uuid.uuid4()
    analysis_data = {
        "title": "Test Analysis",
        "description": "Testing the API",
        "analysis_metadata": {"key": "value"}
    }
    
    # Mock session behavior
    # When session.add is called, we don't do much
    # When session.refresh is called, we set the ID and timestamps
    def mock_refresh(obj):
        obj.id = analysis_id
        obj.status = "pending"
        obj.created_at = datetime.now(UTC)
        obj.updated_at = datetime.now(UTC)
        obj.owner = None
        obj.created_by = current_user.id
        obj.updated_by = current_user.id

    session.refresh.side_effect = mock_refresh

    # Execute request
    response = client.post("/api/v1/analyses/", json=analysis_data)

    # Assertions
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Analysis"
    assert data["id"] == str(analysis_id)
    assert data["created_by"] == str(current_user.id)
    assert data["updated_by"] == str(current_user.id)
    assert session.add.called
    assert session.commit.called

def test_list_analyses(client, session):
    analysis_id = uuid.uuid4()
    class MockAnalysis:
        def __init__(self, id, title):
            self.id = id
            self.title = title
            self.description = "Testing"
            self.status = "pending"
            self.created_at = datetime.now(UTC)
            self.updated_at = datetime.now(UTC)
            self.result = None
            self.analysis_metadata = {}
            self.owner = None
            self.created_by = None
            self.updated_by = None
            self.logs = []
    
    mock_analysis = MockAnalysis(analysis_id, "Test Analysis")
    session.query().order_by().offset().limit().all.return_value = [mock_analysis]

    # Execute request
    response = client.get("/api/v1/analyses/")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Test Analysis"

def test_get_analysis_not_found(client, session):
    # Mock session to return None
    session.query().filter().first.return_value = None

    # Execute request
    response = client.get(f"/api/v1/analyses/{uuid.uuid4()}")

    # Assertions
    assert response.status_code == 404
    assert response.json()["detail"] == "Analysis not found"

def test_create_analysis_with_notebook(client, session, current_user):
    # Prepare mock data with notebook
    analysis_id = uuid.uuid4()
    notebook_content = {
        "cells": [
            {
                "cell_type": "markdown",
                "metadata": {},
                "source": ["# Test Notebook"]
            }
        ],
        "metadata": {},
        "nbformat": 4,
        "nbformat_minor": 5
    }
    analysis_data = {
        "title": "Notebook Analysis",
        "description": "Testing notebook storage",
        "notebook": notebook_content
    }
    
    def mock_refresh(obj):
        obj.id = analysis_id
        obj.status = "pending"
        obj.created_at = datetime.now(UTC)
        obj.updated_at = datetime.now(UTC)
        obj.owner = None
        obj.created_by = current_user.id
        obj.updated_by = current_user.id
        obj.notebook = notebook_content

    session.refresh.side_effect = mock_refresh

    # Execute request
    response = client.post("/api/v1/analyses/", json=analysis_data)

    # Assertions
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Notebook Analysis"
    assert data["notebook"] == notebook_content
    assert data["created_by"] == str(current_user.id)
    assert data["updated_by"] == str(current_user.id)
    assert data["notebook"]["cells"][0]["source"] == ["# Test Notebook"]

def test_get_suggested_prompts(client, session, mocker):
    analysis_id = uuid.uuid4()
    
    # Mock analysis and logs
    class MockAnalysis:
        def __init__(self):
            self.id = analysis_id
            self.result = "Sample summary"
            self.analysis_metadata = {"filename": "test.csv"}
            self.owner = None
            self.created_by = None
            self.updated_by = None
            
    session.query().filter().first.return_value = MockAnalysis()
    session.query().filter().order_by().limit().all.return_value = []
    
    # Mock AI Agent and Skill
    mocker.patch("ravioli.backend.api.v1.endpoints.analyses.KowalskiAgent")
    mock_skill = mocker.patch("ravioli.backend.api.v1.endpoints.analyses.skill_comm.generate_suggested_prompts", new_callable=AsyncMock)
    mock_skill.return_value = ["Prompt 1", "Prompt 2", "Prompt 3"]
    
    # Execute request
    response = client.get(f"/api/v1/analyses/{analysis_id}/suggested-prompts")
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert data[0] == "Prompt 1"
    assert mock_skill.called

def test_execute_markdown_cell(client, session):
    analysis_id = uuid.uuid4()
    
    # Mock Analysis
    class MockAnalysis:
        def __init__(self):
            self.id = analysis_id
            self.title = "Test Analysis"
            self.analysis_metadata = {}
            self.notebook = {}
            
    mock_analysis = MockAnalysis()
    
    # When query filter first is called, return mock analysis
    session.query().filter().first.return_value = mock_analysis
    
    # Execute Markdown creation request
    payload = {
        "code": "# Hello Markdown\nThis is a note.",
        "replace_log_id": None,
        "insert_after_log_id": None
    }
    
    # Setup session.refresh to assign a dummy UUID to the created log
    def mock_refresh_log(obj):
        obj.id = uuid.uuid4()
        obj.timestamp = datetime.now(UTC)
        
    session.refresh.side_effect = mock_refresh_log

    response = client.post(f"/api/v1/analyses/{analysis_id}/execute-markdown", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "log_id" in data
    assert session.add.called
    assert session.commit.called

def test_execute_sql_cell_success(client, session, mocker):
    analysis_id = uuid.uuid4()
    
    class MockAnalysis:
        def __init__(self):
            self.id = analysis_id
            self.title = "Test Analysis"
            self.analysis_metadata = {}
            self.notebook = {}
            
    mock_analysis = MockAnalysis()
    
    mock_query = mocker.patch("ravioli.backend.data.olap.duckdb_manager.duckdb_manager.query")
    mock_query.return_value = [{"column1": 1, "column2": "test"}]
    
    session.query().filter().first.return_value = mock_analysis
    
    payload = {
        "code": "SELECT * FROM my_table",
        "replace_log_id": None,
        "insert_after_log_id": None
    }
    
    def mock_refresh_log(obj):
        obj.id = uuid.uuid4()
        obj.timestamp = datetime.now(UTC)
        
    session.refresh.side_effect = mock_refresh_log

    response = client.post(f"/api/v1/analyses/{analysis_id}/execute-sql", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "log_id" in data
    assert data["outputs"] == [{"type": "table", "data": [{"column1": 1, "column2": "test"}]}]
    assert mock_query.called
    assert session.add.called
    assert session.commit.called

def test_execute_sql_cell_failure(client, session, mocker):
    analysis_id = uuid.uuid4()
    
    class MockAnalysis:
        def __init__(self):
            self.id = analysis_id
            self.title = "Test Analysis"
            self.analysis_metadata = {}
            self.notebook = {}
            
    mock_analysis = MockAnalysis()
    
    mock_query = mocker.patch("ravioli.backend.data.olap.duckdb_manager.duckdb_manager.query")
    mock_query.side_effect = Exception("Table 'my_table' not found")
    
    session.query().filter().first.return_value = mock_analysis
    
    payload = {
        "code": "SELECT * FROM my_table",
        "replace_log_id": None,
        "insert_after_log_id": None
    }
    
    def mock_refresh_log(obj):
        obj.id = uuid.uuid4()
        obj.timestamp = datetime.now(UTC)
        
    session.refresh.side_effect = mock_refresh_log

    response = client.post(f"/api/v1/analyses/{analysis_id}/execute-sql", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["outputs"] == [{"type": "error", "ename": "Exception", "evalue": "Table 'my_table' not found", "traceback": []}]

