import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderCreateAnalysis } from '../../src/components/analysis/create-analysis/CreateAnalysis';
import { api } from '../../src/services/api';
import { store } from '../../src/store';
import type { Analysis, DataSource, KnowledgePage } from '../../src/types';

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function makeDataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: 'ds-1',
    filename: 'sales.csv',
    original_filename: 'sales.csv',
    content_type: 'text/csv',
    size_bytes: 2048,
    table_name: 'sales',
    schema_name: 'manual',
    row_count: 12,
    status: 'completed',
    has_pii: false,
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
    ...overrides,
  };
}

function makeKnowledgePage(overrides: Partial<KnowledgePage> = {}): KnowledgePage {
  return {
    id: 'kp-1',
    title: 'Revenue context',
    properties: {},
    ownership_type: 'individual',
    source: 'manual',
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
    ...overrides,
  };
}

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

describe('create analysis flow', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.stubGlobal('alert', vi.fn());
    resetStore();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('renders the three create-analysis options in the expected order', () => {
    const container = renderCreateAnalysis();
    document.body.appendChild(container);

    const optionTitles = Array.from(container.querySelectorAll('h3')).map(node => node.textContent?.trim());

    expect(optionTitles).toEqual(['Quick Insights', 'Deep Dive', 'Custom Notebook']);
    expect(container.querySelector('[aria-disabled="true"]')?.textContent).toContain('Deep Dive');
    expect(container.querySelector('[aria-disabled="true"]')?.textContent).toContain('Coming Soon');
  });

  it('loads completed existing files when Quick Insights is selected', async () => {
    vi.spyOn(api, 'listFiles').mockResolvedValue([
      makeDataSource(),
      makeDataSource({ id: 'ds-2', original_filename: 'draft.csv', filename: 'draft.csv', status: 'pending' }),
    ]);

    const container = renderCreateAnalysis();
    document.body.appendChild(container);

    (container.querySelector('#mode-quick') as HTMLButtonElement).click();
    await flushPromises();
    await flushPromises();

    expect(api.listFiles).toHaveBeenCalledTimes(1);
    expect(container.querySelector('h2')?.textContent).toContain('Quick Insights');

    const fileButtons = Array.from(container.querySelectorAll('.existing-file-item'));
    expect(fileButtons).toHaveLength(1);
    expect(fileButtons[0].textContent).toContain('sales.csv');
  });

  it('creates a notebook analysis with notebook metadata from the custom notebook path', async () => {
    store.setDataSources([makeDataSource()]);
    store.setKnowledgePages([makeKnowledgePage()]);

    const createAnalysisSpy = vi.spyOn(api, 'createAnalysis').mockResolvedValue(
      makeAnalysis({
        id: 'analysis-new',
        title: 'Q3 Review',
        description: 'Deep notebook',
        analysis_metadata: {
          type: 'notebook',
          data_sources: ['ds-1'],
          knowledge_pages: ['kp-1'],
        },
      })
    );

    const container = renderCreateAnalysis();
    document.body.appendChild(container);

    (container.querySelector('#mode-notebook') as HTMLButtonElement).click();

    (container.querySelector('#analysis-title') as HTMLInputElement).value = 'Q3 Review';
    (container.querySelector('#analysis-desc') as HTMLTextAreaElement).value = 'Deep notebook';
    (container.querySelector('.ds-select-btn') as HTMLButtonElement).click();
    (container.querySelector('.kp-select-btn') as HTMLButtonElement).click();
    (container.querySelector('#confirm-create') as HTMLButtonElement).click();

    await flushPromises();
    await flushPromises();

    expect(createAnalysisSpy).toHaveBeenCalledWith({
      title: 'Q3 Review',
      description: 'Deep notebook',
      analysis_metadata: {
        type: 'notebook',
        data_sources: ['ds-1'],
        knowledge_pages: ['kp-1'],
      },
    });
    expect(store.getActiveAnalysisId()).toBe('analysis-new');
  });
});
