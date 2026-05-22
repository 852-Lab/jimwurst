import jupyter_client
import uuid
from typing import Dict, List
from queue import Empty
import logging
from ravioli.backend.core.config import settings

logger = logging.getLogger(__name__)

class JupyterManager:
    """
    Manages headless IPython kernels for each Analysis.
    """
    def __init__(self):
        self.kernels: Dict[str, jupyter_client.KernelManager] = {}
        self.clients: Dict[str, jupyter_client.KernelClient] = {}

    def get_kernel_status(self, analysis_id: uuid.UUID) -> str:
        aid_str = str(analysis_id)
        if aid_str not in self.kernels:
            return "not_started"
        km = self.kernels[aid_str]
        try:
            if km.is_alive():
                return "connected"
            else:
                return "dead"
        except Exception:
            return "unknown"

    def get_or_create_kernel(self, analysis_id: uuid.UUID) -> jupyter_client.KernelClient:
        aid_str = str(analysis_id)
        if aid_str not in self.kernels:
            logger.info(f"Starting new Jupyter Kernel for Analysis {aid_str}")
            km = jupyter_client.KernelManager(kernel_name='python3')
            km.start_kernel()
            kc = km.client()
            kc.start_channels()
            try:
                kc.wait_for_ready(timeout=10)
            except RuntimeError:
                logger.warning(f"Kernel for {aid_str} took too long to become ready, proceeding anyway.")
            
            self.kernels[aid_str] = km
            self.clients[aid_str] = kc
            
            # Setup environment with pre-imports, inline plotting, and a lazy DuckDB wrapper.
            # IMPORTANT: We do NOT hold a persistent duckdb connection in the kernel process.
            # A persistent connection (even read_only=True) would conflict with the main backend's
            # read-write DuckDBManager connection via OS-level file locking.
            # Instead, _LazyDuckDB opens a fresh connection per execute() call and closes it
            startup_code = f"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import json as _json
import urllib.request as _urllib_req
import urllib.error as _urllib_err
%matplotlib inline
pd.set_option('display.notebook_repr_html', True)

_RAVIOLI_QUERY_URL = 'http://localhost:8000/api/v1/data/query'

class _LazyDuckDBResult:
    \"\"\"Holds eagerly-fetched results so .df() / .fetchall() / .fetchone() all work.\"\"\"
    def __init__(self, df):
        self._df = df
    def df(self):
        return self._df
    def fetchdf(self):
        return self._df
    def fetchall(self):
        return [tuple(r) for r in self._df.itertuples(index=False)]
    def fetchone(self):
        rows = self.fetchall()
        return rows[0] if rows else None
    def __repr__(self):
        return repr(self._df)

class _LazyDuckDB:
    \"\"\"Routes queries through the backend HTTP API to avoid cross-process DuckDB file lock conflicts.\"\"\"
    def __init__(self, url):
        self._url = url
    def execute(self, sql, *args):
        payload = _json.dumps({{'sql': sql}}).encode('utf-8')
        req = _urllib_req.Request(self._url, data=payload, headers={{'Content-Type': 'application/json'}})
        try:
            with _urllib_req.urlopen(req, timeout=60) as resp:
                body = _json.loads(resp.read())
        except _urllib_err.HTTPError as e:
            detail = ''
            try:
                detail = _json.loads(e.read()).get('detail', str(e))
            except Exception:
                detail = str(e)
            raise RuntimeError(f'DuckDB query failed: {{detail}}') from None
        columns = body.get('columns', [])
        data = body.get('data', [])
        import pandas as _pd
        df = _pd.DataFrame(data, columns=columns)
        return _LazyDuckDBResult(df)

    def table(self, table_name):
        \"\"\"Convenience method to load an entire table directly into a DataFrame.\"\"\"
        return self.execute(f'SELECT * FROM {{table_name}}').df()

try:
    con = _LazyDuckDB(_RAVIOLI_QUERY_URL)

    _original_read_sql = pd.read_sql
    def _patched_read_sql(sql, con=None, **kwargs):
        \"\"\"Patched pd.read_sql that automatically uses the DuckDB proxy if no con is provided.\"\"\"
        if con is None:
            return globals()['con'].execute(sql).df()
        return _original_read_sql(sql, con=con, **kwargs)
    pd.read_sql = _patched_read_sql

    # Pre-load available tables so users can inspect them with `tables`
    tables = con.execute("SHOW ALL TABLES").df()[['schema', 'name']].copy()
    tables.columns = ['schema', 'table']
    print("\\n🟢 Ravioli kernel ready — DuckDB connected.")
    print("Available tables (use `tables` to see full list):")
    for _, row in tables.iterrows():
        print("  → " + str(row['schema']) + "." + str(row['table']))
    print("\\nExample: df = con.table('{{}}.{{}}')".format(
        tables.iloc[0]['schema'] if len(tables) > 0 else 'schema',
        tables.iloc[0]['table'] if len(tables) > 0 else 'table'
    ))
except Exception as _e:
    import logging as _logging
    _logging.getLogger('IPython').warning("DuckDB proxy wrapper init failed: " + str(_e))
"""
            kc.execute(startup_code)

            
        return self.clients[aid_str]

    def execute_code(self, analysis_id: uuid.UUID, code: str) -> List[dict]:
        """
        Executes code in the dedicated kernel and returns a list of parsed outputs.
        """
        kc = self.get_or_create_kernel(analysis_id)
        msg_id = kc.execute(code)
        
        outputs = []
        
        while True:
            try:
                msg = kc.get_iopub_msg(timeout=10)
                msg_type = msg['header']['msg_type']
                content = msg['content']
                parent_id = msg['parent_header'].get('msg_id')
                
                # Only listen to messages resulting from our execution
                if parent_id != msg_id:
                    continue
                    
                if msg_type == 'status':
                    if content['execution_state'] == 'idle':
                        break
                
                elif msg_type == 'stream':
                    outputs.append({
                        'type': 'stream',
                        'name': content.get('name', 'stdout'),
                        'text': content.get('text', '')
                    })
                    
                elif msg_type in ('execute_result', 'display_data'):
                    outputs.append({
                        'type': msg_type,
                        'data': content.get('data', {})
                    })
                    
                elif msg_type == 'error':
                    outputs.append({
                        'type': 'error',
                        'ename': content.get('ename', ''),
                        'evalue': content.get('evalue', ''),
                        'traceback': content.get('traceback', [])
                    })
            except Empty:
                logger.warning(f"Timeout waiting for Jupyter kernel output on analysis {analysis_id}")
                break
                
        return outputs

jupyter_manager = JupyterManager()
