import jupyter_client
import uuid
from typing import Dict, Any, List
from queue import Empty
import logging

logger = logging.getLogger(__name__)

class JupyterManager:
    """
    Manages headless IPython kernels for each Analysis.
    """
    def __init__(self):
        self.kernels: Dict[str, jupyter_client.KernelManager] = {}
        self.clients: Dict[str, jupyter_client.KernelClient] = {}

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
            
            # Setup environment for pandas html rendering
            kc.execute("import pandas as pd; pd.set_option('display.notebook_repr_html', True)")
            
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
