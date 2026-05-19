import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderNotebook, updateNotebookUI } from '../../../src/ravioli/frontend/src/components/Notebook';
import { store } from '../../../src/ravioli/frontend/src/store';

// Mock the api
vi.mock('../../../src/ravioli/frontend/src/services/api', () => ({
  api: {
    listLogs: vi.fn(),
    getJupyterStatus: vi.fn().mockResolvedValue({ status: 'connected' }),
  }
}));

describe('Notebook Component - Stability & Granular Updates', () => {
  beforeEach(() => {
    // Reset store state
    store.setAnalyses([]);
    store.setLogs([]);
    store.setCurrentUser({
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      status: 'active',
    } as any);
  });

  it('renders active analysis and logs', () => {
    const mockAnalysis = {
      id: 'a1',
      title: 'Deep Research',
      status: 'completed',
    };
    const mockLogs = [
      { id: 'l1', content: 'Step 1 complete', log_type: 'agent_response' }
    ];
    
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs(mockLogs as any);
    
    const notebook = renderNotebook();
    expect(notebook.textContent).toContain('Deep Research');
    expect(notebook.textContent).toContain('Step 1 complete');
    expect(notebook.querySelector('#add-cell-bar')).not.toBeNull();
  });

  it('mitigation: updates logs without replacing the main container', () => {
    const mockAnalysis = { id: 'a1', title: 'Deep Research', status: 'completed' };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([{ id: 'l1', content: 'Initial log', log_type: 'agent_response' }] as any);
    
    const notebook = renderNotebook();
    (notebook as any).__test_marker = 'persistent';
    
    // Simulate background poll finding a new log
    const updatedLogs = [
      { id: 'l1', content: 'Initial log', log_type: 'agent_response' },
      { id: 'l2', content: 'New background log', log_type: 'agent_response' }
    ];
    store.setLogs(updatedLogs as any);
    
    // Trigger granular update (like main.ts does)
    updateNotebookUI(notebook);
    
    // Verify reference stability
    expect((notebook as any).__test_marker).toBe('persistent');
    
    // Verify content update
    expect(notebook.textContent).toContain('New background log');
    
    // Verify the add-cell bar still exists and hasn't been destroyed by the update.
    const addBar = notebook.querySelector('#add-cell-bar') as HTMLElement;
    expect(addBar).not.toBeNull();
  });

  it('mitigation: does NOT update logs if a streaming bubble is present', () => {
    const mockAnalysis = { id: 'a1', title: 'Deep Research', status: 'completed' };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([{ id: 'l1', content: 'Log 1', log_type: 'agent_response' }] as any);
    
    const notebook = renderNotebook();
    const cellContainer = notebook.querySelector('#cell-container')!;
    
    // Simulate an active stream by adding a streaming-content marker
    const streamBubble = document.createElement('div');
    streamBubble.id = 'streaming-content';
    streamBubble.textContent = 'I am currently streaming...';
    cellContainer.appendChild(streamBubble);
    
    // Simulate background poll finding a new log
    const updatedLogs = [
      { id: 'l1', content: 'Log 1', log_type: 'agent_response' },
      { id: 'l2', content: 'Log 2', log_type: 'agent_response' }
    ];
    store.setLogs(updatedLogs as any);
    
    // Trigger update
    updateNotebookUI(notebook);
    
    // Log 2 should NOT be rendered yet because we are streaming
    expect(notebook.textContent).not.toContain('Log 2');
    expect(notebook.textContent).toContain('I am currently streaming...');
  });

  it('renders markdown cells correctly', () => {
    const mockAnalysis = { id: 'a1', title: 'Deep Research', status: 'completed' };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
      { id: 'l1', content: '# Welcome to Markdown\nThis is **bold** text.', log_type: 'user_query', tool_name: 'markdown' }
    ] as any);

    const notebook = renderNotebook();
    expect(notebook.querySelector('.cell-static-view')).not.toBeNull();
    expect(notebook.textContent).toContain('Welcome to Markdown');
    expect(notebook.querySelector('strong')?.textContent).toBe('bold');
  });

  it('triggers editing view when double-clicking static cell view', () => {
    const mockAnalysis = { id: 'a1', title: 'Deep Research', status: 'completed' };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
      { id: 'l1', content: 'Double click test', log_type: 'user_query', tool_name: 'markdown' }
    ] as any);

    const notebook = renderNotebook();
    const staticView = notebook.querySelector('#cell-static-1') as HTMLElement;
    const editView = notebook.querySelector('#cell-edit-1') as HTMLElement;

    expect(staticView.classList.contains('hidden')).toBe(false);
    expect(editView.classList.contains('hidden')).toBe(true);

    // Simulate double click
    staticView.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(staticView.classList.contains('hidden')).toBe(true);
    expect(editView.classList.contains('hidden')).toBe(false);
  });
});
