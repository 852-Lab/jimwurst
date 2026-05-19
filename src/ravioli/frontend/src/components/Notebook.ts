import { store } from '../store';
import { api } from '../services/api';
import MarkdownIt from 'markdown-it';
import Chart from 'chart.js/auto';
import { format } from 'date-fns';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

function renderMarkdown(content: string) {
  if (!content) return '';
  
  // Transform GitHub style alerts: > [!TYPE]
  // This regex matches the blockquote with alert marker
  let transformed = content.replace(/^> \[!(IMPORTANT|NOTE|TIP|WARNING|CAUTION)\]\n((?:>.*\n?)+)/gm, (_match, type, body) => {
    const lowerType = type.toLowerCase();
    const icon = type === 'IMPORTANT' ? 'priority_high' : 'info';
    // Remove the leading '>' from each line of the body
    const cleanBody = body.split('\n').map((line: string) => line.replace(/^>\s?/, '')).join('\n');
    return `
<div class="markdown-alert markdown-alert-${lowerType}">
  <div class="markdown-alert-title">
    <span class="material-symbols-outlined text-sm" data-icon="${icon}">${icon}</span>
    <span>${type}</span>
  </div>
  <div class="markdown-alert-content">
    ${md.render(cleanBody.trim())}
  </div>
</div>
`;
  });

  return md.render(transformed);
}

function renderChart(canvasId: string, vizData: any) {
  const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!ctx) return;

  new Chart(ctx, {
    type: vizData.chart_type,
    data: vizData.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 10 }
          }
        },
        title: {
          display: true,
          text: vizData.title,
          color: '#f8fafc',
          font: { family: 'Inter', size: 14, weight: 'bold' }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { size: 10 } }
        }
      }
    }
  });
}

