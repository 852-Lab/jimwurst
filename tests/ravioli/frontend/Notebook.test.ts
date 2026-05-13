import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderNotebook, updateNotebookUI } from '../../../src/ravioli/frontend/src/components/Notebook';
import { store } from '../../../src/ravioli/frontend/src/store';

// Mock the api
vi.mock('../../../src/ravioli/frontend/src/services/api', () => ({
  api: {
    listLogs: vi.fn(),
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
    expect(notebook.querySelector('#cell-input')).not.toBeNull();
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
    
    // Verify input field was NOT reset (focus/value would be preserved in a real browser, 
    // here we just check it still exists and hasn't been recreated in a way that wipes it if we had a value).
    const input = notebook.querySelector('#cell-input') as HTMLTextAreaElement;
    expect(input).not.toBeNull();
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
});
