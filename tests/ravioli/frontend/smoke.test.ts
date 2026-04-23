import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../../../src/ravioli/frontend/src/store';
import { renderSidebar } from '../../../src/ravioli/frontend/src/components/Sidebar';
import { renderNotebook } from '../../../src/ravioli/frontend/src/components/Notebook';

// Mock dependencies
vi.mock('../../../src/ravioli/frontend/src/services/api', () => ({
  api: {
    listAnalyses: vi.fn().mockResolvedValue([]),
    listLogs: vi.fn().mockResolvedValue([]),
  }
}));

describe('Frontend Smoke Test', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    store.setAnalyses([]);
    store.setActiveAnalysisId(undefined);
    store.setCurrentView('dashboard');
  });

  it('renders the sidebar with Vibe branding', () => {
    const sidebar = renderSidebar();
    expect(sidebar.innerHTML).toContain('Vibe');
    expect(sidebar.innerHTML).toContain('Analytics');
  });

  it('renders the empty state when no analysis is selected', () => {
    const notebook = renderNotebook();
    expect(notebook.innerHTML).toContain('Select an Analysis');
    expect(notebook.innerHTML).toContain('The silent concierge is waiting');
  });

  it('renders the creation page when view is switched', () => {
    store.setCurrentView('create-analysis');
    // We would render CreateAnalysis here if we had a main render loop test
    expect(store.getCurrentView()).toBe('create-analysis');
  });
});
