import uuid
import pytest
from ravioli.backend.core.jupyter_manager import JupyterManager

@pytest.fixture(name="manager")
def manager_fixture():
    """Provides a fresh JupyterManager instance for testing, and cleans up any started kernels."""
    mgr = JupyterManager()
    yield mgr
    # Cleanup
    for aid_str, km in list(mgr.kernels.items()):
        try:
            km.shutdown_kernel(now=True)
        except Exception:
            # Best-effort teardown: ignore shutdown errors to avoid masking test outcomes.
            # Kernels may already be stopped or in an invalid state during fixture cleanup.
            pass

def test_jupyter_manager_lifecycle(manager):
    analysis_id = uuid.uuid4()
    
    # 1. Check initial status
    assert manager.get_kernel_status(analysis_id) == "not_started"
    
    # 2. Get client (starts kernel)
    client = manager.get_or_create_kernel(analysis_id)
    assert client is not None
    assert manager.get_kernel_status(analysis_id) == "connected"
    
    # 3. Execute basic code
    outputs = manager.execute_code(analysis_id, "3 * 15")
    assert len(outputs) > 0
    
    # Check that we received execution result
    exec_results = [o for o in outputs if o.get("type") == "execute_result"]
    assert len(exec_results) == 1
    assert exec_results[0]["data"]["text/plain"] == "45"

def test_jupyter_manager_automatic_imports(manager):
    analysis_id = uuid.uuid4()
    
    # Verify that pandas, numpy, and matplotlib are pre-loaded in the namespace without explicit imports
    code = """
import sys
assert 'pd' in globals() or 'pandas' in sys.modules
assert 'np' in globals() or 'numpy' in sys.modules
assert 'plt' in globals() or 'matplotlib.pyplot' in sys.modules
print("Pre-imports checked!")
"""
    outputs = manager.execute_code(analysis_id, code)
    
    # Check stdout stream for success message
    streams = [o for o in outputs if o.get("type") == "stream" and o.get("name") == "stdout"]
    assert len(streams) == 1
    assert "Pre-imports checked!" in streams[0]["text"]

def test_jupyter_manager_duckdb_con(manager):
    import duckdb
    from ravioli.backend.core.config import settings
    # Ensure duckdb file exists so read-only connection works in clean CI environments
    settings.duckdb_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        duckdb.connect(str(settings.duckdb_path)).close()
    except duckdb.IOException:
        # Best-effort DB file bootstrap for CI: if the path is not writable/accessible here,
        # later test logic will exercise and report connection behavior explicitly.
        pass

    analysis_id = uuid.uuid4()
    
    # Verify that read-only duckdb connection 'con' is pre-configured and queryable
    code = """
res = con.execute("SELECT 42 AS val").fetchone()
print(f"Result: {res}")
"""
    outputs = manager.execute_code(analysis_id, code)
    
    streams = [o for o in outputs if o.get("type") == "stream" and o.get("name") == "stdout"]
    assert len(streams) == 1
    assert "Result: (42,)" in streams[0]["text"]

def test_jupyter_manager_matplotlib_inline(manager):
    analysis_id = uuid.uuid4()
    
    # Plot a simple chart and check that base64 png display data is generated
    code = """
fig, ax = plt.subplots()
ax.plot([1, 2], [3, 4])
"""
    outputs = manager.execute_code(analysis_id, code)
    
    # Check for display_data containing image/png mime type
    displays = [
        o for o in outputs 
        if o.get("type") in ("display_data", "execute_result") 
        and "image/png" in o.get("data", {})
    ]
    assert len(displays) >= 1
    assert len(displays[0]["data"]["image/png"]) > 50  # Must contain base64 image string
