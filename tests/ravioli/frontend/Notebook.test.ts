import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderNotebook, updateNotebookUI } from '../../../src/ravioli/frontend/src/components/Notebook';
import { store } from '../../../src/ravioli/frontend/src/store';

// Mock the api
vi.mock('../../../src/ravioli/frontend/src/services/api', () => ({
  api: {
    listLogs: vi.fn(),
    getJupyterStatus: vi.fn().mockResolvedValue({ status: 'connected' }),
    deleteLog: vi.fn().mockResolvedValue(undefined),
    executeSql: vi.fn().mockResolvedValue(undefined),
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

  it('triggers delete confirmation and API call on delete button click', async () => {
    const mockAnalysis = { id: 'a1', title: 'Deep Research', status: 'completed' };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
      { id: 'l1', content: 'Delete me cell', log_type: 'user_query', tool_name: 'markdown' }
    ] as any);

    const notebook = renderNotebook();
    const deleteBtn = notebook.querySelector('.btn-delete-cell') as HTMLElement;
    expect(deleteBtn).not.toBeNull();

    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = vi.fn().mockReturnValue(true);
    
    // Import api from the mock to spy on deleteLog
    const { api } = await import('../../../src/ravioli/frontend/src/services/api');

    deleteBtn.click();

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this cell?');
    expect(api.deleteLog).toHaveBeenCalledWith('l1');

    window.confirm = originalConfirm;
  });

  it('covers SQL cells: renders with vertical gutter, updates highlighting, and triggers executeSql on rerun', async () => {
    const mockAnalysis = { id: 'a1', title: 'SQL Testing', status: 'completed' };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
      { id: 'l1', content: 'SELECT * FROM ravioli', log_type: 'user_query', tool_name: 'sql', index: 1 }
    ] as any);

    const notebook = renderNotebook();

    // Verify SQL cell static view and capsular LOC displays correctly
    expect(notebook.textContent).toContain('SELECT * FROM ravioli');
    expect(notebook.textContent).toContain('SQL • 1 line');

    // Trigger edit mode
    const staticView = notebook.querySelector('#cell-static-1') as HTMLElement;
    staticView.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    // Verify edit mode elements (gutter + highlight backdrop + textarea exist)
    const gutter = notebook.querySelector('#cell-gutter-1') as HTMLElement;
    const highlight = notebook.querySelector('#cell-highlight-1') as HTMLElement;
    const textarea = notebook.querySelector('#cell-input-1') as HTMLTextAreaElement;

    expect(gutter).not.toBeNull();
    expect(highlight).not.toBeNull();
    expect(textarea).not.toBeNull();
    expect(gutter.textContent).toBe('1');

    // Change input value and dispatch focusin / input event
    textarea.value = 'SELECT *\nFROM tables\nLIMIT 10';
    textarea.dispatchEvent(new Event('focusin', { bubbles: true }));
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Verify live updates of LOC capsule, gutter, and highlight backdrop HTML
    const label = notebook.querySelector('#cell-loc-1') as HTMLElement;
    expect(label.textContent).toBe('3 lines');
    expect(gutter.textContent).toBe('1\n2\n3');
    // Backdrop should contain beautifully formatted keywords
    expect(highlight.innerHTML).toContain('text-sky-400');
    expect(highlight.innerHTML).toContain('SELECT');

    // Spy on executeSql and click rerun
    const { api } = await import('../../../src/ravioli/frontend/src/services/api');
    const rerunBtn = notebook.querySelector('.btn-rerun-cell') as HTMLElement;
    expect(rerunBtn).not.toBeNull();

    rerunBtn.click();
    expect(api.executeSql).toHaveBeenCalled();
  });

  it('renders AI chat cells correctly and handles streaming', async () => {
    const mockAnalysis = { id: 'a1', title: 'AI Testing', status: 'completed' };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
      { id: 'l1', content: 'Tell me a joke', log_type: 'user_query', tool_name: 'chat', index: 1 }
    ] as any);

    const notebook = renderNotebook();

    // Verify AI chat cell displays properly with user prompt
    expect(notebook.textContent).toContain('Tell me a joke');
    expect(notebook.innerHTML).toContain('auto_awesome'); // AI icon check

    // Trigger run cell
    const { api } = await import('../../../src/ravioli/frontend/src/services/api');
    const playBtn = notebook.querySelector('.btn-rerun-cell') as HTMLElement;
    expect(playBtn).not.toBeNull();

    // Mock streamQuestion to simulate SSE chunks
    (api.streamQuestion as any) = vi.fn().mockImplementation((analysisId, question, replaceLogId, insertAfterLogId, onMessage, onComplete) => {
      onMessage('Why did the chicken...');
      onMessage(' cross the road?');
      onComplete();
    });

    playBtn.click();

    // Verify stream processing
    expect(api.streamQuestion).toHaveBeenCalled();
    // After stream chunks are pushed, the text content should be updated (via DOM manipulation in Notebook)
    const streamContentContainer = notebook.querySelector('#streaming-content-1');
    expect(streamContentContainer).not.toBeNull();
    // In our Notebook.ts implementation, streaming output is placed dynamically into `#streaming-content`
  });

  it('populates cellContainer on initial render even if logs match previous state', () => {
    // Setup an analysis with NO logs
    const mockAnalysis = { id: 'a1', title: 'Empty Analysis', status: 'completed' };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([]);
    
    // First render to set lastLogsJson to '[]'
    const notebook1 = renderNotebook();
    
    // Switch to another analysis also with NO logs
    const mockAnalysis2 = { id: 'a2', title: 'Another Empty Analysis', status: 'completed' };
    store.setAnalyses([mockAnalysis, mockAnalysis2] as any);
    store.setActiveAnalysisId('a2');
    store.setLogs([]);
    
    // Render again! isInitial will be true since renderNotebook creates a new container.
    // If the fix is correct, it should bypass the logsJson !== lastLogsJson check and populate.
    const notebook2 = renderNotebook();
    
    const cellContainer = notebook2.querySelector('#cell-container');
    expect(cellContainer).not.toBeNull();
    
    // It should contain the notebook welcome text (the empty state content, not a completely blank container)
    expect(cellContainer?.innerHTML).toContain('Start your analysis');
    expect(cellContainer?.innerHTML).toContain('Choose a cell type to begin');
  });
});
