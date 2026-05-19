import uuid
from unittest.mock import MagicMock
from ravioli.backend.core.models import DataSource, Analysis, Insight, KnowledgePage

def test_get_insights_lineage(client, session):
    # Mocking database entities
    ds_id = uuid.uuid4()
    ana_id = uuid.uuid4()
    ins_id = uuid.uuid4()
    kp_id = uuid.uuid4()

    mock_ds = DataSource(
        id=ds_id,
        filename="test.csv",
        original_filename="test.csv",
        content_type="text/csv",
        size_bytes=100,
        table_name="test_table",
        schema_name="main",
        row_count=10,
        status="completed"
    )

    mock_ana = Analysis(
        id=ana_id,
        title="Test Analysis",
        description="Analysis desc",
        status="completed",
        analysis_metadata={"file_id": str(ds_id)}
    )

    mock_ins = Insight(
        id=ins_id,
        analysis_id=ana_id,
        content="Test Insight Content",
        is_verified=True,
        is_published=True,
        source_label="Test Analysis"
    )
    # Give the mock insight parents relationship
    mock_ins.parents = []

    mock_kp = KnowledgePage(
        id=kp_id,
        title="Test Page",
        source="insight",
        source_id=str(ins_id)
    )

    # Configure session queries to return our mocks
    mock_query_ds = MagicMock()
    mock_query_ds.all.return_value = [mock_ds]

    mock_query_ana = MagicMock()
    mock_query_ana.all.return_value = [mock_ana]

    mock_query_ins = MagicMock()
    mock_query_ins.options.return_value.all.return_value = [mock_ins]

    mock_query_kp = MagicMock()
    mock_query_kp.all.return_value = [mock_kp]

    session.query.side_effect = lambda model: {
        DataSource: mock_query_ds,
        Analysis: mock_query_ana,
        Insight: mock_query_ins,
        KnowledgePage: mock_query_kp
    }[model]

    # Perform GET request
    response = client.get("/api/v1/insights/lineage")
    assert response.status_code == 200

    data = response.json()
    assert "nodes" in data
    assert "edges" in data

    nodes = data["nodes"]
    edges = data["edges"]

    # Verify node structures
    ds_node = next((n for n in nodes if n["type"] == "datasource"), None)
    ana_node = next((n for n in nodes if n["type"] == "analysis"), None)
    ins_node = next((n for n in nodes if n["type"] == "insight"), None)
    kp_node = next((n for n in nodes if n["type"] == "knowledge"), None)

    assert ds_node is not None
    assert ds_node["label"] == "test.csv"
    
    assert ana_node is not None
    assert ana_node["label"] == "Test Analysis"
    
    assert ins_node is not None
    assert ins_node["label"] == "Test Insight Content"
    
    assert kp_node is not None
    assert kp_node["label"] == "Test Page"

    # Verify edges
    edge_ds_ana = next((e for e in edges if e["source"] == f"datasource-{ds_id}" and e["target"] == f"analysis-{ana_id}"), None)
    edge_ana_ins = next((e for e in edges if e["source"] == f"analysis-{ana_id}" and e["target"] == f"insight-{ins_id}"), None)
    edge_ins_kp = next((e for e in edges if e["source"] == f"insight-{ins_id}" and e["target"] == f"knowledge-{kp_id}"), None)

    assert edge_ds_ana is not None
    assert edge_ds_ana["type"] == "queried"

    assert edge_ana_ins is not None
    assert edge_ana_ins["type"] == "extracted_from"

    assert edge_ins_kp is not None
    assert edge_ins_kp["type"] == "documented_in"
