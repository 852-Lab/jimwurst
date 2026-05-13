import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderSidebar, updateSidebarUI } from '../../../src/ravioli/frontend/src/components/Sidebar';
import { store } from '../../../src/ravioli/frontend/src/store';

// Mock the api
vi.mock('../../../src/ravioli/frontend/src/services/api', () => ({
  api: {
    logout: vi.fn(),
  }
}));


describe('Sidebar Component - Historical Analyses', () => {
  beforeEach(() => {
    // Reset store state
    store.setAnalyses([]);
    store.setCurrentUser({
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as any);
    store.setCurrentView('insights');
    store.setActiveAnalysisId(undefined);
  });

  it('renders "No Analyses found" when analyses list is empty', () => {
    const sidebar = renderSidebar();
    const analysisList = sidebar.querySelector('#analysis-list');
    
    expect(analysisList).not.toBeNull();
    expect(analysisList?.textContent).toContain('No Analyses found');
  });

  it('renders historical analyses when present in store', () => {
    const mockAnalyses = [
      {
        id: 'a1',
        title: 'Q1 Revenue Analysis',
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        owner_type: 'user',
      },
      {
        id: 'a2',
        title: 'Churn Prediction',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        owner_type: 'user',
      }
    ];
    
    store.setAnalyses(mockAnalyses as any);
    
    const sidebar = renderSidebar();
    const analysisList = sidebar.querySelector('#analysis-list');
    
    expect(analysisList).not.toBeNull();
    
    // Should not contain the empty state text
    expect(analysisList?.textContent).not.toContain('No Analyses found');
    
    // Should render the titles
    expect(analysisList?.textContent).toContain('Q1 Revenue Analysis');
    expect(analysisList?.textContent).toContain('Churn Prediction');
    
    // Should render two buttons for the analyses
    const analysisButtons = sidebar.querySelectorAll('[data-analysis-id]');
    expect(analysisButtons.length).toBe(2);
    expect(analysisButtons[0].getAttribute('data-analysis-id')).toBe('a1');
    expect(analysisButtons[1].getAttribute('data-analysis-id')).toBe('a2');
  });

  it('sets active class on the currently active analysis', () => {
    const mockAnalyses = [
      {
        id: 'a1',
        title: 'Q1 Revenue Analysis',
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        owner_type: 'user',
      }
    ];
    
    store.setAnalyses(mockAnalyses as any);
    store.setActiveAnalysisId('a1');
    
    const sidebar = renderSidebar();
    const activeButton = sidebar.querySelector('[data-analysis-id="a1"]');
    
    expect(activeButton).not.toBeNull();
    expect(activeButton?.className).toContain('active');
  });

  it('updates store when an analysis is clicked', () => {
    const mockAnalyses = [
      {
        id: 'a1',
        title: 'Q1 Revenue Analysis',
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        owner_type: 'user',
      }
    ];
    
    store.setAnalyses(mockAnalyses as any);
    
    const sidebar = renderSidebar();
    const button = sidebar.querySelector('[data-analysis-id="a1"]') as HTMLButtonElement;
    
    // Click the button
    button.click();
    
    // Store should be updated
    expect(store.getActiveAnalysisId()).toBe('a1');
  });
  
  it('mitigation: updates the existing sidebar element instead of replacing it', () => {
    const sidebar = renderSidebar();
    // Add a marker to the DOM element to verify it's the same one
    (sidebar as any).__test_marker = 'stable';
    
    // Add a new analysis to the store
    const mockAnalyses = [
      {
        id: 'a1',
        title: 'New Analysis',
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        owner_type: 'user',
      }
    ];
    store.setAnalyses(mockAnalyses as any);
    
    // Call the update function (main.ts does this on store change)
    updateSidebarUI(sidebar);
    
    // Verify it's the same DOM reference
    expect((sidebar as any).__test_marker).toBe('stable');
    
    // Verify content updated
    expect(sidebar.querySelector('[data-analysis-id="a1"]')).not.toBeNull();
    expect(sidebar.textContent).toContain('New Analysis');
  });
});
