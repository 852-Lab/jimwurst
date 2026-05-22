import { store } from '../../store';
import { renderMarkdown, renderRichOutput, renderChart } from './notebook/templates';
import { bindQuickInsightInteractions } from './QuickInsightInteractions';

const executingCells = new Set<string>();

export function renderQuickInsightView() {
  const container = document.createElement('div');
  container.id = 'quick-insight-view-inner';
  container.className = 'flex flex-col h-full w-full';
  
  container.innerHTML = `
    <!-- Scrollable Cells Area -->
    <div class="flex-1 overflow-y-auto px-12 pt-8 pb-8 space-y-8 custom-scrollbar" id="cell-container">
      <!-- Chat logs will be updated here -->
    </div>

    <!-- Chatbox Footer -->
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
  `;
  
  bindQuickInsightInteractions(container);
  return container;
}

interface ChatCell {
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

function groupLogsIntoChatCells(logsList: any[]): ChatCell[] {
  const cells: ChatCell[] = [];
  let cellCounter = 1;
  let currentCell: ChatCell | null = null;
  
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

export function updateQuickInsightView(container: HTMLElement) {
  const activeId = store.getActiveAnalysisId();
  const analyses = store.getAnalyses();
  const analysis = analyses.find(a => a.id === activeId);
  const logs = store.getLogs();

  if (!analysis) return;

  const cellContainer = container.querySelector('#cell-container');
  if (!cellContainer) return;

  // Track executing state from store
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

  // 2. Render chat cells
  const chatCells = groupLogsIntoChatCells(logs);
  
  html += chatCells.map(cell => {
    return `
      <div class="space-y-8 py-4 relative group animate-in fade-in duration-300">
        <!-- User Question Bubble -->
        ${cell.inputContent && cell.inputContent !== 'Initialize Sequence Brain' ? `
        <div class="flex flex-col items-end gap-2 mb-8">
           <div class="max-w-[85%] bg-surface-container-highest/80 px-6 py-4 rounded-3xl rounded-tr-md text-on-surface text-[15px] font-medium leading-relaxed border border-outline-variant/10 shadow-sm whitespace-pre-wrap">${cell.inputContent}</div>
        </div>
        ` : ''}
        
        <!-- AI Answer -->
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-2xl bg-secondary/15 flex flex-shrink-0 items-center justify-center border border-secondary/20 shadow-lg shadow-secondary/5 mt-1">
            <span class="material-symbols-outlined text-secondary" data-icon="auto_awesome">auto_awesome</span>
          </div>
          <div class="flex-1 min-w-0 space-y-6 pt-1">
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
      </div>
    `;
  }).join('');

  const prevScrollTop = cellContainer.scrollTop;
  const isAtBottom = cellContainer.scrollHeight - prevScrollTop <= cellContainer.clientHeight + 50;

  cellContainer.innerHTML = html;

  // Render charts that are present in the output data
  chatCells.forEach(cell => {
    cell.outputs.forEach(out => {
      if (out.data && out.data.type === 'chart') {
        renderChart(`chart-${out.id}`, out.data);
      }
    });
  });

  if (isAtBottom) {
    cellContainer.scrollTop = cellContainer.scrollHeight;
  } else {
    cellContainer.scrollTop = prevScrollTop;
  }
}
