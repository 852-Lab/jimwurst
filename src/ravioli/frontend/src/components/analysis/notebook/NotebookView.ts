import { store } from '../../../store';
import { highlightSQL, highlightPython } from './utils';
import { renderMarkdown, renderRichOutput } from './templates';
import { bindNotebookInteractions } from './NotebookInteractions';

const executingCells = new Set<string>();

export function renderNotebookView() {
  const container = document.createElement('div');
  container.id = 'notebook-view-inner';
  container.className = 'flex flex-col h-full w-full';
  
  container.innerHTML = `
    <!-- Scrollable Cells Area -->
    <div class="flex-1 overflow-y-auto px-12 pt-8 pb-8 space-y-8 custom-scrollbar" id="cell-container">
      <!-- Logs grouped as Jupyter cells will be updated here -->
    </div>

    <!-- Add Cell Footer Bar -->
    <div class="shrink-0 flex items-center justify-center gap-3 py-4 px-12 border-t border-outline-variant/10 bg-surface-container-low/40 backdrop-blur-sm" id="add-cell-bar">
      <span class="text-[10px] text-outline uppercase tracking-widest font-label-sm opacity-60 mr-2">Add cell</span>
      <button class="btn-add-cell flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/20 text-outline text-[11px] rounded-full hover:bg-secondary/10 hover:border-secondary/30 hover:text-secondary transition-all duration-200 group/add" data-type="chat">
        <span class="material-symbols-outlined text-[14px] group-hover/add:text-secondary" data-icon="smart_toy">smart_toy</span>
        AI Cell
      </button>
      <button class="btn-add-cell flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/20 text-outline text-[11px] rounded-full hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all duration-200 group/add" data-type="sql">
        <span class="material-symbols-outlined text-[14px] group-hover/add:text-primary" data-icon="database">database</span>
        SQL Cell
      </button>
      <button class="btn-add-cell flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/20 text-outline text-[11px] rounded-full hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 transition-all duration-200 group/add" data-type="python">
        <span class="material-symbols-outlined text-[14px] group-hover/add:text-emerald-400" data-icon="code">code</span>
        Python Cell
      </button>
      <button class="btn-add-cell flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/20 text-outline text-[11px] rounded-full hover:bg-indigo-400/10 hover:border-indigo-400/30 hover:text-indigo-400 transition-all duration-200 group/add" data-type="markdown">
        <span class="material-symbols-outlined text-[14px] group-hover/add:text-indigo-400" data-icon="article">article</span>
        Text / Markdown
      </button>
    </div>
  `;
  
  bindNotebookInteractions(container, updateNotebookView);
  return container;
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

export function updateNotebookView(container: HTMLElement) {
  const activeId = store.getActiveAnalysisId();
  const analyses = store.getAnalyses();
  const analysis = analyses.find(a => a.id === activeId);
  const logs = store.getLogs();

  if (!analysis) return;

  const cellContainer = container.querySelector('#cell-container');
  if (!cellContainer) return;

  // Track executing state from store to determine if we need to show loading
  logs.forEach(log => {
    if (log.log_type === 'user_query') {
      executingCells.add(log.id);
    } else {
      const idx = logs.findIndex(l => l.id === log.id);
      for (let i = idx - 1; i >= 0; i--) {
        if (logs[i].log_type === 'user_query') {
          if (log.content && log.content.trim() !== '') {
             executingCells.delete(logs[i].id);
          }
          break;
        }
      }
    }
  });
  
  const lastLog = logs[logs.length - 1];
  if (lastLog && lastLog.log_type !== 'user_query' && lastLog.content) {
     for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].log_type === 'user_query') {
           executingCells.delete(logs[i].id);
           break;
        }
     }
  }

  let html = '';

  // 1. Executive Summary as Cell 0 / Overview
  if (analysis.result) {
    html += `
      <div class="glass-panel p-6 rounded-3xl space-y-6 bg-surface-container-low/30 border-outline-variant/10 relative overflow-hidden flex items-start gap-4">
        <div class="w-12 h-12 rounded-2xl bg-secondary/15 flex flex-shrink-0 items-center justify-center border border-secondary/20 shadow-lg shadow-secondary/5">
          <span class="material-symbols-outlined text-secondary text-2xl" data-icon="auto_awesome">auto_awesome</span>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-xl font-headline-sm text-white mb-2 tracking-tight">Executive Summary</h3>
          <div class="prose prose-invert max-w-none text-on-surface-variant leading-relaxed font-body-lg">
            ${renderMarkdown(analysis.result)}
          </div>
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
               <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-secondary flex items-center gap-1 hover:bg-secondary/20 px-2 py-1 rounded-lg transition-colors" data-type="chat" data-after="${cell.inputLogId}">
                 <span class="material-symbols-outlined text-[14px]">auto_awesome</span> AI
               </button>
               <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
               <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-primary flex items-center gap-1 hover:bg-primary/20 px-2 py-1 rounded-lg transition-colors" data-type="sql" data-after="${cell.inputLogId}">
                 <span class="material-symbols-outlined text-[14px]">database</span> SQL
               </button>
               <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
               <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1 hover:bg-emerald-400/20 px-2 py-1 rounded-lg transition-colors" data-type="python" data-after="${cell.inputLogId}">
                 <span class="material-symbols-outlined text-[14px]">code</span> Python
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
                                 <div class="pr-8 ${cell.toolName === 'markdown' ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}">${cell.toolName === 'sql' ? highlightSQL(cell.inputContent) : cell.toolName === 'python' ? highlightPython(cell.inputContent) : cell.inputContent}</div>${cell.toolName === 'sql' ? `<div class="mt-3 flex items-center justify-between border-t border-outline-variant/5 pt-2"><span class="text-[10px] font-mono text-outline uppercase tracking-wider select-none bg-surface-container-highest/40 px-2 py-0.5 rounded border border-outline-variant/10">SQL • ${(() => { const l = (cell.inputContent || '').split('\\n').length; return `${l} ${l === 1 ? 'line' : 'lines'}`; })()}</span></div>` : cell.toolName === 'python' ? `<div class="mt-3 flex items-center justify-between border-t border-outline-variant/5 pt-2"><span class="text-[10px] font-mono text-outline uppercase tracking-wider select-none bg-surface-container-highest/40 px-2 py-0.5 rounded border border-outline-variant/10">Python • ${(() => { const l = (cell.inputContent || '').split('\\n').length; return `${l} ${l === 1 ? 'line' : 'lines'}`; })()}</span></div>` : ''}
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
                        const lines = (cell.inputContent || '').split('\\n');
                        return lines.map((_, i) => i + 1).join('\\n');
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
                      const lineCount = (cell.inputContent || '').split('\\n').length;
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
             <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-secondary flex items-center gap-1 hover:bg-secondary/20 px-2 py-1 rounded-lg transition-colors" data-type="chat" data-after="${cell.inputLogId}">
               <span class="material-symbols-outlined text-[14px]">auto_awesome</span> AI
             </button>
             <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
             <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-primary flex items-center gap-1 hover:bg-primary/20 px-2 py-1 rounded-lg transition-colors" data-type="sql" data-after="${cell.inputLogId}">
               <span class="material-symbols-outlined text-[14px]">database</span> SQL
             </button>
             <div class="w-px h-3 bg-outline-variant/30 mx-1"></div>
             <button class="btn-insert-cell text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1 hover:bg-emerald-400/20 px-2 py-1 rounded-lg transition-colors" data-type="python" data-after="${cell.inputLogId}">
               <span class="material-symbols-outlined text-[14px]">code</span> Python
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
        <p class="text-sm text-outline text-center max-w-sm mb-10 leading-relaxed">Choose a cell type to begin. You can mix AI, SQL, Python, and Markdown freely in the same notebook.</p>

        <div class="flex items-center gap-4">
          <button class="btn-first-cell group flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-surface-container-low border border-outline-variant/15 hover:border-secondary/40 hover:bg-secondary/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-secondary/10" data-type="chat">
            <div class="w-12 h-12 rounded-2xl bg-secondary/15 group-hover:bg-secondary/25 flex items-center justify-center transition-colors">
              <span class="material-symbols-outlined text-2xl text-secondary" data-icon="smart_toy">smart_toy</span>
            </div>
            <div class="text-center">
              <div class="text-sm font-bold text-secondary tracking-wide">AI Cell</div>
              <div class="text-[11px] text-outline mt-0.5">Agentic Assistance</div>
            </div>
          </button>

          <button class="btn-first-cell group flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-surface-container-low border border-outline-variant/15 hover:border-primary/40 hover:bg-primary/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10" data-type="sql">
            <div class="w-12 h-12 rounded-2xl bg-primary/15 group-hover:bg-primary/25 flex items-center justify-center transition-colors">
              <span class="material-symbols-outlined text-2xl text-primary" data-icon="database">database</span>
            </div>
            <div class="text-center">
              <div class="text-sm font-bold text-primary tracking-wide">SQL Cell</div>
              <div class="text-[11px] text-outline mt-0.5">Query with DuckDB</div>
            </div>
          </button>

          <button class="btn-first-cell group flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-surface-container-low border border-outline-variant/15 hover:border-emerald-400/40 hover:bg-emerald-400/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-400/10" data-type="python">
            <div class="w-12 h-12 rounded-2xl bg-emerald-400/15 group-hover:bg-emerald-400/25 flex items-center justify-center transition-colors">
              <span class="material-symbols-outlined text-2xl text-emerald-400" data-icon="code">code</span>
            </div>
            <div class="text-center">
              <div class="text-sm font-bold text-emerald-400 tracking-wide">Python Cell</div>
              <div class="text-[11px] text-outline mt-0.5">Pandas, NumPy, Matplotlib</div>
            </div>
          </button>

          <button class="btn-first-cell group flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-surface-container-low border border-outline-variant/15 hover:border-indigo-400/40 hover:bg-indigo-400/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-400/10" data-type="markdown">
            <div class="w-12 h-12 rounded-2xl bg-indigo-400/15 group-hover:bg-indigo-400/25 flex items-center justify-center transition-colors">
              <span class="material-symbols-outlined text-2xl text-indigo-400" data-icon="article">article</span>
            </div>
            <div class="text-center">
              <div class="text-sm font-bold text-indigo-400 tracking-wide">Text / Markdown</div>
              <div class="text-[11px] text-outline mt-0.5">Notes, context, findings</div>
            </div>
          </button>
        </div>
      </div>
    `;
  }
}
