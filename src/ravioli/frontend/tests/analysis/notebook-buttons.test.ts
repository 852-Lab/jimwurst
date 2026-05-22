import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderNotebookView, updateNotebookView } from '../../src/components/analysis/notebook/NotebookView';
import { store } from '../../src/store';
import type { Analysis } from '../../src/types';

function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: 'analysis-1',
    title: 'Notebook test',
    status: 'pending',
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
    analysis_metadata: { type: 'notebook' },
    ...overrides,
  };
}

function resetStore() {
  store.setAnalyses([]);
  store.setLogs([]);
  store.setDataSources([]);
  store.setKnowledgePages([]);
  store.setActiveAnalysisId(undefined);
  store.setCurrentView('insights');
}

describe('notebook cell buttons', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    resetStore();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the footer add-cell buttons in AI, SQL, Python, Markdown order', () => {
    const container = renderNotebookView();
    document.body.appendChild(container);

    const labels = Array.from(container.querySelectorAll('#add-cell-bar .btn-add-cell')).map(button =>
      button.textContent?.replace(/\s+/g, ' ').trim()
    );

    expect(labels).toEqual(['AI Cell', 'SQL Cell', 'Python Cell', 'Text / Markdown']);
  });

  it('renders the welcome-state first-cell buttons in AI, SQL, Python, Markdown order', () => {
    store.setAnalyses([makeAnalysis()]);
    store.setActiveAnalysisId('analysis-1');

    const container = renderNotebookView();
    document.body.appendChild(container);
    updateNotebookView(container);

    const labels = Array.from(container.querySelectorAll('#notebook-welcome .btn-first-cell')).map(button =>
      button.textContent?.replace(/\s+/g, ' ').trim()
    );

    expect(labels).toHaveLength(4);
    expect(labels[0]).toContain('AI Cell');
    expect(labels[1]).toContain('SQL Cell');
    expect(labels[2]).toContain('Python Cell');
    expect(labels[3]).toContain('Text / Markdown');
  });

  it('opens a chat-backed draft cell when the first AI Cell button is clicked', () => {
    store.setAnalyses([makeAnalysis()]);
    store.setActiveAnalysisId('analysis-1');

    const container = renderNotebookView();
    document.body.appendChild(container);
    updateNotebookView(container);

    (container.querySelector('#notebook-welcome .btn-first-cell[data-type="chat"]') as HTMLButtonElement).click();

    const newCell = container.querySelector('.new-cell-block');
    expect(newCell).not.toBeNull();
    expect(container.querySelector('#notebook-welcome')).toBeNull();
    expect((container.querySelector('.btn-execute-new-cell') as HTMLButtonElement).dataset.type).toBe('chat');
    expect((container.querySelector('textarea[id^="cell-input-"]') as HTMLTextAreaElement).placeholder).toBe('Enter AI instruction...');
  });
});
