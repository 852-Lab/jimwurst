import uuid
from datetime import datetime, UTC

def test_create_log(client, session):
    # Prepare mock data
    analysis_id = uuid.uuid4()
    log_id = uuid.uuid4()
    log_data = {
        "analysis_id": str(analysis_id),
        "log_type": "thought",
        "content": "Agent is thinking...",
        "data": {"thought_id": 1}
    }
    
    # Mock session behavior
    def mock_refresh(obj):
        obj.id = log_id
        obj.timestamp = datetime.now(UTC)

    session.refresh.side_effect = mock_refresh
    
    # Mock analysis check
    session.query().filter().first.return_value = True

    # Execute request
    response = client.post("/api/v1/analysis-logs/", json=log_data)

    # Assertions
    assert response.status_code == 201
    data = response.json()
    assert data["content"] == "Agent is thinking..."
    assert data["analysis_id"] == str(analysis_id)

def test_list_logs_for_analysis(client, session):
    analysis_id = uuid.uuid4()
    class MockLog:
        def __init__(self):
            self.id = uuid.uuid4()
            self.analysis_id = analysis_id
            self.log_type = "thought"
            self.content = "Thinking..."
            self.tool_name = None
            self.data = {}
            self.timestamp = datetime.now(UTC)
            
    mock_log = MockLog()
    session.query().filter().order_by().all.return_value = [mock_log]

    # Execute request
    response = client.get(f"/api/v1/analysis-logs/analysis/{analysis_id}")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["content"] == "Thinking..."

def test_delete_log(client, session):
    log_id = uuid.uuid4()
    
    class MockLog:
        def __init__(self):
            self.id = log_id
            self.analysis_id = uuid.uuid4()
            self.log_type = "user_query"
            self.timestamp = datetime.now(UTC)
            
    mock_log = MockLog()
    
    # Mock database queries
    session.query().filter().first.return_value = mock_log
    session.query().filter().order_by().all.return_value = []
    
    # Execute request
    response = client.delete(f"/api/v1/analysis-logs/{log_id}")
    
    # Assertions
    assert response.status_code == 204

def test_delete_log_cascade(client, session):
    analysis_id = uuid.uuid4()
    log1_id = uuid.uuid4()
    log2_id = uuid.uuid4()
    log3_id = uuid.uuid4()
    
    class MockLog:
        def __init__(self, id, log_type):
            self.id = id
            self.analysis_id = analysis_id
            self.log_type = log_type
            self.timestamp = datetime.now(UTC)
            
    log1 = MockLog(log1_id, "user_query")
    log2 = MockLog(log2_id, "agent_response")
    log3 = MockLog(log3_id, "user_query")
    
    class MockQuery:
        def filter(self, *args, **kwargs):
            return self
        def order_by(self, *args, **kwargs):
            return self
        def first(self):
            return log1
        def all(self):
            return [log1, log2, log3]
            
    session.query.return_value = MockQuery()
    
    # Execute request
    response = client.delete(f"/api/v1/analysis-logs/{log1_id}")
    
    # Assertions
    assert response.status_code == 204
    
    # Verify both log1 and log2 were deleted
    deleted_objects = [call.args[0] for call in session.delete.call_args_list]
    assert log1 in deleted_objects
    assert log2 in deleted_objects
    assert log3 not in deleted_objects
