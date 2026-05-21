import { api } from '../../services/api';
import { store } from '../../store';
import { withButtonLoading } from '../utils/dom';

export interface CreateAnalysisContext {
  mode: string;
  existingFiles: any[];
  isFetchingFiles: boolean;
  selectedDataSourceIds: string[];
  selectedKnowledgePageIds: string[];
  updateUI: () => void;
}

export function attachEventListeners(container: HTMLElement, ctx: CreateAnalysisContext) {
    container.querySelector('#cancel-create')?.addEventListener('click', () => {
      store.setCurrentView('dashboard');
    });

    container.querySelector('#back-to-select')?.addEventListener('click', () => {
      ctx.mode = 'select';
      ctx.updateUI();
    });

    container.querySelector('#mode-quick')?.addEventListener('click', async () => {
      ctx.mode = 'quick';
      ctx.updateUI();

      // Fetch existing files
      ctx.isFetchingFiles = true;
      ctx.updateUI();
      try {
        const files = await api.listFiles();
        ctx.existingFiles = files.filter(f => f.status === 'completed');
      } catch (err) {
        console.error('Failed to fetch files', err);
      } finally {
        ctx.isFetchingFiles = false;
        ctx.updateUI();
      }
    });

    container.querySelector('#mode-deep')?.addEventListener('click', () => {
      ctx.mode = 'deep';
      // Reset selected states when re-entering Deep Dive setup
      ctx.selectedDataSourceIds = [];
      ctx.selectedKnowledgePageIds = [];
      ctx.updateUI();
    });

    // Quick Insight Upload
    const dropZone = container.querySelector('#drop-zone');
    const fileInput = container.querySelector('#file-input') as HTMLInputElement;

    dropZone?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFileUpload(container, file);
    });

    dropZone?.addEventListener('dragover', (e: any) => {
      e.preventDefault();
      dropZone.classList.add('border-primary-fixed-dim');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-primary-fixed-dim');
    });

    dropZone?.addEventListener('drop', (e: any) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(container, file);
    });

    // Existing File Selection
    container.querySelectorAll('.existing-file-item').forEach(item => {
      item.addEventListener('click', () => {
        const fileId = item.getAttribute('data-file-id');
        if (fileId) handleExistingFileSelection(container, fileId);
      });
    });

    // Direct DOM bindings for Deep Dive Selectors
    container.querySelectorAll('.ds-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dsId = btn.getAttribute('data-ds-id');
        if (!dsId) return;

        const checkIcon = btn.querySelector('.material-symbols-outlined[data-icon="check_circle"]');
        if (ctx.selectedDataSourceIds.includes(dsId)) {
          ctx.selectedDataSourceIds = ctx.selectedDataSourceIds.filter(id => id !== dsId);
          btn.classList.remove('border-primary', 'bg-primary/[0.03]');
          btn.classList.add('border-transparent');
          checkIcon?.classList.remove('opacity-100', 'scale-100');
          checkIcon?.classList.add('opacity-0', 'scale-75');
        } else {
          ctx.selectedDataSourceIds.push(dsId);
          btn.classList.remove('border-transparent');
          btn.classList.add('border-primary', 'bg-primary/[0.03]');
          checkIcon?.classList.remove('opacity-0', 'scale-75');
          checkIcon?.classList.add('opacity-100', 'scale-100');
        }
      });
    });

    container.querySelectorAll('.kp-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const kpId = btn.getAttribute('data-kp-id');
        if (!kpId) return;

        const checkIcon = btn.querySelector('.material-symbols-outlined[data-icon="check_circle"]');
        if (ctx.selectedKnowledgePageIds.includes(kpId)) {
          ctx.selectedKnowledgePageIds = ctx.selectedKnowledgePageIds.filter(id => id !== kpId);
          btn.classList.remove('border-secondary', 'bg-secondary/[0.03]');
          btn.classList.add('border-transparent');
          checkIcon?.classList.remove('opacity-100', 'scale-100');
          checkIcon?.classList.add('opacity-0', 'scale-75');
        } else {
          ctx.selectedKnowledgePageIds.push(kpId);
          btn.classList.remove('border-transparent');
          btn.classList.add('border-secondary', 'bg-secondary/[0.03]');
          checkIcon?.classList.remove('opacity-0', 'scale-75');
          checkIcon?.classList.add('opacity-100', 'scale-100');
        }
      });
    });

    // Deep Dive Confirm
    container.querySelector('#confirm-create')?.addEventListener('click', async () => {
      console.log('Initialize Deep Dive button clicked!');
      const titleInput = container.querySelector('#analysis-title') as HTMLInputElement;
      const descInput = container.querySelector('#analysis-desc') as HTMLTextAreaElement;

      if (!titleInput) {
        console.error('Title input element #analysis-title not found!');
        alert('Critical UI Error: Title input element could not be found.');
        return;
      }

      const title = titleInput.value.trim();
      if (!title) {
        titleInput.classList.add('border-error');
        alert('Please enter a Title for your analysis before initializing.');
        return;
      }

      const btn = container.querySelector('#confirm-create') as HTMLButtonElement;
      
      await withButtonLoading(
        btn,
        '<span>Initializing Deep Dive...</span>',
        async () => {
          console.log('Dispatching api.createAnalysis request with:', {
            title,
            description: descInput?.value.trim() || '',
            analysis_metadata: {
              type: 'deep_dive',
              data_sources: ctx.selectedDataSourceIds,
              knowledge_pages: ctx.selectedKnowledgePageIds
            }
          });

          const newAnalysis = await api.createAnalysis({
            title,
            description: descInput?.value.trim() || '',
            analysis_metadata: {
              type: 'deep_dive',
              data_sources: ctx.selectedDataSourceIds,
              knowledge_pages: ctx.selectedKnowledgePageIds
            }
          });
          
          console.log('Deep Dive Analysis created successfully:', newAnalysis);
          
          const currentAnalyses = store.getAnalyses();
          store.setAnalyses([newAnalysis, ...currentAnalyses]);
          store.setActiveAnalysisId(newAnalysis.id);
        }
      ).catch(err => {
        console.error('Failed to create analysis', err);
        alert(`Failed to initialize Deep Dive analysis: ${err.message || err}`);
      });
    });
  }

