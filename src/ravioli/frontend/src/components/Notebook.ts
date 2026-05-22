import { store } from '../store';
import { api } from '../services/api';
import { format } from 'date-fns';
import { highlightSQL, highlightPython } from './notebook/utils';
import { renderMarkdown, renderChart, renderRichOutput } from './notebook/templates';
import { bindInteractions } from './notebook/interactions';

let lastLogsJson = '';
const executingCells = new Set<string>();

export function renderNotebook() {
  const container = document.createElement('main');
  container.id = 'notebook-view';
  container.className = 'flex-1 ml-64 relative overflow-hidden bg-background h-screen flex flex-col';
  
  updateNotebookUI(container, true);
  return container;
}

export function updateNotebookUI(container: HTMLElement, isInitial = false) {
  const activeId = store.getActiveAnalysisId();
  const analyses = store.getAnalyses();
  const analysis = analyses.find(a => a.id === activeId);
  const logs = store.getLogs();
  const logsJson = JSON.stringify(logs);

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

  interface NotebookCell {
    index: number;
    inputContent: string;
    inputLogId: string;
    toolName: 'python' | 'sql' | 'chat' | 'markdown';
    outputs: Array<{
      id: string;
      log_type: string;
      content: string;
      data?: any;
    }>;
  }

  function groupLogsIntoCells(logsList: any[]): NotebookCell[] {
    const cells: NotebookCell[] = [];
    let cellCounter = 1;
    let currentCell: NotebookCell | null = null;
    
    logsList.forEach(log => {
      if (log.log_type === 'user_query') {
        if (currentCell) {
          cells.push(currentCell);
        }
        currentCell = {
          index: cellCounter++,
          inputContent: log.content,
          inputLogId: log.id,
          toolName: (log.tool_name || 'chat') as 'python' | 'sql' | 'chat' | 'markdown',
          outputs: []
        };
      } else {
        if (!currentCell) {
          currentCell = {
            index: cellCounter++,
            inputContent: 'Initialize Sequence Brain',
            inputLogId: log.id,
            toolName: 'chat',
            outputs: []
          };
        }
        currentCell.outputs.push(log);
      }
    });
    
    if (currentCell) {
      cells.push(currentCell);
    }
    
    return cells;
  }

  const nextIndex = logs.filter(log => log.log_type === 'user_query').length + 1;

  // Active Analysis Shell
  if (isInitial || !container.querySelector('#notebook-shell')) {
    container.innerHTML = `
      <div id="notebook-shell" class="flex flex-col h-full w-full">
        <header class="flex justify-between items-center px-12 py-6 bg-surface-container-low border-b border-outline-variant/10 z-10">
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

        <!-- Scrollable Cells Area -->
        <div class="flex-1 overflow-y-auto px-12 pt-8 pb-8 space-y-8 custom-scrollbar" id="cell-container">
          <!-- Logs grouped as Jupyter cells will be updated here -->
        </div>

        <!-- Add Cell Footer Bar -->
        ${analysis.analysis_metadata?.type === 'quick_insight' ? `
        <div class="shrink-0 flex items-center justify-center py-6 px-12 border-t border-outline-variant/10 bg-surface-container-low/40 backdrop-blur-sm z-20 relative" id="quick-insight-bar">
          <div class="w-full max-w-4xl relative group flex items-end bg-surface-container-highest border border-outline-variant/20 rounded-[28px] transition-all focus-within:border-secondary/50 focus-within:shadow-lg focus-within:shadow-secondary/10 overflow-hidden">
            <textarea id="quick-insight-chat-input" class="w-full bg-transparent py-4 pl-6 pr-16 text-[15px] leading-relaxed text-on-surface focus:outline-none resize-none max-h-32 custom-scrollbar font-body-lg" rows="1" placeholder="Ask a follow-up question..."></textarea>
            <div class="absolute right-3 bottom-2 flex items-center">
              <button id="btn-quick-insight-send" class="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center hover:bg-secondary hover:text-on-secondary transition-colors group/send">
                <span class="material-symbols-outlined text-[20px] group-hover/send:-translate-y-0.5 transition-transform" data-icon="arrow_upward">arrow_upward</span>
              </button>
            </div>
          </div>
        </div>
        ` : `
        <div class="shrink-0 flex items-center justify-center gap-3 py-4 px-12 border-t border-outline-variant/10 bg-surface-container-low/40 backdrop-blur-sm" id="add-cell-bar">
          <span class="text-[10px] text-outline uppercase tracking-widest font-label-sm opacity-60 mr-2">Add cell</span>
          <button class="btn-add-cell flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/20 text-outline text-[11px] rounded-full hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 transition-all duration-200 group/add" data-type="python">
            <span class="material-symbols-outlined text-[14px] group-hover/add:text-emerald-400" data-icon="code">code</span>
            Python
          </button>
          <button class="btn-add-cell flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/20 text-outline text-[11px] rounded-full hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all duration-200 group/add" data-type="sql">
            <span class="material-symbols-outlined text-[14px] group-hover/add:text-primary" data-icon="database">database</span>
            SQL
          </button>
          <button class="btn-add-cell flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/20 text-outline text-[11px] rounded-full hover:bg-secondary/10 hover:border-secondary/30 hover:text-secondary transition-all duration-200 group/add" data-type="chat">
            <span class="material-symbols-outlined text-[14px] group-hover/add:text-secondary" data-icon="smart_toy">smart_toy</span>
            Chat AI
          </button>
          <button class="btn-add-cell flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/20 text-outline text-[11px] rounded-full hover:bg-indigo-400/10 hover:border-indigo-400/30 hover:text-indigo-400 transition-all duration-200 group/add" data-type="markdown">
            <span class="material-symbols-outlined text-[14px] group-hover/add:text-indigo-400" data-icon="article">article</span>
            Text / MD
          </button>
        </div>
        `}
      </div>
    `;
    
    bindInteractions(container, updateNotebookUI);
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
        <div class="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald/10 border border-emerald/20 text-emerald-400 text-[10px] rounded-full min-w-0">
          <span class="material-symbols-outlined text-[12px]" data-icon="local_library">local_library</span>
          <span class="truncate max-w-[120px] font-medium">${kp.title}</span>
        </div>
      `).join('')}

      <!-- Separator -->
      ${(attachedSources.length > 0 || attachedKnowledges.length > 0) ? `<div class="w-px h-3 bg-outline-variant/20 mx-1"></div>` : ''}

      <!-- Owner & Date -->
      <div class="flex items-center gap-1.5 text-secondary px-2 py-0.5 bg-surface-container-highest border border-outline-variant/10 rounded-full" title="Owner">
        <span class="material-symbols-outlined text-[12px]" data-icon="shield">shield</span>
        <span class="text-[10px] font-medium truncate max-w-[100px]">${ownerName}</span>
      </div>
      <div class="flex items-center gap-1.5 text-outline px-2 py-0.5 bg-surface-container-highest border border-outline-variant/10 rounded-full" title="Latest Edition">
        <span class="material-symbols-outlined text-[12px]" data-icon="history">history</span>
        <span class="text-[10px] font-medium">${formattedDate}</span>
      </div>

      <!-- Jupyter Kernel Status -->
      <div id="kernel-status-pill" class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border bg-surface-container-highest border-outline-variant/10 text-outline select-none transition-all duration-300" title="IPython Kernel Status">
        <span class="w-1.5 h-1.5 rounded-full bg-outline/40" id="kernel-status-dot"></span>
        <span class="text-[10px] font-medium font-mono uppercase tracking-wide" id="kernel-status-text">Kernel: Checking...</span>
      </div>
    `;

    // Asynchronously fetch and update the kernel status
    if (activeId) {
      api.getJupyterStatus(activeId).then(res => {
        const pill = container.querySelector('#kernel-status-pill');
        const dot = container.querySelector('#kernel-status-dot');
        const txt = container.querySelector('#kernel-status-text');
        if (!pill || !dot || !txt) return;

        if (res.status === 'connected') {
          pill.className = 'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border bg-emerald-500/5 border-emerald-500/20 text-emerald-400 select-none transition-all duration-300';
          dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-emerald-400/50 shadow-sm animate-pulse';
          txt.textContent = 'Kernel: Connected';
        } else if (res.status === 'dead') {
          pill.className = 'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border bg-error/5 border-error/20 text-error select-none transition-all duration-300';
          dot.className = 'w-1.5 h-1.5 rounded-full bg-error animate-pulse';
          txt.textContent = 'Kernel: Dead';
        } else {
          // not_started / inactive
          pill.className = 'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border bg-surface-container-highest border-outline-variant/10 text-outline/80 select-none transition-all duration-300';
          dot.className = 'w-1.5 h-1.5 rounded-full bg-outline/40';
          txt.textContent = 'Kernel: Inactive';
        }
      }).catch(() => {});
    }
  }

  // Update Active Input Cell Tag
  const nextCellIndexTag = container.querySelector('#next-cell-index-tag');
  if (nextCellIndexTag) {
    nextCellIndexTag.innerHTML = `In [${nextIndex}]:`;
  }

  // Update Logs only if they changed and we are NOT in an active streaming or editing state
  const cellContainer = container.querySelector('#cell-container') as HTMLElement;
  const isStreaming = cellContainer?.querySelector('#streaming-content') !== null ||
                      cellContainer?.querySelector('.new-cell-block') !== null ||
                      cellContainer?.querySelector('.cell-edit-view:not(.hidden)') !== null;
  
  if (cellContainer && (isInitial || logsJson !== lastLogsJson) && !isStreaming) {
    lastLogsJson = logsJson;
    
    let html = '';
    
    // 1. Executive Summary as Cell 0 / Overview
    if (analysis.result) {
      html += `
        <div class="glass-panel p-6 rounded-3xl space-y-6 bg-surface-container-low/30 border-outline-variant/10 relative overflow-hidden flex items-start gap-4">
          <div class="font-mono text-xs font-bold text-tertiary/40 pt-4 select-none w-14 text-right shrink-0">
            Overview:
          </div>
          <div class="flex-1 space-y-6 min-w-0">
            <div class="flex items-center gap-4 text-primary">
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-2xl" data-icon="auto_awesome">auto_awesome</span>
              </div>
              <h3 class="text-xl font-headline-sm uppercase tracking-[0.2em]">Executive Insights</h3>
            </div>
            <div class="prose prose-invert max-w-none text-on-surface-variant leading-relaxed font-body-lg">
              ${renderMarkdown(analysis.result)}
            </div>
            
            ${analysis.analysis_metadata?.followup_questions?.length ? `
              <div class="pt-6 border-t border-outline-variant/10 space-y-4">
                <div class="flex items-center gap-3 text-tertiary">
                  <span class="material-symbols-outlined text-xl" data-icon="explore">explore</span>
                  <p class="text-[10px] font-label-md uppercase tracking-[0.3em]">Follow-up Sequences</p>
                </div>
                <div class="grid grid-cols-1 gap-2">
                  ${analysis.analysis_metadata.followup_questions.map((q: string) => `
                    <button class="followup-question-btn flex items-center justify-between w-full px-5 py-3 text-left text-sm font-body-md text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/10 rounded-xl transition-all duration-300 group hover:border-primary/30 hover:translate-x-1" data-question="${q.replace(/"/g, '&quot;')}">
                      <span class="group-hover:text-white transition-colors">${q}</span>
                      <span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-lg opacity-0 group-hover:opacity-100" data-icon="arrow_forward_ios">arrow_forward_ios</span>
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    // 2. Parse and Group logs list into Jupyter Notebook cell cards
    const notebookCells = groupLogsIntoCells(logs);
    
    html += notebookCells.map(cell => {
      if (cell.toolName === 'markdown') {
        return `
          <div class="glass-panel p-6 rounded-3xl bg-surface-container-low/30 border-outline-variant/10 relative overflow-hidden group hover:border-indigo-400/20 transition-all duration-300 animate-in fade-in duration-300">
             <!-- Static View -->
             <div class="prose prose-invert max-w-none text-on-surface-variant leading-relaxed font-body-lg cell-static-view relative p-1.5" id="cell-static-${cell.index}">
                <div class="pr-8">${renderMarkdown(cell.inputContent || '*Double click or edit to add Text/Markdown content...*')}</div>
                <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="p-1.5 rounded-lg bg-surface-container-highest/80 text-outline hover:text-indigo-400 btn-edit-cell" data-cell-index="${cell.index}" title="Edit Markdown">
                    <span class="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                  <button class="p-1.5 rounded-lg bg-surface-container-highest/80 text-outline hover:text-error btn-delete-cell" data-cell-index="${cell.index}" data-log-id="${cell.inputLogId}" title="Delete Cell">
                    <span class="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
             </div>
             
             <!-- Edit View -->
             <div class="hidden cell-edit-view w-full" id="cell-edit-${cell.index}">
                <div class="glass-panel p-1.5 rounded-xl group focus-within:border-indigo-400/30 transition-all duration-300 shadow-lg shadow-indigo-400/5 bg-surface-container-low/80 border-indigo-400/30">
                   <div class="flex items-start gap-3 px-3">
                     <div class="flex-1 min-w-0 py-1.5">
                       <textarea id="cell-input-${cell.index}" class="w-full bg-transparent border-none text-on-surface focus:ring-0 resize-none py-0 text-sm font-mono max-h-64 custom-scrollbar" rows="3" placeholder="Write markdown here...">${cell.inputContent}</textarea>
                     </div>
                     <div class="flex items-center gap-1.5 shrink-0 pt-0.5">
                       <button class="w-7 h-7 rounded-full bg-surface-container-highest text-outline flex items-center justify-center hover:bg-error/20 hover:text-error transition-colors btn-cancel-edit" data-cell-index="${cell.index}" title="Cancel">
                         <span class="material-symbols-outlined text-[14px]">close</span>
                       </button>
                       <button class="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-110 transition-transform btn-rerun-cell shadow-md shadow-primary/20" data-cell-index="${cell.index}" data-log-id="${cell.inputLogId}" data-tool="markdown" title="Save Markdown">
                         <span class="material-symbols-outlined text-[14px]">done</span>
                       </button>
                     </div>
                   </div>
                </div>
             </div>

             <!-- Colab-style Floating Toolbar -->
             <div class="relative group/toolbar py-2 -my-2 z-20 flex justify-center items-center opacity-0 hover:opacity-100 transition-opacity mt-4">
               <div class="absolute inset-x-0 top-1/2 h-px bg-primary/30 scale-x-0 group-hover/toolbar:scale-x-100 transition-transform duration-500 origin-center pointer-events-none"></div>
               <div class="flex items-center gap-1 bg-surface-container-highest px-3 py-1.5 rounded-full border border-primary/20 shadow-xl shadow-primary/5 relative z-10 translate-y-2 group-hover/toolbar:translate-y-0 transition-all duration-300">
                 <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1 hover:bg-emerald-400/20 px-2 py-1 rounded-lg transition-colors" data-type="python" data-after="${cell.inputLogId}">
                   <span class="material-symbols-outlined text-[14px]">code</span> Python
                 </button>
                 <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
                 <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-primary flex items-center gap-1 hover:bg-primary/20 px-2 py-1 rounded-lg transition-colors" data-type="sql" data-after="${cell.inputLogId}">
                   <span class="material-symbols-outlined text-[14px]">database</span> SQL
                 </button>
                 <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
                 <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-secondary flex items-center gap-1 hover:bg-secondary/20 px-2 py-1 rounded-lg transition-colors" data-type="chat" data-after="${cell.inputLogId}">
                   <span class="material-symbols-outlined text-[14px]">auto_awesome</span> Chat
                 </button>
                 <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
                 <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-indigo-400 flex items-center gap-1 hover:bg-indigo-400/20 px-2 py-1 rounded-lg transition-colors" data-type="markdown" data-after="${cell.inputLogId}">
                   <span class="material-symbols-outlined text-[14px]">article</span> Text
                 </button>
               </div>
             </div>
          </div>
        `;
      }

      // Code / Chat cells
      let icon = "auto_awesome";
      let color = "text-secondary";
      let inputColor = "text-primary-fixed-dim";
      let focusColor = "primary";
      if (cell.toolName === "sql") {
         icon = "database";
         color = "text-primary";
         inputColor = "text-primary";
         focusColor = "primary";
      } else if (cell.toolName === "python") {
         icon = "code";
         color = "text-emerald-400";
         inputColor = "text-emerald-400";
         focusColor = "emerald-400";
      }

      return `
        <div class="glass-panel p-6 rounded-3xl space-y-6 bg-surface-container-low/30 border-outline-variant/10 relative overflow-hidden group hover:border-primary/20 transition-all duration-300 animate-in fade-in duration-300">
           <!-- Cell Header: Input (In [X]) -->
           <div class="flex items-start gap-4 group/input relative">
              <div class="font-mono text-xs font-bold ${color}/80 pt-2.5 select-none w-14 text-right shrink-0 flex items-center justify-end gap-1" id="cell-in-label-${cell.index}">
                 <span class="material-symbols-outlined text-[14px]">${icon}</span>
                 In [${cell.index}]:
              </div>
              
              <!-- Static View -->
              <div class="flex-1 min-w-0 font-mono text-sm ${inputColor} bg-surface-container-lowest/80 border border-outline-variant/10 rounded-xl p-3.5 shadow-inner overflow-x-auto relative cell-static-view transition-all" id="cell-static-${cell.index}">
                                   <div class="pr-8 ${cell.toolName === 'markdown' ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}">${cell.toolName === 'sql' ? highlightSQL(cell.inputContent) : cell.toolName === 'python' ? highlightPython(cell.inputContent) : cell.inputContent}</div>${cell.toolName === 'sql' ? `<div class="mt-3 flex items-center justify-between border-t border-outline-variant/5 pt-2"><span class="text-[10px] font-mono text-outline uppercase tracking-wider select-none bg-surface-container-highest/40 px-2 py-0.5 rounded border border-outline-variant/10">SQL • ${(() => { const l = (cell.inputContent || '').split('\n').length; return `${l} ${l === 1 ? 'line' : 'lines'}`; })()}</span></div>` : cell.toolName === 'python' ? `<div class="mt-3 flex items-center justify-between border-t border-outline-variant/5 pt-2"><span class="text-[10px] font-mono text-outline uppercase tracking-wider select-none bg-surface-container-highest/40 px-2 py-0.5 rounded border border-outline-variant/10">Python • ${(() => { const l = (cell.inputContent || '').split('\n').length; return `${l} ${l === 1 ? 'line' : 'lines'}`; })()}</span></div>` : ''}
                 <div class="absolute top-2 right-2 flex items-center gap-1">
                   ${cell.toolName !== 'markdown' ? `
                   <button class="p-1.5 rounded-lg bg-surface-container-highest/80 text-outline hover:text-${focusColor} btn-run-static-cell transition-all" data-cell-index="${cell.index}" data-log-id="${cell.inputLogId}" data-tool="${cell.toolName}" title="Run Cell">
                     <span class="material-symbols-outlined text-[14px]">play_arrow</span>
                   </button>
                   ` : ''}
                   <button class="p-1.5 rounded-lg bg-surface-container-highest/80 text-outline hover:text-${focusColor} btn-edit-cell opacity-0 group-hover/input:opacity-100 transition-all" data-cell-index="${cell.index}" title="Edit Cell">
                     <span class="material-symbols-outlined text-[14px]">edit</span>
                   </button>
                   <button class="p-1.5 rounded-lg bg-surface-container-highest/80 text-outline hover:text-error btn-delete-cell opacity-0 group-hover/input:opacity-100 transition-all" data-cell-index="${cell.index}" data-log-id="${cell.inputLogId}" title="Delete Cell">
                     <span class="material-symbols-outlined text-[14px]">delete</span>
                   </button>
                 </div>
              </div>
              
              <!-- Edit View -->
              <div class="flex-1 min-w-0 hidden cell-edit-view w-full" id="cell-edit-${cell.index}">
                 <div class="glass-panel p-1.5 rounded-xl group focus-within:border-primary/30 transition-all duration-300 shadow-lg shadow-primary/5 bg-surface-container-low/80 border-primary/30">
                    <div class="flex flex-col w-full">
                      <div class="flex items-stretch gap-3 px-3">
                        ${(cell.toolName === 'sql' || cell.toolName === 'python') ? `
                        <div id="cell-gutter-${cell.index}" class="w-8 select-none text-right font-mono text-sm leading-relaxed text-outline/30 pr-2 border-r border-outline-variant/10 whitespace-pre overflow-hidden pt-0 pointer-events-none">${(() => {
                          const lines = (cell.inputContent || '').split('\n');
                          return lines.map((_, i) => i + 1).join('\n');
                        })()}</div>
                        ` : ''}
                        <div class="flex-1 min-w-0 py-0.5 relative">
                          ${cell.toolName === 'sql' || cell.toolName === 'python' ? `
                          <!-- Highlight Backdrop -->
                          <div id="cell-highlight-${cell.index}" data-tool="${cell.toolName}" class="absolute inset-0 w-full max-w-full bg-transparent text-primary-fixed-dim py-0.5 px-0 text-sm font-mono leading-relaxed whitespace-pre overflow-hidden pointer-events-none border border-transparent custom-scrollbar select-none">${cell.toolName === 'sql' ? highlightSQL(cell.inputContent) : highlightPython(cell.inputContent)}</div>
                          ` : ''}
                          <textarea id="cell-input-${cell.index}" class="w-full max-w-full bg-transparent border border-transparent ${(cell.toolName === 'sql' || cell.toolName === 'python') ? 'text-transparent caret-white whitespace-pre overflow-x-auto' : 'text-primary-fixed-dim whitespace-pre-wrap break-words'} outline-none focus:outline-none focus:ring-0 resize-none py-0.5 px-0 text-sm font-mono leading-relaxed max-h-48 custom-scrollbar relative z-10" rows="2">${cell.inputContent}</textarea>
                        </div>
                        <div class="flex items-start gap-1.5 shrink-0 pt-0.5">
                          <button class="w-7 h-7 rounded-full bg-surface-container-highest text-outline flex items-center justify-center hover:bg-error/20 hover:text-error transition-colors btn-cancel-edit" data-cell-index="${cell.index}" title="Cancel">
                            <span class="material-symbols-outlined text-[14px]">close</span>
                          </button>
                          <button class="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-110 transition-transform btn-rerun-cell shadow-md shadow-primary/20" data-cell-index="${cell.index}" data-log-id="${cell.inputLogId}" data-tool="${cell.toolName}" title="Rerun Cell">
                            <span class="material-symbols-outlined text-[14px]">play_arrow</span>
                          </button>
                        </div>
                      </div>
                    ${cell.toolName === 'sql' || cell.toolName === 'python' ? `
                    <div class="px-3 pb-1.5 flex items-center justify-between text-[10px] font-mono text-outline select-none border-t border-outline-variant/5 pt-1.5 mt-1.5">
                      <span>${cell.toolName === 'sql' ? 'SQL Mode' : 'Python Mode'}</span>
                      <span id="cell-loc-${cell.index}">${(() => {
                        const lineCount = (cell.inputContent || '').split('\n').length;
                        return `${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`;
                      })()}</span>
                    </div>
                    ` : ''}
                   </div>
                </div>
              </div>
           </div>
  
           <!-- Cell Divider Line -->
           <div class="h-px bg-outline-variant/10 ml-18 mr-2 transition-opacity" id="cell-divider-${cell.index}"></div>
  
            <div class="flex items-start gap-4">
              <div class="font-mono text-xs font-bold text-secondary/50 pt-1 select-none w-14 text-right shrink-0${executingCells.has(cell.inputLogId) ? ' flex items-center justify-end gap-1' : ''}">
                 ${executingCells.has(cell.inputLogId) ? '<span class="material-symbols-outlined text-[10px] animate-spin" data-icon="progress_activity">progress_activity</span><span>Out [*]:</span>' : `Out [${cell.index}]:`}
              </div>
               <div class="flex-1 space-y-6 min-w-0 overflow-x-auto">
                  ${cell.outputs.length === 0 
                    ? (executingCells.has(cell.inputLogId) ? '<div class="prose prose-invert max-w-none text-on-surface-variant leading-relaxed font-body-lg animate-pulse" id="streaming-content-' + cell.index + '"><span class="inline-block w-1 h-4 bg-primary animate-pulse"></span></div>' : '<span class="text-xs text-outline italic">No output generated</span>')
                    : cell.outputs.map(out => {
                        let contentHtml = out.content && out.content.trim() !== '[SQL Execution Result]' && out.content.trim() !== '[Python Execution Result]' 
                            ? `<div class="prose prose-invert max-w-none text-on-surface-variant leading-relaxed font-body-lg">${renderMarkdown(out.content)}</div>` 
                            : '';
                        
                        let dataHtml = '';
                        if (out.data) {
                          if (out.data.type === 'chart') {
                            dataHtml += `<div class="mt-4 glass-panel p-6 rounded-2xl border-primary/20 h-80 relative bg-surface-container-lowest/30"><canvas id="chart-${out.id}"></canvas></div>`;
                          }
                          if (out.data.sql_outputs) {
                            dataHtml += out.data.sql_outputs.map((so: any) => renderRichOutput(so)).join('');
                          }
                          if (out.data.jupyter_outputs) {
                            dataHtml += out.data.jupyter_outputs.map((jo: any) => renderRichOutput(jo)).join('');
                          }
                        }
                        
                        return contentHtml + dataHtml;
                      }).join('')
                  }
               </div>
           </div>

           <!-- Colab-style Floating Toolbar -->
           <div class="relative group/toolbar py-2 -my-2 z-20 flex justify-center items-center opacity-0 hover:opacity-100 transition-opacity mt-4">
             <div class="absolute inset-x-0 top-1/2 h-px bg-primary/30 scale-x-0 group-hover/toolbar:scale-x-100 transition-transform duration-500 origin-center pointer-events-none"></div>
             <div class="flex items-center gap-1 bg-surface-container-highest px-3 py-1.5 rounded-full border border-primary/20 shadow-xl shadow-primary/5 relative z-10 translate-y-2 group-hover/toolbar:translate-y-0 transition-all duration-300">
               <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1 hover:bg-emerald-400/20 px-2 py-1 rounded-lg transition-colors" data-type="python" data-after="${cell.inputLogId}">
                 <span class="material-symbols-outlined text-[14px]">code</span> Python
               </button>
               <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
               <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-primary flex items-center gap-1 hover:bg-primary/20 px-2 py-1 rounded-lg transition-colors" data-type="sql" data-after="${cell.inputLogId}">
                 <span class="material-symbols-outlined text-[14px]">database</span> SQL
               </button>
               <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
               <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-secondary flex items-center gap-1 hover:bg-secondary/20 px-2 py-1 rounded-lg transition-colors" data-type="chat" data-after="${cell.inputLogId}">
                 <span class="material-symbols-outlined text-[14px]">auto_awesome</span> Chat
               </button>
               <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
               <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-indigo-400 flex items-center gap-1 hover:bg-indigo-400/20 px-2 py-1 rounded-lg transition-colors" data-type="markdown" data-after="${cell.inputLogId}">
                 <span class="material-symbols-outlined text-[14px]">article</span> Text
               </button>
             </div>
           </div>
        </div>
      `;
    }).join('');

    cellContainer.innerHTML = html;

    // If notebook is brand new (no cells rendered), show an inviting first-cell placeholder
    if (!html.trim()) {
      cellContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[60vh] select-none animate-in fade-in duration-500" id="notebook-welcome">
          <div class="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 shadow-lg shadow-primary/10">
            <span class="material-symbols-outlined text-4xl text-primary">deployed_code</span>
          </div>
          <h3 class="text-2xl font-headline-sm text-white mb-2">Start your analysis</h3>
          <p class="text-sm text-outline text-center max-w-sm mb-10 leading-relaxed">Choose a cell type to begin. You can mix Python, SQL, and AI chat freely — just like Jupyter.</p>

          <div class="flex items-center gap-4">
            <button class="btn-first-cell group flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-surface-container-low border border-outline-variant/15 hover:border-emerald-400/40 hover:bg-emerald-400/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-400/10" data-type="python">
              <div class="w-12 h-12 rounded-2xl bg-emerald-400/15 group-hover:bg-emerald-400/25 flex items-center justify-center transition-colors">
                <span class="material-symbols-outlined text-2xl text-emerald-400" data-icon="code">code</span>
              </div>
              <div class="text-center">
                <div class="text-sm font-bold text-emerald-400 tracking-wide">Python</div>
                <div class="text-[11px] text-outline mt-0.5">Pandas, NumPy, Matplotlib</div>
              </div>
            </button>

            <button class="btn-first-cell group flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-surface-container-low border border-outline-variant/15 hover:border-primary/40 hover:bg-primary/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10" data-type="sql">
              <div class="w-12 h-12 rounded-2xl bg-primary/15 group-hover:bg-primary/25 flex items-center justify-center transition-colors">
                <span class="material-symbols-outlined text-2xl text-primary" data-icon="database">database</span>
              </div>
              <div class="text-center">
                <div class="text-sm font-bold text-primary tracking-wide">SQL</div>
                <div class="text-[11px] text-outline mt-0.5">Query with DuckDB</div>
              </div>
            </button>

            <button class="btn-first-cell group flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-surface-container-low border border-outline-variant/15 hover:border-secondary/40 hover:bg-secondary/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-secondary/10" data-type="chat">
              <div class="w-12 h-12 rounded-2xl bg-secondary/15 group-hover:bg-secondary/25 flex items-center justify-center transition-colors">
                <span class="material-symbols-outlined text-2xl text-secondary" data-icon="smart_toy">smart_toy</span>
              </div>
              <div class="text-center">
                <div class="text-sm font-bold text-secondary tracking-wide">Chat AI</div>
                <div class="text-[11px] text-outline mt-0.5">Ask questions in plain English</div>
              </div>
            </button>

            <button class="btn-first-cell group flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-surface-container-low border border-outline-variant/15 hover:border-indigo-400/40 hover:bg-indigo-400/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-400/10" data-type="markdown">
              <div class="w-12 h-12 rounded-2xl bg-indigo-400/15 group-hover:bg-indigo-400/25 flex items-center justify-center transition-colors">
                <span class="material-symbols-outlined text-2xl text-indigo-400" data-icon="article">article</span>
              </div>
              <div class="text-center">
                <div class="text-sm font-bold text-indigo-400 tracking-wide">Text / MD</div>
                <div class="text-[11px] text-outline mt-0.5">Write rich text & notes</div>
              </div>
            </button>
          </div>

          <div class="mt-10 flex items-center gap-2 text-[11px] text-outline/50">
            <span class="material-symbols-outlined text-[14px]">keyboard</span>
            <span>Or use the <span class="font-mono text-outline/80">+ Python / SQL / Chat AI / Text</span> bar below</span>
          </div>
        </div>
      `;
    }
    
    // Initialize charts
    setTimeout(() => {
      logs.forEach(log => {
        if (log.data && log.data.type === 'chart') {
          renderChart(`chart-${log.id}`, log.data);
        }
      });
      cellContainer.scrollTop = cellContainer.scrollHeight;
    }, 100);
  }
}