let lastLogsJson = '';

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
          outputs: []
        };
      } else {
        if (!currentCell) {
          currentCell = {
            index: cellCounter++,
            inputContent: 'Initialize Sequence Brain',
            inputLogId: log.id,
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
        <div class="shrink-0 flex items-center justify-center gap-3 py-4 px-12 border-t border-outline-variant/10 bg-surface-container-low/40 backdrop-blur-sm" id="add-cell-bar">
          <span class="text-[10px] text-outline uppercase tracking-widest font-label-sm opacity-60 mr-2">Add cell</span>
          <button class="btn-add-cell flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/20 text-outline text-[11px] rounded-full hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all duration-200 group/add" data-type="python">
            <span class="material-symbols-outlined text-[14px] group-hover/add:text-primary" data-icon="code">code</span>
            Python
          </button>
          <button class="btn-add-cell flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/20 text-outline text-[11px] rounded-full hover:bg-secondary/10 hover:border-secondary/30 hover:text-secondary transition-all duration-200 group/add" data-type="sql">
            <span class="material-symbols-outlined text-[14px] group-hover/add:text-secondary" data-icon="database">database</span>
            SQL
          </button>
          <button class="btn-add-cell flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/20 text-outline text-[11px] rounded-full hover:bg-tertiary/10 hover:border-tertiary/30 hover:text-tertiary transition-all duration-200 group/add" data-type="chat">
            <span class="material-symbols-outlined text-[14px] group-hover/add:text-tertiary" data-icon="smart_toy">smart_toy</span>
            Chat AI
          </button>
        </div>
      </div>
    `;
    
    bindInteractions(container);
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
        <button class="btn-preview-data flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[10px] rounded-full min-w-0 hover:bg-primary/20 hover:border-primary/40 transition-colors cursor-pointer group/ds" 
          data-table="${ds.schema_name}.${ds.table_name}" 
          data-filename="${ds.original_filename}"
          title="Click to preview: ${ds.table_name} (${ds.row_count ?? '?'} rows)">
          <span class="material-symbols-outlined text-[12px] group-hover/ds:rotate-12 transition-transform" data-icon="database">database</span>
          <span class="truncate max-w-[120px] font-medium">${ds.original_filename}</span>
          <span class="material-symbols-outlined text-[10px] opacity-50 group-hover/ds:opacity-100 transition-opacity">open_in_new</span>
        </button>
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
  
  if (cellContainer && logsJson !== lastLogsJson && !isStreaming) {
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
    
    html += notebookCells.map(cell => `
      <div class="glass-panel p-6 rounded-3xl space-y-6 bg-surface-container-low/30 border-outline-variant/10 relative overflow-hidden group hover:border-primary/20 transition-all duration-300 animate-in fade-in duration-300">
         <!-- Cell Header: Input (In [X]) -->
         <div class="flex items-start gap-4 group/input relative">
            <div class="font-mono text-xs font-bold text-primary/50 pt-2.5 select-none w-14 text-right shrink-0" id="cell-in-label-${cell.index}">
               In [${cell.index}]:
            </div>
            
            <!-- Static View -->
            <div class="flex-1 font-mono text-sm text-primary-fixed-dim bg-surface-container-lowest/80 border border-outline-variant/10 rounded-xl p-3.5 shadow-inner overflow-x-auto relative cell-static-view transition-all" id="cell-static-${cell.index}">
               <div class="pr-8">${cell.inputContent}</div>
               <button class="absolute top-2 right-2 p-1.5 rounded-lg bg-surface-container-highest/80 text-outline hover:text-primary opacity-0 group-hover/input:opacity-100 transition-opacity btn-edit-cell" data-cell-index="${cell.index}" title="Edit Cell">
                 <span class="material-symbols-outlined text-[14px]">edit</span>
               </button>
            </div>
            
            <!-- Edit View -->
            <div class="flex-1 hidden cell-edit-view w-full" id="cell-edit-${cell.index}">
               <div class="glass-panel p-1.5 rounded-xl group focus-within:border-primary/30 transition-all duration-300 shadow-lg shadow-primary/5 bg-surface-container-low/80 border-primary/30">
                  <div class="flex items-start gap-3 px-3">
                    <div class="flex-1 min-w-0 py-1.5">
                      <textarea id="cell-input-${cell.index}" class="w-full bg-transparent border-none text-primary-fixed-dim focus:ring-0 resize-none py-0 text-sm font-mono max-h-48 custom-scrollbar" rows="1">${cell.inputContent}</textarea>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0 pt-0.5">
                      <button class="w-7 h-7 rounded-full bg-surface-container-highest text-outline flex items-center justify-center hover:bg-error/20 hover:text-error transition-colors btn-cancel-edit" data-cell-index="${cell.index}" title="Cancel">
                        <span class="material-symbols-outlined text-[14px]">close</span>
                      </button>
                      <button class="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-110 transition-transform btn-rerun-cell shadow-md shadow-primary/20" data-cell-index="${cell.index}" data-log-id="${cell.inputLogId}" title="Rerun Cell">
                        <span class="material-symbols-outlined text-[14px]">play_arrow</span>
                      </button>
                    </div>
                  </div>
               </div>
            </div>
         </div>

         <!-- Cell Divider Line -->
         <div class="h-px bg-outline-variant/10 ml-18 mr-2 transition-opacity" id="cell-divider-${cell.index}"></div>

          <div class="flex items-start gap-4">
            <div class="font-mono text-xs font-bold text-secondary/50 pt-1 select-none w-14 text-right shrink-0">
               Out [${cell.index}]:
            </div>
             <div class="flex-1 space-y-6 min-w-0 overflow-x-auto">
                ${cell.outputs.length === 0 
                  ? `<span class="text-xs text-outline italic">No output generated</span>`
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
      </div>

      <!-- Colab-style Floating Toolbar -->
      <div class="relative group/toolbar py-2 -my-2 z-20 flex justify-center items-center opacity-0 hover:opacity-100 transition-opacity">
        <div class="absolute inset-x-0 top-1/2 h-px bg-primary/30 scale-x-0 group-hover/toolbar:scale-x-100 transition-transform duration-500 origin-center pointer-events-none"></div>
        <div class="flex items-center gap-1 bg-surface-container-highest px-3 py-1.5 rounded-full border border-primary/20 shadow-xl shadow-primary/5 relative z-10 translate-y-2 group-hover/toolbar:translate-y-0 transition-all duration-300">
          <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-primary flex items-center gap-1 hover:bg-primary/20 px-2 py-1 rounded-lg transition-colors" data-type="sql" data-after="${cell.inputLogId}">
            <span class="material-symbols-outlined text-[14px]">database</span> SQL
          </button>
          <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
          <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1 hover:bg-emerald-400/20 px-2 py-1 rounded-lg transition-colors" data-type="python" data-after="${cell.inputLogId}">
            <span class="material-symbols-outlined text-[14px]">code</span> Python
          </button>
          <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
          <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-secondary flex items-center gap-1 hover:bg-secondary/20 px-2 py-1 rounded-lg transition-colors" data-type="chat" data-after="${cell.inputLogId}">
            <span class="material-symbols-outlined text-[14px]">auto_awesome</span> Chat
          </button>
        </div>
      </div>
    `).join('');

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
            <button class="btn-first-cell group flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-surface-container-low border border-outline-variant/15 hover:border-primary/40 hover:bg-primary/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10" data-type="python">
              <div class="w-12 h-12 rounded-2xl bg-primary/15 group-hover:bg-primary/25 flex items-center justify-center transition-colors">
                <span class="material-symbols-outlined text-2xl text-primary" data-icon="code">code</span>
              </div>
              <div class="text-center">
                <div class="text-sm font-bold text-primary tracking-wide">Python</div>
                <div class="text-[11px] text-outline mt-0.5">Pandas, NumPy, Matplotlib</div>
              </div>
            </button>

            <button class="btn-first-cell group flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-surface-container-low border border-outline-variant/15 hover:border-secondary/40 hover:bg-secondary/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-secondary/10" data-type="sql">
              <div class="w-12 h-12 rounded-2xl bg-secondary/15 group-hover:bg-secondary/25 flex items-center justify-center transition-colors">
                <span class="material-symbols-outlined text-2xl text-secondary" data-icon="database">database</span>
              </div>
              <div class="text-center">
                <div class="text-sm font-bold text-secondary tracking-wide">SQL</div>
                <div class="text-[11px] text-outline mt-0.5">Query with DuckDB</div>
              </div>
            </button>

            <button class="btn-first-cell group flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-surface-container-low border border-outline-variant/15 hover:border-tertiary/40 hover:bg-tertiary/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-tertiary/10" data-type="chat">
              <div class="w-12 h-12 rounded-2xl bg-tertiary/15 group-hover:bg-tertiary/25 flex items-center justify-center transition-colors">
                <span class="material-symbols-outlined text-2xl text-tertiary" data-icon="smart_toy">smart_toy</span>
              </div>
              <div class="text-center">
                <div class="text-sm font-bold text-tertiary tracking-wide">Chat AI</div>
                <div class="text-[11px] text-outline mt-0.5">Ask a question in plain English</div>
              </div>
            </button>
          </div>

          <div class="mt-10 flex items-center gap-2 text-[11px] text-outline/50">
            <span class="material-symbols-outlined text-[14px]">keyboard</span>
            <span>Or use the <span class="font-mono text-outline/80">+ Python / SQL / Chat AI</span> bar below</span>
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

function bindInteractions(container: HTMLElement) {
  const activeId = store.getActiveAnalysisId();

  function createCellEditBlock(
    type: 'python' | 'sql' | 'chat',
    afterLogId: string | null,
    targetElement: HTMLElement,
    toolbarNode?: HTMLElement
  ) {
    const tempId = 'temp-' + Date.now();
    const newCell = document.createElement('div');
    newCell.className = 'glass-panel p-6 rounded-3xl space-y-6 bg-surface-container-low/30 border-primary/40 relative overflow-hidden group animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-primary/5 new-cell-block';
    
    let icon = "auto_awesome";
    let color = "text-secondary";
    let placeholder = "Enter AI instruction...";
    
    if (type === "sql") {
       icon = "database";
       color = "text-primary";
       placeholder = "Enter SQL query to execute...";
    } else if (type === "python") {
       icon = "code";
       color = "text-emerald-400";
       placeholder = "Enter Python script...";
    }

    newCell.innerHTML = `
       <div class="flex items-start gap-4">
          <div class="font-mono text-xs font-bold ${color}/80 pt-2.5 select-none w-14 text-right shrink-0 flex items-center justify-end gap-1">
             <span class="material-symbols-outlined text-[14px]">${icon}</span>
             In [*]:
          </div>
          
          <div class="flex-1 w-full" id="cell-edit-${tempId}">
             <div class="glass-panel p-1.5 rounded-xl group focus-within:border-${color.split('-')[1] || 'primary'}/30 transition-all duration-300 shadow-lg shadow-${color.split('-')[1] || 'primary'}/5 bg-surface-container-lowest/80 border-outline-variant/10">
                <div class="flex items-start gap-3 px-3">
                  <div class="flex-1 min-w-0 py-1.5">
                    <textarea id="cell-input-${tempId}" class="w-full bg-transparent border-none text-on-surface focus:ring-0 resize-none py-0 text-sm font-mono custom-scrollbar placeholder-outline-variant" rows="2" placeholder="${placeholder}"></textarea>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <button class="w-7 h-7 rounded-full bg-surface-container-highest text-outline flex items-center justify-center hover:bg-error/20 hover:text-error transition-colors btn-cancel-insert" title="Cancel">
                      <span class="material-symbols-outlined text-[14px]">close</span>
                    </button>
                    <button class="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-110 transition-transform btn-execute-new-cell shadow-md shadow-primary/20" data-type="${type}" data-after="${afterLogId || '__first__'}" data-temp-id="${tempId}" title="Run Cell">
                      <span class="material-symbols-outlined text-[14px]">play_arrow</span>
                    </button>
                  </div>
                </div>
             </div>
          </div>
       </div>
    `;

    if (toolbarNode) {
      toolbarNode.classList.add('hidden');
    }

    targetElement.insertAdjacentElement('afterend', newCell);
    
    // Auto-focus new textarea
    const txt = newCell.querySelector(`#cell-input-${tempId}`) as HTMLTextAreaElement;
    if (txt) {
       txt.focus();
       // Shift+Enter to run
       txt.addEventListener('keydown', (ev) => {
         if (ev.key === 'Enter' && ev.shiftKey) {
           ev.preventDefault();
           newCell.querySelector('.btn-execute-new-cell')?.dispatchEvent(new Event('click', { bubbles: true }));
         }
       });
    }

    // Handle Cancel Insert
    const cancelBtn = newCell.querySelector('.btn-cancel-insert');
    cancelBtn?.addEventListener('click', () => {
       newCell.remove();
       if (toolbarNode) {
          toolbarNode.classList.remove('hidden');
       }
       // If no cells are left in the container, restore welcome screen
       const cellContainer = container.querySelector('#cell-container');
       if (cellContainer && !cellContainer.querySelector('.glass-panel')) {
          updateNotebookUI(container);
       }
    });
  }

  const input = container.querySelector('#cell-input') as HTMLTextAreaElement;
  const btn = container.querySelector('#btn-execute');
  const btnMagic = container.querySelector('#btn-magic');
  const magicPopover = container.querySelector('#magic-popover');
  const suggestionsList = container.querySelector('#magic-suggestions-list');

  // Magic Suggestions
  btnMagic?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!activeId) return;

    if (magicPopover?.classList.contains('hidden')) {
      magicPopover.classList.remove('hidden');
      if (suggestionsList) {
        suggestionsList.innerHTML = `<div class="py-4 flex flex-col items-center gap-2 opacity-50"><span class="material-symbols-outlined animate-spin text-lg" data-icon="progress_activity">progress_activity</span></div>`;
        try {
          const prompts = await api.getSuggestedPrompts(activeId);
          suggestionsList.innerHTML = prompts.map(p => `
            <button class="magic-suggestion-item w-full text-left px-3 py-2 text-xs font-body-sm text-on-surface-variant hover:bg-primary/10 hover:text-primary rounded-lg" data-prompt="${p.replace(/"/g, '&quot;')}">${p}</button>
          `).join('');
          suggestionsList.querySelectorAll('.magic-suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
              const prompt = item.getAttribute('data-prompt');
              if (prompt && input) {
                input.value = prompt;
                input.dispatchEvent(new Event('input'));
                magicPopover.classList.add('hidden');
                input.focus();
              }
            });
          });
        } catch (err) { suggestionsList.innerHTML = `<div class="text-[10px] text-error p-2">Error</div>`; }
      }
    } else { magicPopover?.classList.add('hidden'); }
  });

  document.addEventListener('click', () => magicPopover?.classList.add('hidden'));

  // Footer "Add Cell" bar
  container.querySelector('#add-cell-bar')?.addEventListener('click', (e) => {
    const addBtn = (e.target as HTMLElement).closest('.btn-add-cell') as HTMLElement;
    if (!addBtn) return;
    const type = addBtn.getAttribute('data-type') as 'python' | 'sql' | 'chat';
    if (!type) return;
    
    const cellContainer = container.querySelector('#cell-container');
    if (!cellContainer) return;

    // Remove the welcome screen if it is there
    const welcome = cellContainer.querySelector('#notebook-welcome');
    if (welcome) welcome.remove();

    // Get the last log in the store to anchor the new cell after it
    const logs = store.getLogs();
    const lastLog = logs[logs.length - 1];
    const afterLogId = lastLog?.id ?? null;

    // Append cell at the end of the container
    const children = Array.from(cellContainer.children);
    const lastChild = children[children.length - 1] as HTMLElement;

    if (lastChild) {
      createCellEditBlock(type, afterLogId, lastChild);
    } else {
      const dummy = document.createElement('div');
      dummy.className = 'hidden';
      cellContainer.appendChild(dummy);
      createCellEditBlock(type, afterLogId, dummy);
    }

    cellContainer.scrollTop = cellContainer.scrollHeight;
  });

  // Delegated events for In-place Cell Editing
  container.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;

    // "First Cell" welcome screen chooser
    const firstCellBtn = target.closest('.btn-first-cell') as HTMLElement;
    if (firstCellBtn) {
      const type = firstCellBtn.getAttribute('data-type') as 'python' | 'sql' | 'chat';
      if (!type) return;
      const cellContainer = container.querySelector('#cell-container');
      if (!cellContainer) return;

      // Remove the welcome screen
      const welcome = cellContainer.querySelector('#notebook-welcome');
      welcome?.remove();

      // Create first cell edit block
      const dummy = document.createElement('div');
      dummy.className = 'hidden';
      cellContainer.appendChild(dummy);
      createCellEditBlock(type, null, dummy);
      return;
    }
    
    // Toggle Edit Mode
    const editBtn = target.closest('.btn-edit-cell') as HTMLElement;
    if (editBtn) {
      const idx = editBtn.getAttribute('data-cell-index');
      container.querySelector(`#cell-static-${idx}`)?.classList.add('hidden');
      container.querySelector(`#cell-edit-${idx}`)?.classList.remove('hidden');
      container.querySelector(`#cell-divider-${idx}`)?.classList.add('opacity-0');
      
      const txt = container.querySelector(`#cell-input-${idx}`) as HTMLTextAreaElement;
      if (txt) {
         txt.style.height = 'auto';
         txt.style.height = txt.scrollHeight + 'px';
         txt.focus();
      }
      return;
    }
    
    // Cancel Edit Mode
    const cancelBtn = target.closest('.btn-cancel-edit') as HTMLElement;
    if (cancelBtn) {
      const idx = cancelBtn.getAttribute('data-cell-index');
      container.querySelector(`#cell-static-${idx}`)?.classList.remove('hidden');
      container.querySelector(`#cell-edit-${idx}`)?.classList.add('hidden');
      container.querySelector(`#cell-divider-${idx}`)?.classList.remove('opacity-0');
      return;
    }
    
    // Rerun Cell
    const rerunBtn = target.closest('.btn-rerun-cell') as HTMLButtonElement;
    if (rerunBtn && activeId) {
      const idx = rerunBtn.getAttribute('data-cell-index');
      const logId = rerunBtn.getAttribute('data-log-id');
      const txt = container.querySelector(`#cell-input-${idx}`) as HTMLTextAreaElement;
      if (!txt || !logId) return;
      
      const question = txt.value;
      if (!question) return;
      
      rerunBtn.disabled = true;
      
      // Update cell UI to executing state
      container.querySelector(`#cell-edit-${idx}`)?.classList.add('hidden');
      const staticView = container.querySelector(`#cell-static-${idx}`);
      if (staticView) {
        staticView.classList.remove('hidden');
        staticView.textContent = '';
        const questionEl = document.createElement('div');
        questionEl.className = 'pr-8';
        questionEl.textContent = question; // Lock new text without edit button during execution
        staticView.appendChild(questionEl);
      }
      container.querySelector(`#cell-divider-${idx}`)?.classList.remove('opacity-0');
      
      const cellBody = rerunBtn.closest('.glass-panel.rounded-3xl');
      if (!cellBody) return;
      
      const outGutter = cellBody.querySelector('.text-secondary\\/50') as HTMLElement;
      if (outGutter) {
         outGutter.innerHTML = `<span class="material-symbols-outlined text-[10px] animate-spin" data-icon="progress_activity">progress_activity</span><span>Out [*]:</span>`;
         outGutter.classList.add('flex', 'items-center', 'justify-end', 'gap-1');
      }
      
      const outBody = outGutter?.nextElementSibling;
      if (outBody) {
        const streamingDiv = document.createElement('div');
        streamingDiv.className = 'prose prose-invert max-w-none text-on-surface-variant leading-relaxed font-body-lg animate-pulse';
        streamingDiv.id = `streaming-content-${idx}`;

        const cursor = document.createElement('span');
        cursor.className = 'inline-block w-1 h-4 bg-primary animate-pulse';
        streamingDiv.appendChild(cursor);

        outBody.replaceChildren(streamingDiv);
      }
      
      let fullText = "";
      const streamingContent = outBody?.querySelector(`#streaming-content-${idx}`);

      api.streamQuestion(activeId, question, logId, null,
        (token) => {
          fullText += token;
          if (streamingContent) {
            streamingContent.innerHTML = renderMarkdown(fullText) + '<span class="inline-block w-1 h-4 bg-primary animate-pulse ml-1"></span>';
          }
        },
        async () => {
          if (streamingContent) {
            streamingContent.innerHTML = renderMarkdown(fullText);
            streamingContent.classList.remove('animate-pulse');
          }
          if (outGutter) {
            outGutter.textContent = `Out [${idx}]:`;
            outGutter.classList.remove('flex', 'items-center', 'justify-end', 'gap-1');
          }
          
          const newLogs = await api.listLogs(activeId);
          lastLogsJson = JSON.stringify(newLogs);
          store.setLogs(newLogs);
        },
        (err) => {
          console.error('Rerun error', err);
          if (outGutter) {
             outGutter.textContent = `Out [${idx}]:`;
             outGutter.classList.remove('flex', 'items-center', 'justify-end', 'gap-1');
          }
        }
      );
    }

    // Insert New Unexecuted Cell
    const insertBtn = target.closest('.btn-insert-cell') as HTMLElement;
    if (insertBtn) {
      const type = insertBtn.getAttribute('data-type') as 'python' | 'sql' | 'chat';
      const afterLogId = insertBtn.getAttribute('data-after');
      const toolbarNode = insertBtn.closest('.group\\/toolbar') as HTMLElement;
      
      if (!toolbarNode || !type || !afterLogId) return;

      createCellEditBlock(type, afterLogId, toolbarNode, toolbarNode);
    }

    // Execute Newly Inserted Cell
    const runNewBtn = target.closest('.btn-execute-new-cell') as HTMLButtonElement;
    if (runNewBtn && activeId) {
       const type = runNewBtn.getAttribute('data-type');
       const rawAfter = runNewBtn.getAttribute('data-after');
       // '__first__' is a sentinel meaning "no anchor — just append"
       const afterLogId = (rawAfter && rawAfter !== '__first__') ? rawAfter : null;
       const tempId = runNewBtn.getAttribute('data-temp-id');
       
       if (!type || !tempId) return;
       
       const txt = container.querySelector(`#cell-input-${tempId}`) as HTMLTextAreaElement;
       const question = txt?.value;
       if (!question) return;

       runNewBtn.disabled = true;

       const cellBody = runNewBtn.closest('.glass-panel.rounded-3xl');
       if (!cellBody) return;

       // Transition UI to executing state
       const editView = container.querySelector(`#cell-edit-${tempId}`);
       if (editView) {
          const staticDiv = document.createElement('div');
          staticDiv.className = 'flex-1 font-mono text-sm text-primary-fixed-dim bg-surface-container-lowest/80 border border-outline-variant/10 rounded-xl p-3.5 shadow-inner overflow-x-auto';
          staticDiv.textContent = question;
          editView.replaceWith(staticDiv);
       }

       // Append Output Gutter
       const outputDiv = document.createElement('div');
       outputDiv.className = 'flex items-start gap-4 mt-6 border-t border-outline-variant/10 pt-6';
       outputDiv.innerHTML = `
          <div class="font-mono text-xs font-bold text-secondary/50 pt-1 select-none w-14 text-right shrink-0 flex items-center justify-end gap-1 out-label">
             <span class="material-symbols-outlined text-[10px] animate-spin" data-icon="progress_activity">progress_activity</span>
             <span>Out [*]:</span>
          </div>
          <div class="flex-1 min-w-0" id="out-body-${tempId}">
             <div class="prose prose-invert max-w-none text-on-surface-variant leading-relaxed font-body-lg animate-pulse" id="streaming-content-${tempId}">
                <span class="inline-block w-1 h-4 bg-primary animate-pulse"></span>
             </div>
          </div>
       `;
       cellBody.appendChild(outputDiv);

       const outGutter = outputDiv.querySelector('.out-label') as HTMLElement;
       const streamingContent = outputDiv.querySelector(`#streaming-content-${tempId}`);

       if (type === 'chat') {
          let fullText = "";
          api.streamQuestion(activeId, question, null, afterLogId,
             (token) => {
                fullText += token;
                if (streamingContent) streamingContent.innerHTML = renderMarkdown(fullText) + '<span class="inline-block w-1 h-4 bg-primary animate-pulse ml-1"></span>';
             },
             async () => {
                const newLogs = await api.listLogs(activeId);
                lastLogsJson = JSON.stringify(newLogs);
                store.setLogs(newLogs);
             },
             (err) => console.error(err)
          );
       } else if (type === 'sql' || type === 'python') {
          try {
             if (type === 'sql') {
                await api.executeSql(activeId, question, null, afterLogId);
             } else {
                await api.executePython(activeId, question, null, afterLogId);
             }
             const newLogs = await api.listLogs(activeId);
             lastLogsJson = JSON.stringify(newLogs);
             store.setLogs(newLogs);
          } catch (e) {
             console.error(e);
             if (outGutter) {
                outGutter.textContent = `Error`;
             }
             if (streamingContent) {
                streamingContent.innerHTML = `<span class="text-error">Execution Failed.</span>`;
                streamingContent.classList.remove('animate-pulse');
             }
          }
       }
    }

     // Data Source Preview Modal trigger
     const previewBtn = target.closest('.btn-preview-data') as HTMLElement;
     if (previewBtn) {
       const fullTable = previewBtn.getAttribute('data-table');
       const filename = previewBtn.getAttribute('data-filename');
       if (fullTable) {
         showDataPreviewModal(fullTable, filename || 'Data Source');
       }
     }
  });
}

