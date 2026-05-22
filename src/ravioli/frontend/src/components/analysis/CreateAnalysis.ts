import { store } from '../../store';
import { renderSelection, renderQuick, renderDeep } from './create-analysis/templates';
import { attachEventListeners, type CreateAnalysisContext } from './create-analysis/interactions';

type CreationMode = 'select' | 'quick' | 'deep';

export function renderCreateAnalysis() {
  let mode: CreationMode = 'select';
  let existingFiles: any[] = [];
  let isFetchingFiles = false;
  let selectedDataSourceIds: string[] = [];
  let selectedKnowledgePageIds: string[] = [];

  const container = document.createElement('main');
  container.className = 'flex-1 ml-64 relative overflow-hidden bg-background h-screen flex flex-col items-center justify-center';

  function updateUI() {
    const ctx: CreateAnalysisContext = {
      mode, existingFiles, isFetchingFiles,
      selectedDataSourceIds, selectedKnowledgePageIds,
      updateUI,
    };

    // Sync ctx mutations back to local vars after interactions
    const syncFromCtx = () => {
      mode = ctx.mode as CreationMode;
      existingFiles = ctx.existingFiles;
      isFetchingFiles = ctx.isFetchingFiles;
      selectedDataSourceIds = ctx.selectedDataSourceIds;
      selectedKnowledgePageIds = ctx.selectedKnowledgePageIds;
    };

    let modeContent: string;
    if (mode === 'select') {
      modeContent = renderSelection();
    } else if (mode === 'quick') {
      modeContent = renderQuick(isFetchingFiles, existingFiles);
    } else {
      modeContent = renderDeep(selectedDataSourceIds, selectedKnowledgePageIds);
    }

    container.innerHTML = `
      <!-- Cinematic Vignette Overlay -->
      <div class="absolute inset-0 cinematic-vignette"></div>

      <div class="max-w-4xl w-full space-y-12 relative z-10 px-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div class="text-center space-y-4">
          <h2 class="text-5xl font-display-lg text-on-surface tracking-tight">
            ${mode === 'select' ? 'Choose Your Path' : mode === 'quick' ? 'Quick Insight' : 'Deep Dive'}
          </h2>
          <p class="font-label-sm text-label-sm tracking-[0.4em] text-tertiary-fixed-dim uppercase">
            ${mode === 'select' ? 'Select the level of orchestration required.' : 'Initialize your parameters for processing.'}
          </p>
        </div>

        ${modeContent}

        <div class="grid grid-cols-3 gap-8 opacity-20">
           <div class="text-center space-y-2">
              <span class="material-symbols-outlined text-tertiary" data-icon="database">database</span>
              <p class="text-[10px] font-label-sm uppercase tracking-widest">Neural Link</p>
           </div>
           <div class="text-center space-y-2">
              <span class="material-symbols-outlined text-primary" data-icon="auto_awesome">auto_awesome</span>
              <p class="text-[10px] font-label-sm uppercase tracking-widest">Core Logic</p>
           </div>
           <div class="text-center space-y-2">
              <span class="material-symbols-outlined text-secondary" data-icon="monitoring">monitoring</span>
              <p class="text-[10px] font-label-sm uppercase tracking-widest">Data Stream</p>
           </div>
        </div>
      </div>

      <!-- Soft Glow -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
    `;

    // Wrap updateUI in ctx so mutations propagate
    ctx.updateUI = () => {
      syncFromCtx();
      updateUI();
    };

    attachEventListeners(container, ctx);
  }

  updateUI();
  return container;
}
