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
        <header class="flex justify-between items-center px-12 py-8 bg-surface-container-low border-b border-outline-variant/10 z-10">
          <div class="space-y-1" id="header-info">
            <h2 class="text-2xl font-headline-lg text-white" id="analysis-title">${analysis.title}</h2>
            <div class="flex items-center gap-4" id="analysis-status-container">
               <!-- Status will be updated here -->
            </div>
          </div>
          <div class="flex items-center gap-4">
            <button class="p-2 text-outline hover:text-white transition-colors">
              <span class="material-symbols-outlined" data-icon="settings">settings</span>
            </button>
            <button class="p-2 text-outline hover:text-white transition-colors">
              <span class="material-symbols-outlined" data-icon="share">share</span>
            </button>
          </div>
        </header>

        <!-- Dynamic Context Metadata Banner -->
        <div class="px-12 pt-8 z-10 shrink-0" id="metadata-banner-container"></div>

        <!-- Scrollable Cells Area -->
        <div class="flex-1 overflow-y-auto px-12 pt-8 pb-32 space-y-8 custom-scrollbar" id="cell-container">
          <!-- Logs grouped as Jupyter cells will be updated here -->
        </div>

        <!-- Jupyter-Style Interactive Cell Input -->
        <div class="w-full px-12 pb-12 pt-6 bg-gradient-to-t from-background via-background/90 to-transparent relative z-20 border-t border-outline-variant/5">
          <div class="max-w-4xl mx-auto flex items-start gap-4">
             <div class="font-mono text-xs font-bold text-primary/40 pt-5 select-none w-14 text-right shrink-0" id="next-cell-index-tag">
                In [${nextIndex}]:
             </div>
             <div class="flex-1 glass-panel p-2 rounded-2xl group focus-within:border-primary/30 transition-all duration-500 shadow-2xl shadow-primary/5 bg-surface-container-low/60">
                <div class="flex items-center gap-4 px-4">
                  <button id="btn-magic" class="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors relative group/magic" title="Magic Suggestions">
                     <span class="material-symbols-outlined text-primary text-xl group-hover/magic:rotate-12 transition-transform" data-icon="auto_awesome">auto_awesome</span>
                     <div id="magic-popover" class="absolute bottom-full left-0 mb-4 w-80 glass-panel p-4 rounded-2xl hidden animate-in fade-in slide-in-from-bottom-2 duration-300 z-50">
                        <div class="flex items-center gap-2 mb-3 text-tertiary">
                          <span class="material-symbols-outlined text-sm" data-icon="lightbulb">lightbulb</span>
                          <span class="text-[10px] font-label-md uppercase tracking-[0.2em]">Neural Suggestions</span>
                        </div>
                        <div id="magic-suggestions-list" class="space-y-2"></div>
                     </div>
                  </button>
                  <div class="flex-1 min-w-0 py-2">
                    <textarea id="cell-input" class="w-full bg-transparent border-none text-on-surface focus:ring-0 resize-none py-2 text-lg font-body-lg max-h-48 custom-scrollbar" placeholder="Enter follow-up query..." rows="1"></textarea>
                  </div>
                  <div class="flex items-center pr-2">
                    <button id="btn-execute" class="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-50 disabled:scale-100 group/btn shadow-lg shadow-primary/20">
                      <span class="material-symbols-outlined text-xl group-hover/btn:translate-x-0.5 transition-transform" data-icon="arrow_forward">arrow_forward</span>
                    </button>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    `;
    
    bindInteractions(container);
  }

  // Update Dynamic Context Metadata Banner
  const banner = container.querySelector('#metadata-banner-container');
  if (banner) {
    banner.innerHTML = `
      <div class="glass-panel p-5 rounded-2xl border-outline-variant/10 bg-surface-container-low/40 relative overflow-hidden flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <!-- Left side: Attached Context Resources -->
        <div class="space-y-2 flex-1 min-w-0">
          <div class="flex items-center gap-2 text-outline-variant text-[10px] font-label-md uppercase tracking-[0.2em] opacity-80">
            <span class="material-symbols-outlined text-sm" data-icon="inventory_2">inventory_2</span>
            <span>Active Context Resources</span>
          </div>
          <div class="flex flex-wrap gap-2">
            ${attachedSources.length === 0 && attachedKnowledges.length === 0
              ? `<span class="text-xs text-outline italic">No context resources attached</span>`
              : ''
            }
            ${attachedSources.map(ds => `
              <div class="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-xs rounded-full min-w-0 hover:bg-primary/20 transition-colors" title="DuckDB Data Source Table: ${ds.table_name}">
                <span class="material-symbols-outlined text-[14px]" data-icon="database">database</span>
                <span class="truncate max-w-[150px] font-medium">${ds.original_filename}</span>
              </div>
            `).join('')}
            ${attachedKnowledges.map(kp => `
              <div class="flex items-center gap-1.5 px-3 py-1 bg-emerald/10 border border-emerald/20 text-emerald-400 text-xs rounded-full min-w-0 hover:bg-emerald/20 transition-colors">
                <span class="material-symbols-outlined text-[14px]" data-icon="local_library">local_library</span>
                <span class="truncate max-w-[150px] font-medium">${kp.title}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Right side: Owner & Update Timestamp -->
        <div class="flex gap-6 md:border-l border-outline-variant/10 md:pl-6 shrink-0 w-full md:w-auto justify-between md:justify-end">
          <!-- Owner -->
          <div class="flex flex-col gap-0.5 min-w-[100px]">
            <span class="text-[9px] uppercase tracking-widest text-outline opacity-60 font-bold">Owner</span>
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm text-secondary" data-icon="shield">shield</span>
              <span class="text-xs text-white font-medium truncate max-w-[120px]">${ownerName}</span>
            </div>
          </div>
          
          <!-- Updated Time -->
          <div class="flex flex-col gap-0.5 min-w-[120px]">
            <span class="text-[9px] uppercase tracking-widest text-outline opacity-60 font-bold">Latest Edition</span>
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm text-outline" data-icon="history">history</span>
              <span class="text-xs text-white font-medium">${formattedDate}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Update Status
  const statusContainer = container.querySelector('#analysis-status-container');
  if (statusContainer) {
    statusContainer.innerHTML = `
      <span class="flex items-center gap-2 text-xs font-label-md text-tertiary uppercase tracking-widest">
        <span class="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
        ${analysis.status}
      </span>
      <span class="text-[10px] text-outline uppercase tracking-widest font-label-sm opacity-50"># ${logs.length} Steps</span>
    `;
  }

  // Update Active Input Cell Tag
  const nextCellIndexTag = container.querySelector('#next-cell-index-tag');
  if (nextCellIndexTag) {
    nextCellIndexTag.innerHTML = `In [${nextIndex}]:`;
  }

  // Update Logs only if they changed and we are NOT streaming
  const cellContainer = container.querySelector('#cell-container') as HTMLElement;
  const isStreaming = cellContainer?.querySelector('#streaming-content') !== null;
  
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
         <div class="flex items-start gap-4">
            <div class="font-mono text-xs font-bold text-primary/50 pt-2.5 select-none w-14 text-right shrink-0">
               In [${cell.index}]:
            </div>
            <div class="flex-1 font-mono text-sm text-primary-fixed-dim bg-surface-container-lowest/80 border border-outline-variant/10 rounded-xl p-3.5 shadow-inner overflow-x-auto">
               ${cell.inputContent}
            </div>
         </div>

         <!-- Cell Divider Line -->
         <div class="h-px bg-outline-variant/10 ml-18 mr-2"></div>

         <!-- Cell Body: Output (Out [X]) -->
         <div class="flex items-start gap-4">
            <div class="font-mono text-xs font-bold text-secondary/50 pt-1 select-none w-14 text-right shrink-0">
               Out [${cell.index}]:
            </div>
            <div class="flex-1 space-y-6 min-w-0">
               ${cell.outputs.length === 0 
                 ? `<span class="text-xs text-outline italic">No output generated</span>`
                 : cell.outputs.map(out => `
                     <div class="prose prose-invert max-w-none text-on-surface-variant leading-relaxed font-body-lg">
                       ${renderMarkdown(out.content)}
                     </div>
                     ${out.data && out.data.type === 'chart' ? `
                       <div class="mt-4 glass-panel p-6 rounded-2xl border-primary/20 h-80 relative bg-surface-container-lowest/30">
                         <canvas id="chart-${out.id}"></canvas>
                       </div>
                     ` : ''}
                   `).join('')
               }
            </div>
         </div>
      </div>
    `).join('');

    cellContainer.innerHTML = html;
    
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
  magicPopover?.addEventListener('click', (e) => e.stopPropagation());

  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      btn?.dispatchEvent(new Event('click'));
    }
  });

  btn?.addEventListener('click', async () => {
    const question = input.value;
    if (!question || !activeId) return;
    
    input.value = '';
    input.style.height = 'auto';
    btn.setAttribute('disabled', 'true');

    const cellContainer = container.querySelector('#cell-container');
    if (!cellContainer) return;

    const logs = store.getLogs();
    const nextIndex = logs.filter(log => log.log_type === 'user_query').length + 1;

    // Create a live streaming Notebook Cell Card
    const liveCellCard = document.createElement('div');
    liveCellCard.className = 'glass-panel p-6 rounded-3xl space-y-6 bg-surface-container-low/30 border-outline-variant/10 relative overflow-hidden group border-primary/20 animate-in fade-in duration-300';
    liveCellCard.innerHTML = `
       <!-- Cell Header: Input (In [X]) -->
       <div class="flex items-start gap-4">
          <div class="font-mono text-xs font-bold text-primary/50 pt-2.5 select-none w-14 text-right shrink-0">
             In [${nextIndex}]:
          </div>
          <div class="flex-1 font-mono text-sm text-primary-fixed-dim bg-surface-container-lowest/80 border border-outline-variant/10 rounded-xl p-3.5 shadow-inner overflow-x-auto">
             ${question}
          </div>
       </div>

       <!-- Cell Divider Line -->
       <div class="h-px bg-outline-variant/10 ml-18 mr-2"></div>

       <!-- Cell Body: Output (Out [X]) -->
       <div class="flex items-start gap-4">
          <div class="font-mono text-xs font-bold text-secondary/50 pt-1 select-none w-14 text-right shrink-0 flex items-center justify-end gap-1">
             <span class="material-symbols-outlined text-[10px] animate-spin" data-icon="progress_activity">progress_activity</span>
             <span>Out [*]:</span>
          </div>
          <div class="flex-1 prose prose-invert max-w-none text-on-surface-variant leading-relaxed font-body-lg animate-pulse" id="streaming-content">
             <span class="inline-block w-1 h-4 bg-primary animate-pulse"></span>
          </div>
       </div>
    `;
    
    cellContainer.appendChild(liveCellCard);
    cellContainer.scrollTop = cellContainer.scrollHeight;

    let fullText = "";
    const streamingContent = liveCellCard.querySelector('#streaming-content');

    api.streamQuestion(activeId, question, 
      (token) => {
        fullText += token;
        if (streamingContent) {
          streamingContent.innerHTML = renderMarkdown(fullText) + '<span class="inline-block w-1 h-4 bg-primary animate-pulse ml-1"></span>';
          cellContainer.scrollTop = cellContainer.scrollHeight;
        }
      },
      async () => {
        if (streamingContent) {
          streamingContent.innerHTML = renderMarkdown(fullText);
          streamingContent.classList.remove('animate-pulse');
        }
        
        // Remove loading state from Out index gutter
        const label = liveCellCard.querySelector('.text-secondary\\/50') as HTMLElement;
        if (label) {
          label.innerHTML = `Out [${nextIndex}]:`;
        }

        btn.removeAttribute('disabled');
        const newLogs = await api.listLogs(activeId);
        lastLogsJson = JSON.stringify(newLogs); // Mark as updated to avoid immediate re-render from poll
        store.setLogs(newLogs);
      },
      (err) => {
        console.error('Streaming error', err);
        btn.removeAttribute('disabled');
      }
    );
  });

  // Follow-up question clicks
  container.querySelectorAll('.followup-question-btn').forEach(fBtn => {
    fBtn.addEventListener('click', () => {
      const question = fBtn.getAttribute('data-question');
      if (!question) return;
      if (input) {
        input.value = question;
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
        btn?.dispatchEvent(new Event('click'));
      }
    });
  });
}