async function showDataPreviewModal(fullTableName: string, filename: string) {
  let modal = document.getElementById('data-preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'data-preview-modal';
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md opacity-0 pointer-events-none transition-opacity duration-300';
    modal.innerHTML = `
      <div class="glass-panel p-6 rounded-3xl w-11/12 max-w-5xl max-h-[85vh] flex flex-col shadow-2xl shadow-primary/20 bg-surface-container-low/90 border-outline-variant/20 scale-95 transition-transform duration-300" id="data-preview-content">
        <div class="flex justify-between items-center mb-4 shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <span class="material-symbols-outlined">database</span>
            </div>
            <div class="min-w-0">
              <h3 class="text-xl font-headline-sm text-white truncate max-w-xl" id="preview-title">Data Preview</h3>
              <p class="text-[11px] text-primary/70 font-mono tracking-widest uppercase mt-0.5" id="preview-subtitle">Loading...</p>
            </div>
          </div>
          <button class="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center hover:bg-error/20 hover:text-error transition-colors shrink-0" id="btn-close-preview">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="flex-1 min-h-0 overflow-auto custom-scrollbar bg-surface-container-lowest/50 rounded-2xl border border-outline-variant/10" id="preview-table-container">
           <div class="flex items-center justify-center h-40">
             <span class="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
           </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('#btn-close-preview')?.addEventListener('click', () => {
      modal?.classList.add('opacity-0', 'pointer-events-none');
      modal?.querySelector('#data-preview-content')?.classList.replace('scale-100', 'scale-95');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal?.classList.add('opacity-0', 'pointer-events-none');
        modal?.querySelector('#data-preview-content')?.classList.replace('scale-100', 'scale-95');
      }
    });
  }
  
  const titleEl = modal.querySelector('#preview-title');
  const subtitleEl = modal.querySelector('#preview-subtitle');
  const tableContainer = modal.querySelector('#preview-table-container');
  
  if (titleEl) titleEl.textContent = filename || 'Data Preview';
  if (subtitleEl) subtitleEl.textContent = `Table: ${fullTableName}`;
  if (tableContainer) {
    tableContainer.innerHTML = `<div class="flex items-center justify-center h-64"><span class="material-symbols-outlined animate-spin text-primary text-4xl shadow-primary/20 shadow-lg rounded-full">progress_activity</span></div>`;
  }
  
  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.querySelector('#data-preview-content')?.classList.replace('scale-95', 'scale-100');
  
  try {
    const data = await api.getTablePreview(fullTableName);
    
    if (!data || data.length === 0) {
      if (tableContainer) tableContainer.innerHTML = `<div class="flex flex-col items-center justify-center h-64 text-outline"><span class="material-symbols-outlined text-4xl mb-2 opacity-50">draft</span><p>No rows found</p></div>`;
      return;
    }
    
    const keys = Object.keys(data[0]);
    let html = `
      <table class="w-full text-left border-collapse text-sm font-mono">
        <thead class="bg-surface-container-highest text-xs uppercase tracking-wider text-primary sticky top-0 shadow-sm z-10">
          <tr>${keys.map(k => `<th class="px-6 py-4 font-medium whitespace-nowrap border-b border-primary/20">${k}</th>`).join('')}</tr>
        </thead>
        <tbody class="divide-y divide-outline-variant/10">`;
        
    data.forEach((row: any) => {
      html += `<tr class="hover:bg-surface-container-low/70 transition-colors">
        ${keys.map(k => {
           let val = row[k];
           if (val === null || val === undefined) return '<td class="px-6 py-3"><span class="text-outline/40 italic text-[11px]">null</span></td>';
           if (typeof val === 'object') val = JSON.stringify(val);
           return `<td class="px-6 py-3 text-on-surface-variant truncate max-w-sm" title="${val}">${val}</td>`;
        }).join('')}
      </tr>`;
    });
    
    html += `</tbody></table>`;
    if (tableContainer) tableContainer.innerHTML = html;
    
  } catch (err) {
    if (tableContainer) tableContainer.innerHTML = `<div class="flex flex-col items-center justify-center h-64 text-error"><span class="material-symbols-outlined text-4xl mb-2 opacity-80">error</span><p>Failed to load data preview.</p></div>`;
  }
}