export async function handleFileUpload(container: HTMLElement, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'csv' && extension !== 'xlsx') {
    alert('Please upload a CSV or XLSX file.');
    return;
  }

  const dropZone = container.querySelector('#drop-zone');
  const processingState = container.querySelector('#processing-state');
  const backBtn = container.querySelector('#back-to-select');

  dropZone?.classList.add('hidden');
  processingState?.classList.remove('hidden');
  if (backBtn) (backBtn as HTMLButtonElement).disabled = true;

  try {
    const result = await api.generateQuickInsight(file);
    const analyses = await api.listAnalyses();
    store.setAnalyses(analyses);
    store.setActiveAnalysisId(result.analysis_id);
  } catch (err) {
    console.error('Failed to generate quick insight', err);
    alert('Failed to process data. Please try again.');
    dropZone?.classList.remove('hidden');
    processingState?.classList.add('hidden');
    if (backBtn) (backBtn as HTMLButtonElement).disabled = false;
  }
}

export async function handleExistingFileSelection(container: HTMLElement, fileId: string) {
  const mainContent = container.querySelector('#quick-main-content');
  const processingState = container.querySelector('#processing-state');
  const backBtn = container.querySelector('#back-to-select');

  mainContent?.classList.add('hidden');
  processingState?.classList.remove('hidden');
  if (backBtn) (backBtn as HTMLButtonElement).disabled = true;

  try {
    const result = await api.generateQuickInsightFromExisting(fileId);
    const analyses = await api.listAnalyses();
    store.setAnalyses(analyses);
    store.setActiveAnalysisId(result.analysis_id);
  } catch (err) {
    console.error('Failed to generate quick insight', err);
    alert('Failed to process existing data. Please try again.');
    mainContent?.classList.remove('hidden');
    processingState?.classList.add('hidden');
    if (backBtn) (backBtn as HTMLButtonElement).disabled = false;
  }
}
