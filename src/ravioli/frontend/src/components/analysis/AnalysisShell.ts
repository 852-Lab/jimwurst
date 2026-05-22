import { store } from '../../store';
import { format } from 'date-fns';
import { renderNotebookView, updateNotebookView } from './NotebookView';
import { renderQuickInsightView, updateQuickInsightView } from './QuickInsightView';

export function renderAnalysis() {
  const container = document.createElement('main');
  container.id = 'analysis-view';
  container.className = 'flex-1 ml-64 relative overflow-hidden bg-background h-screen flex flex-col';
  
  updateAnalysisUI(container, true);
  return container;
}

export function updateAnalysisUI(container: HTMLElement, isInitial = false) {
  const activeId = store.getActiveAnalysisId();
  const analyses = store.getAnalyses();
  const analysis = analyses.find(a => a.id === activeId);
  const logs = store.getLogs();

  if (!analysis) {
    if (isInitial || container.querySelector('#empty-state') === null) {
      container.innerHTML = `
        <div id="empty-state" class="h-full w-full relative">
          <!-- TopAppBar -->
          <header class="flex justify-end items-center px-12 w-full h-16 absolute top-0 right-0 z-40 bg-transparent">
            <div class="flex items-center gap-8">
              <button class="material-symbols-outlined text-neutral-400 hover:text-neutral-100 transition-all" data-icon="notifications">notifications</button>
              <button class="material-symbols-outlined text-neutral-400 hover:text-neutral-100 transition-all" data-icon="account_circle">account_circle</button>
            </div>
          </header>

          <!-- Cinematic Vignette Overlay -->
          <div class="absolute inset-0 cinematic-vignette"></div>

          <!-- Empty State Content -->
          <div class="h-full w-full flex flex-col items-center justify-center relative z-10 px-margin">
            <div class="w-px h-24 bg-gradient-to-b from-transparent via-tertiary/30 to-transparent mb-scale-16"></div>
            <h1 class="font-display-lg text-display-lg text-on-surface mb-4 tracking-tight">Select an Analysis</h1>
            <p class="font-label-sm text-label-sm tracking-[0.4em] text-tertiary-fixed-dim uppercase">The silent concierge is waiting.</p>
            
            <div class="mt-scale-16 flex items-center gap-4">
              <div class="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest/50 backdrop-blur-md rounded-full border border-outline-variant/10">
                <span class="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">System Ready</span>
              </div>
            </div>
          </div>

          <!-- Action Floating Group -->
          <div class="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex gap-12">
            <button class="group flex flex-col items-center gap-2" id="btn-new-sequence">
              <div class="p-4 rounded-full border border-outline-variant/20 group-hover:border-tertiary/50 transition-all duration-500 bg-surface-container-low">
                <span class="material-symbols-outlined text-on-surface-variant group-hover:text-tertiary" data-icon="add">add</span>
              </div>
              <span class="font-label-sm text-label-sm text-neutral-500 group-hover:text-neutral-300 tracking-tighter transition-colors uppercase">New Sequence</span>
            </button>
          </div>
        </div>
      `;
      
      container.querySelector('#btn-new-sequence')?.addEventListener('click', () => {
        store.setCurrentView('create-analysis');
      });
    }
    return;
  }

  // Resolve Attached context resources, owner, and timestamp
  const dataSources = store.getDataSources();
  const knowledgePages = store.getKnowledgePages();
  
  let selectedDataSourceIds = analysis.analysis_metadata?.data_sources || [];
  if (selectedDataSourceIds.length === 0 && analysis.analysis_metadata?.file_id) {
    selectedDataSourceIds = [analysis.analysis_metadata.file_id];
  }
  
  const attachedSources = selectedDataSourceIds
    .map((id: string) => dataSources.find(ds => ds.id === id))
    .filter((ds): ds is NonNullable<typeof ds> => !!ds);
    
  const attachedKnowledges = (analysis.analysis_metadata?.knowledge_pages || [])
    .map((id: string) => knowledgePages.find(kp => kp.id === id))
    .filter((kp): kp is NonNullable<typeof kp> => !!kp);

  const ownerName = analysis.owner_user?.name || 'Admin';

  let formattedDate = 'Just now';
  if (analysis.updated_at) {
    try {
      const parsedDate = new Date(analysis.updated_at);
      if (!isNaN(parsedDate.getTime())) {
        formattedDate = format(parsedDate, 'MMM d, yyyy HH:mm');
      }
    } catch (e) {
      console.warn("Failed to parse date", e);
    }
  }

  // Active Analysis Shell
  if (isInitial || !container.querySelector('#analysis-shell')) {
    container.innerHTML = `
      <div id="analysis-shell" class="flex flex-col h-full w-full">
        <header class="flex justify-between items-center px-12 py-6 bg-surface-container-low border-b border-outline-variant/10 z-10 shrink-0">
          <div class="space-y-3 flex-1 min-w-0" id="header-info">
            <h2 class="text-2xl font-headline-lg text-white truncate" id="analysis-title">${analysis.title}</h2>
            <div class="flex items-center flex-wrap gap-3" id="analysis-status-container">
               <!-- Status and Context Capsules will be updated here -->
            </div>
          </div>
          <div class="flex items-center gap-4 shrink-0 pl-6">
            <button class="p-2 text-outline hover:text-white transition-colors">
              <span class="material-symbols-outlined" data-icon="settings">settings</span>
            </button>
            <button class="p-2 text-outline hover:text-white transition-colors">
              <span class="material-symbols-outlined" data-icon="share">share</span>
            </button>
          </div>
        </header>

        <!-- View Container (Notebook or Quick Insight) -->
        <div id="analysis-content" class="flex-1 flex flex-col min-h-0 relative">
        </div>
      </div>
    `;
  }

  // Update Status & Compact Metadata Header
  const statusContainer = container.querySelector('#analysis-status-container');
  if (statusContainer) {
    statusContainer.innerHTML = `
      <!-- Status & Step Count -->
      <span class="flex items-center gap-2 text-[11px] font-label-md text-tertiary uppercase tracking-widest border-r border-outline-variant/20 pr-3">
        <span class="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
        ${analysis.status}
      </span>
      <span class="text-[10px] text-outline uppercase tracking-widest font-label-sm opacity-50 border-r border-outline-variant/20 pr-3">
        # ${logs.length} Steps
      </span>
      
      <!-- Context Resources -->
      ${attachedSources.map(ds => `
        <div class="flex items-center group/ds-wrapper">
          <button class="btn-preview-data flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[10px] rounded-l-full min-w-0 hover:bg-primary/20 hover:border-primary/40 transition-colors cursor-pointer group/ds" 
            data-table="${ds.schema_name}.${ds.table_name}" 
            data-filename="${ds.original_filename}"
            title="Click to preview: ${ds.table_name} (${ds.row_count ?? '?'} rows)">
            <span class="material-symbols-outlined text-[12px] group-hover/ds:rotate-12 transition-transform" data-icon="database">database</span>
            <span class="truncate max-w-[120px] font-medium">${ds.original_filename}</span>
            <span class="material-symbols-outlined text-[10px] opacity-50 group-hover/ds:opacity-100 transition-opacity">open_in_new</span>
          </button>
          <button class="btn-insert-table flex items-center justify-center px-1.5 py-0.5 bg-primary/10 border border-l-0 border-primary/20 text-primary text-[10px] rounded-r-full hover:bg-primary/20 hover:border-primary/40 transition-colors cursor-pointer opacity-50 hover:opacity-100" data-table="${ds.schema_name}.${ds.table_name}" title="Insert table name into active cell">
            <span class="material-symbols-outlined text-[12px]">add_circle</span>
          </button>
        </div>
      `).join('')}
      
      ${attachedKnowledges.map(kp => `
        <button class="flex items-center gap-1.5 px-2.5 py-0.5 bg-secondary/10 border border-secondary/20 text-secondary text-[10px] rounded-full min-w-0 hover:bg-secondary/20 hover:border-secondary/40 transition-colors cursor-pointer group/kp" title="Knowledge: ${kp.title}">
          <span class="material-symbols-outlined text-[12px] group-hover/kp:scale-110 transition-transform">menu_book</span>
          <span class="truncate max-w-[120px] font-medium">${kp.title}</span>
        </button>
      `).join('')}

      <!-- Owner & Date -->
      <span class="flex items-center gap-1.5 px-2.5 py-0.5 bg-surface-container-highest border border-outline-variant/10 text-outline text-[10px] rounded-full border-l border-outline-variant/20 ml-2">
        <span class="material-symbols-outlined text-[12px]">shield_person</span>
        ${ownerName}
      </span>
      <span class="flex items-center gap-1.5 px-2.5 py-0.5 bg-surface-container-highest border border-outline-variant/10 text-outline text-[10px] rounded-full">
        <span class="material-symbols-outlined text-[12px]">history</span>
        ${formattedDate}
      </span>
      
      <!-- Jupyter Kernel Status Placeholder -->
      <span class="flex items-center gap-1.5 px-2.5 py-0.5 bg-surface-container-highest border border-outline-variant/10 text-outline text-[10px] rounded-full uppercase tracking-widest font-mono ml-2 opacity-60">
        <span class="w-1.5 h-1.5 rounded-full bg-outline"></span>
        Kernel: Inactive
      </span>
    `;
  }

  // Delegate to specific views
  const contentContainer = container.querySelector('#analysis-content') as HTMLElement;
  const type = analysis.analysis_metadata?.type || 'quick_insight';
  
  if (type === 'quick_insight') {
    if (!contentContainer.querySelector('#quick-insight-view')) {
      contentContainer.innerHTML = '';
      contentContainer.appendChild(renderQuickInsightView());
    }
    updateQuickInsightView(contentContainer);
  } else {
    if (!contentContainer.querySelector('#notebook-view-inner')) {
      contentContainer.innerHTML = '';
      contentContainer.appendChild(renderNotebookView());
    }
    updateNotebookView(contentContainer);
  }
}
