import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderAnalysis, updateAnalysisUI } from '../../../src/ravioli/frontend/src/components/analysis/AnalysisShell';
import { store } from '../../../src/ravioli/frontend/src/store';

// Mock the api
vi.mock('../../../src/ravioli/frontend/src/services/api', () => ({
  api: {
    listLogs: vi.fn(),
    getJupyterStatus: vi.fn().mockResolvedValue({ status: 'connected' }),
    deleteLog: vi.fn().mockResolvedValue(undefined),
    executeSql: vi.fn().mockResolvedValue(undefined),
    executePython: vi.fn().mockResolvedValue(undefined),
    streamQuestion: vi.fn(),
  }
}));

// Mock templates to verify renderChart is called
vi.mock('../../../src/ravioli/frontend/src/components/analysis/notebook/templates', async () => {
  const actual = await vi.importActual<any>('../../../src/ravioli/frontend/src/components/analysis/notebook/templates');
  return {
    ...actual,
    renderChart: vi.fn()
  };
});

describe('AnalysisShell Component - Stability & Granular Updates', () => {
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
      analysis_metadata: { type: 'quick_insight' }
    };
    const mockLogs = [
      { id: 'l1', content: 'Step 1 complete', log_type: 'agent_response' }
    ];
    
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs(mockLogs as any);
    
    const notebook = renderAnalysis();
    expect(notebook.textContent).toContain('Deep Research');
    expect(notebook.textContent).toContain('Step 1 complete');
    expect(notebook.querySelector('#quick-insight-bar')).not.toBeNull();
  });

  it('mitigation: updates logs without replacing the main container', () => {
    const mockAnalysis = { id: 'a1', title: 'Deep Research', status: 'completed', analysis_metadata: { type: 'quick_insight' } };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([{ id: 'l1', content: 'Initial log', log_type: 'agent_response' }] as any);
    
    const notebook = renderAnalysis();
    (notebook as any).__test_marker = 'persistent';
    
    // Simulate background poll finding a new log
    const updatedLogs = [
      { id: 'l1', content: 'Initial log', log_type: 'agent_response' },
      { id: 'l2', content: 'New background log', log_type: 'agent_response' }
    ];
    store.setLogs(updatedLogs as any);
    
    // Trigger granular update (like main.ts does)
    updateAnalysisUI(notebook);
    
    // Verify reference stability
    expect((notebook as any).__test_marker).toBe('persistent');
    
    // Verify content update
    expect(notebook.textContent).toContain('New background log');
    
    // Verify the add-cell bar still exists and hasn't been destroyed by the update.
    const addBar = notebook.querySelector('#quick-insight-bar') as HTMLElement;
    expect(addBar).not.toBeNull();
  });

  it('mitigation: does NOT update logs if a streaming bubble is present', () => {
    const mockAnalysis = { id: 'a1', title: 'Deep Research', status: 'completed', analysis_metadata: { type: 'notebook' } };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([{ id: 'l1', content: 'Log 1', log_type: 'agent_response' }] as any);
    
    const notebook = renderAnalysis();
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
    updateAnalysisUI(notebook);
    
    // Log 2 should NOT be rendered yet because we are streaming
    expect(notebook.textContent).not.toContain('Log 2');
    expect(notebook.textContent).toContain('I am currently streaming...');
  });

  it('renders markdown cells correctly', () => {
    const mockAnalysis = { id: 'a1', title: 'Deep Research', status: 'completed', analysis_metadata: { type: 'notebook' } };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
      { id: 'l1', content: '# Welcome to Markdown\nThis is **bold** text.', log_type: 'user_query', tool_name: 'markdown' }
    ] as any);

    const notebook = renderAnalysis();
    expect(notebook.querySelector('.cell-static-view')).not.toBeNull();
    expect(notebook.textContent).toContain('Welcome to Markdown');
    expect(notebook.querySelector('strong')?.textContent).toBe('bold');
  });

  it('triggers editing view when double-clicking static cell view', () => {
    const mockAnalysis = { id: 'a1', title: 'Deep Research', status: 'completed', analysis_metadata: { type: 'notebook' } };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
      { id: 'l1', content: 'Double click test', log_type: 'user_query', tool_name: 'markdown' }
    ] as any);

    const notebook = renderAnalysis();
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
    const mockAnalysis = { id: 'a1', title: 'Deep Research', status: 'completed', analysis_metadata: { type: 'notebook' } };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
      { id: 'l1', content: 'Delete me cell', log_type: 'user_query', tool_name: 'markdown' }
    ] as any);

    const notebook = renderAnalysis();
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
    const mockAnalysis = { id: 'a1', title: 'SQL Testing', status: 'completed', analysis_metadata: { type: 'notebook' } };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
      { id: 'l1', content: 'SELECT * FROM ravioli', log_type: 'user_query', tool_name: 'sql', index: 1 }
    ] as any);

    const notebook = renderAnalysis();

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
    const mockAnalysis = { id: 'a1', title: 'AI Testing', status: 'completed', analysis_metadata: { type: 'notebook' } };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
      { id: 'l1', content: 'Tell me a joke', log_type: 'user_query', tool_name: 'chat', index: 1 }
    ] as any);

    const notebook = renderAnalysis();

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
    expect(notebook.textContent).toContain('Why did the chicken');
    // In our Notebook.ts implementation, streaming output is placed dynamically into `#streaming-content`
  });

  it('populates cellContainer on initial render even if logs match previous state', () => {
    // Setup an analysis with NO logs
    const mockAnalysis = { id: 'a1', title: 'Empty Analysis', status: 'completed', analysis_metadata: { type: 'notebook' } };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([]);
    
    // First render to set lastLogsJson to '[]'
    renderAnalysis();
    
    // Switch to another analysis also with NO logs
    const mockAnalysis2 = { id: 'a2', title: 'Another Empty Analysis', status: 'completed', analysis_metadata: { type: 'notebook' } };
    store.setAnalyses([mockAnalysis, mockAnalysis2] as any);
    store.setActiveAnalysisId('a2');
    store.setLogs([]);
    
    // Render again! isInitial will be true since renderNotebook creates a new container.
    // If the fix is correct, it should bypass the logsJson !== lastLogsJson check and populate.
    const notebook2 = renderAnalysis();
    
    const cellContainer = notebook2.querySelector('#cell-container');
    expect(cellContainer).not.toBeNull();
    
    // It should contain the notebook welcome text (the empty state content, not a completely blank container)
    expect(cellContainer?.innerHTML).toContain('Start your analysis');
    expect(cellContainer?.innerHTML).toContain('Choose a cell type to begin');
  });

  it('handles quick insight stream properly: ignores VIZ tag, removes streaming ID, and renders chart', async () => {
    const mockAnalysis = { id: 'a1', title: 'Quick Insight Test', status: 'completed', analysis_metadata: { type: 'quick_insight' } };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
       { id: 'l1', content: 'Init', log_type: 'thought' }
    ] as any);

    const notebook = renderAnalysis();
    
    // Type in chat input and send
    const textarea = notebook.querySelector('#quick-insight-chat-input') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    textarea.value = 'Show me a chart';
    
    const sendBtn = notebook.querySelector('#btn-quick-insight-send') as HTMLButtonElement;
    expect(sendBtn).not.toBeNull();
    
    // Import API to mock streamQuestion
    const { api } = await import('../../../src/ravioli/frontend/src/services/api');
    
    let streamOnMessage: any;
    let streamOnComplete: any;
    
    (api.streamQuestion as any).mockImplementation((analysisId: string, question: string, replaceLogId: string | null, insertAfterLogId: string | null, onMessage: any, onComplete: any, onError: any) => {
      streamOnMessage = onMessage;
      streamOnComplete = onComplete;
    });
    
    // Click send
    sendBtn.click();
    
    expect(api.streamQuestion).toHaveBeenCalled();
    
    // Send some tokens
    streamOnMessage('Here ');
    streamOnMessage('is ');
    streamOnMessage('a ');
    streamOnMessage('chart.');
    streamOnMessage('[VIZ]{ "type": "chart" }'); // This should be ignored
    
    // Check if streaming content exists and does NOT contain VIZ
    const cellContainer = notebook.querySelector('#cell-container') as HTMLElement;
    const streamingContent = cellContainer.querySelector('[id^="streaming-content-temp-"]') as HTMLElement;
    expect(streamingContent).not.toBeNull();
    expect(streamingContent.textContent).not.toContain('[VIZ]');
    expect(streamingContent.textContent).toContain('Here is a chart.');
    
    // Complete stream
    (api.listLogs as any).mockResolvedValue([
       { id: 'l1', content: 'Init', log_type: 'thought' },
       { id: 'l2', content: 'Show me a chart', log_type: 'user_query' },
       { id: 'l3', content: 'Here is a chart.', log_type: 'thought', data: { type: 'chart', title: 'My Chart' } }
    ]);
    
    await streamOnComplete();
    
    // Verify ID is removed so DOM state is unlocked
    expect(streamingContent.hasAttribute('id')).toBe(false);
    
    // Trigger update manually (normally done by main.ts store subscription)
    updateAnalysisUI(notebook);
    
    // Let event loop process
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // The QuickInsightView should have rendered the chart log and called renderChart
    const { renderChart } = await import('../../../src/ravioli/frontend/src/components/analysis/notebook/templates');
    expect(renderChart).toHaveBeenCalled();
  });

  it('mitigation: ensures rerunning an existing Python cell scrubs the streaming-content ID', async () => {
    const mockAnalysis = { id: 'a1', title: 'Python Test', status: 'completed', analysis_metadata: { type: 'notebook' } };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([
      { id: 'l1', content: 'print("hello")', log_type: 'user_query', tool_name: 'python', index: 1 }
    ] as any);

    const notebook = renderAnalysis();
    
    const { api } = await import('../../../src/ravioli/frontend/src/services/api');
    
    // Simulate clicking rerun
    const rerunBtn = notebook.querySelector('.btn-rerun-cell') as HTMLElement;
    expect(rerunBtn).not.toBeNull();
    
    // Mock the API response
    (api.executePython as any).mockResolvedValue(undefined);
    (api.listLogs as any).mockResolvedValue([{ id: 'l1', content: 'print("hello")', log_type: 'user_query', tool_name: 'python', index: 1 }]);
    
    // Click the rerun button and wait for the async execution
    rerunBtn.click();
    
    // Wait for the async click handler to resolve executePython and remove the ID
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Check if the DOM has any element with id starting with streaming-content
    // This is the bug that blocked updateAnalysisUI previously
    const streamingContent = notebook.querySelector('[id^="streaming-content"]');
    expect(streamingContent).toBeNull();
  });

  it('mitigation: ensures executing a new Python cell removes the streaming-content ID from the cell block', async () => {
    const mockAnalysis = { id: 'a1', title: 'Python Test', status: 'completed', analysis_metadata: { type: 'notebook' } };
    store.setAnalyses([mockAnalysis] as any);
    store.setActiveAnalysisId('a1');
    store.setLogs([] as any);

    const notebook = renderAnalysis();
    
    // Click the 'First cell' button for python to generate the .new-cell-block
    const firstPythonBtn = notebook.querySelector('.btn-first-cell[data-type="python"]') as HTMLElement;
    if (firstPythonBtn) {
      firstPythonBtn.click();
    }
    
    const newCellBlock = notebook.querySelector('.new-cell-block') as HTMLElement;
    expect(newCellBlock).not.toBeNull();
    
    const runNewBtn = notebook.querySelector('.btn-execute-new-cell') as HTMLElement;
    expect(runNewBtn).not.toBeNull();
    
    // The event handler early-returns if the input is empty. Fill it first!
    const textarea = newCellBlock.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'print("hello")';
    
    const { api } = await import('../../../src/ravioli/frontend/src/services/api');
    (api.executePython as any).mockResolvedValue(undefined);
    (api.listLogs as any).mockResolvedValue([]);
    
    runNewBtn.click();
    
    // Wait for the async click handler to resolve executePython and remove the block
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // The new cell block should be removed
    expect(notebook.querySelector('.new-cell-block')).toBeNull();
    // And no streaming-content ID should be lingering anywhere in the notebook container
    expect(notebook.querySelector('[id^="streaming-content"]')).toBeNull();
  });
});
