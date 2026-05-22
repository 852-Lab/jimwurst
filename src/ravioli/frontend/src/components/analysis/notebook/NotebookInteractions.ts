import { store } from '../../../store';
import { api } from '../../../services/api';
import { 
  parseCellType, 
  parseAfterLogId, 
  toggleComment, 
  updateLineNumbers, 
  updateLineGutterScroll,
  highlightSQL
} from './utils';
import { renderMarkdown } from './templates';

const executingCells = new Set<string>();

export function bindNotebookInteractions(container: HTMLElement, updateNotebookUI: (c: HTMLElement) => void) {
  const activeId = store.getActiveAnalysisId();

  // Double click to edit cell static view
  container.addEventListener('dblclick', (e) => {
    const staticView = (e.target as HTMLElement).closest('.cell-static-view') as HTMLElement;
    if (staticView) {
      const editBtn = staticView.querySelector('.btn-edit-cell') as HTMLElement;
      editBtn?.click();
    }
  });

  // Real-time LOC line counting & Gutter update
  container.addEventListener('input', (e) => {
    const textarea = e.target as HTMLTextAreaElement;
    if (textarea && textarea.id && textarea.id.startsWith('cell-input-')) {
      const idxStr = textarea.id.replace('cell-input-', '');
      const lineCount = textarea.value.split('\n').length;
      const label = container.querySelector(`#cell-loc-${idxStr}`);
      if (label) {
        label.textContent = `${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`;
      }
      // Update gutter line numbers & highlight backdrop
      updateLineNumbers(textarea);
    }
  });

  // Attach scroll & initial line counts on focus
  container.addEventListener('focusin', (e) => {
    const textarea = e.target as HTMLTextAreaElement;
    if (textarea && textarea.id && textarea.id.startsWith('cell-input-')) {
      // Sync line numbers immediately
      updateLineNumbers(textarea);
      
      // Bind scroll sync if not already bound
      if (!textarea.dataset.hasScrollListener) {
        textarea.dataset.hasScrollListener = 'true';
        textarea.addEventListener('scroll', () => {
          updateLineGutterScroll(textarea);
        });
      }
    }
  });

  // Hotkeys: Ctrl+Enter to execute, Cmd+/ or Ctrl+/ to toggle comment
  container.addEventListener('keydown', (e) => {
    const textarea = e.target as HTMLTextAreaElement;
    if (textarea && textarea.id && textarea.id.startsWith('cell-input-')) {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Ctrl + Enter to run
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        const card = textarea.closest('.glass-panel');
        if (card) {
          const runBtn = card.querySelector('.btn-rerun-cell, .btn-execute-new-cell') as HTMLElement;
          runBtn?.click();
        }
      }

      // Cmd + / or Ctrl + / to toggle comment
      if ((e.key === '/' || e.code === 'Slash') && isCmdOrCtrl) {
        e.preventDefault();
        toggleComment(textarea);
        // Trigger input event to update line counts and autosize
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });

  function createCellEditBlock(
    type: 'python' | 'sql' | 'chat' | 'markdown',
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
       placeholder = "SELECT * FROM ...";
    } else if (type === "python") {
       icon = "code";
       color = "text-emerald-400";
       placeholder = "# e.g. df = con.table('my_schema.my_table')  →  df.head()";
    } else if (type === "markdown") {
       icon = "article";
       color = "text-indigo-400";
       placeholder = "Write notes or analysis findings...";
    }

    const isMarkdown = type === "markdown";
    const borderFocusClass = type === "markdown" ? "indigo-400" : (type === "sql" ? "primary" : (type === "python" ? "emerald-400" : "secondary"));

    newCell.innerHTML = `
       <div class="flex items-start gap-4">
          ${isMarkdown ? '' : `
          <div class="font-mono text-xs font-bold ${color}/80 pt-2.5 select-none w-14 text-right shrink-0 flex items-center justify-end gap-1">
             <span class="material-symbols-outlined text-[14px]">${icon}</span>
             In [*]:
          </div>
          `}
          
          <div class="flex-1 w-full" id="cell-edit-${tempId}">
             <div class="glass-panel p-1.5 rounded-xl group focus-within:border-${borderFocusClass}/30 transition-all duration-300 shadow-lg shadow-${borderFocusClass}/5 bg-surface-container-lowest/80 border-outline-variant/10">
                <div class="flex flex-col w-full">
                  <div class="flex items-stretch gap-3 px-3">
                    ${(type === 'sql' || type === 'python') ? `
                    <div id="cell-gutter-${tempId}" class="w-8 select-none text-right font-mono text-sm leading-relaxed text-outline/30 pr-2 border-r border-outline-variant/10 whitespace-pre overflow-hidden pt-0 pointer-events-none">1</div>
                    ` : ''}
                    <div class="flex-1 min-w-0 py-0.5 relative">
                      ${type === 'sql' || type === 'python' ? `
                      <!-- Highlight Backdrop -->
                      <div id="cell-highlight-${tempId}" data-tool="${type}" class="absolute inset-0 w-full max-w-full bg-transparent text-on-surface py-0.5 px-0 text-sm font-mono leading-relaxed whitespace-pre overflow-hidden pointer-events-none border border-transparent custom-scrollbar select-none"></div>
                      ` : ''}
                      <textarea id="cell-input-${tempId}" class="w-full max-w-full bg-transparent border border-transparent ${(type === 'sql' || type === 'python') ? 'text-transparent caret-white whitespace-pre overflow-x-auto' : 'text-on-surface whitespace-pre-wrap break-words'} outline-none focus:outline-none focus:ring-0 resize-none py-0.5 px-0 text-sm font-mono leading-relaxed custom-scrollbar placeholder-outline-variant relative z-10" rows="${isMarkdown ? 3 : 2}" placeholder="${placeholder}"></textarea>
                    </div>
                    <div class="flex items-start gap-1.5 shrink-0 pt-0.5">
                      <button class="w-7 h-7 rounded-full bg-surface-container-highest text-outline flex items-center justify-center hover:bg-error/20 hover:text-error transition-colors btn-cancel-insert" title="Cancel">
                        <span class="material-symbols-outlined text-[14px]">close</span>
                      </button>
                      <button class="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-110 transition-transform btn-execute-new-cell shadow-md shadow-primary/20" data-type="${type}" data-after="${afterLogId || '__first__'}" data-temp-id="${tempId}" title="Run Cell">
                        <span class="material-symbols-outlined text-[14px]">${isMarkdown ? 'done' : 'play_arrow'}</span>
                      </button>
                    </div>
                  </div>
                  ${type === 'sql' ? `
                  <div class="px-3 pb-1.5 flex items-center justify-between text-[10px] font-mono text-outline select-none border-t border-outline-variant/5 pt-1.5 mt-1.5">
                    <span>SQL Mode</span>
                    <span id="cell-loc-${tempId}">1 line</span>
                  </div>
                  ` : ''}
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
    const type = parseCellType(addBtn.getAttribute('data-type'));
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

    async function runCell(idx: string, logId: string, toolName: string, question: string, cellBody: HTMLElement) {
      executingCells.add(logId);
      container.querySelector(`#cell-edit-${idx}`)?.classList.add('hidden');
      const staticView = container.querySelector(`#cell-static-${idx}`);
      if (staticView) {
        staticView.classList.remove('hidden');
        staticView.innerHTML = '';
        const questionEl = document.createElement('div');
        questionEl.className = 'pr-8 whitespace-pre-wrap';
        if (toolName === 'sql') {
          questionEl.innerHTML = highlightSQL(question);
        } else {
          questionEl.textContent = question;
        }
        staticView.appendChild(questionEl);
      }
      
      const divider = container.querySelector(`#cell-divider-${idx}`);
      if (divider) divider.classList.remove('opacity-0');
      
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
      
      const streamingContent = outBody?.querySelector(`#streaming-content-${idx}`);

      if (toolName === 'sql' || toolName === 'python') {
        try {
          if (toolName === 'sql') {
            await api.executeSql(activeId!, question, logId, null);
          } else {
            await api.executePython(activeId!, question, logId, null);
          }

          if (outGutter) {
             outGutter.textContent = `Out [${idx}]:`;
             outGutter.classList.remove('flex', 'items-center', 'justify-end', 'gap-1');
          }
          
          const currentStreamingContent = outBody?.querySelector(`#streaming-content-${idx}`);
          if (currentStreamingContent) {
             currentStreamingContent.removeAttribute('id');
          }

          
          const newLogs = await api.listLogs(activeId!);
          executingCells.delete(logId);
          store.setLogs(newLogs);
        } catch (e) {
           console.error(e);
           if (outGutter) {
              outGutter.textContent = `Error`;
              outGutter.classList.remove('flex', 'items-center', 'justify-end', 'gap-1');
           }
           if (streamingContent) {
              streamingContent.innerHTML = `<span class="text-error">Execution Failed.</span>`;
              streamingContent.classList.remove('animate-pulse');
           }
        } finally {
           executingCells.delete(logId);
        }
      } else {
        let fullText = "";
        api.streamQuestion(activeId!, question, logId, null,
          (token) => {
            fullText += token;
            if (streamingContent) {
              streamingContent.innerHTML = renderMarkdown(fullText) + '<span class="inline-block w-1 h-4 bg-primary animate-pulse ml-1"></span>';
            }
          },
          async () => {
            executingCells.delete(logId);
            if (streamingContent) {
              streamingContent.innerHTML = renderMarkdown(fullText);
              streamingContent.classList.remove('animate-pulse');
              streamingContent.removeAttribute('id');
            } else {
              const currentStreamingContent = outBody?.querySelector(`#streaming-content-${idx}`);
              if (currentStreamingContent) {
                currentStreamingContent.innerHTML = renderMarkdown(fullText);
                currentStreamingContent.classList.remove('animate-pulse');
                currentStreamingContent.removeAttribute('id');
              }
            }
            if (outGutter) {
              outGutter.textContent = `Out [${idx}]:`;
              outGutter.classList.remove('flex', 'items-center', 'justify-end', 'gap-1');
            }
            
            const newLogs = await api.listLogs(activeId!);
            store.setLogs(newLogs);
          },
          (err) => {
            executingCells.delete(logId);
            console.error('Rerun error', err);
            if (outGutter) {
               outGutter.textContent = `Out [${idx}]:`;
               outGutter.classList.remove('flex', 'items-center', 'justify-end', 'gap-1');
            }
          }
        );
      }
    }

    // Run Static Cell directly
    const runStaticBtn = target.closest('.btn-run-static-cell') as HTMLButtonElement;
    if (runStaticBtn && activeId) {
      const idx = runStaticBtn.getAttribute('data-cell-index');
      const logId = runStaticBtn.getAttribute('data-log-id');
      const toolName = runStaticBtn.getAttribute('data-tool');
      if (!idx || !logId || !toolName) return;
      
      const txt = container.querySelector(`#cell-input-${idx}`) as HTMLTextAreaElement;
      const staticView = container.querySelector(`#cell-static-${idx}`) as HTMLElement;
      if (!staticView) return;
      
      const question = txt ? txt.value : staticView.innerText.trim();
      if (!question) return;
      
      runStaticBtn.disabled = true;
      
      const cellBody = runStaticBtn.closest('.glass-panel.rounded-3xl') as HTMLElement;
      if (cellBody) {
        await runCell(idx, logId, toolName, question, cellBody);
      }
      return;
    }

    // "First Cell" welcome screen chooser
    const firstCellBtn = target.closest('.btn-first-cell') as HTMLElement;
    if (firstCellBtn) {
      const type = parseCellType(firstCellBtn.getAttribute('data-type'));
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
         setTimeout(() => {
            txt.style.height = 'auto';
            txt.style.height = txt.scrollHeight + 'px';
            txt.focus();
         }, 0);
      }
      return;
    }
    
    // Delete Cell
    const deleteBtn = target.closest('.btn-delete-cell') as HTMLElement;
    if (deleteBtn) {
      const logId = deleteBtn.getAttribute('data-log-id');
      if (logId && confirm('Are you sure you want to delete this cell?')) {
        try {
          await api.deleteLog(logId);
          const newLogs = await api.listLogs(activeId!);
          store.setLogs(newLogs);
        } catch (e) {
          console.error('Failed to delete cell', e);
        }
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
      if (!txt || !logId || !idx) return;
      
      const question = txt.value;
      if (!question) return;
      
      rerunBtn.disabled = true;

      const toolName = rerunBtn.getAttribute('data-tool');
      if (toolName === 'markdown') {
        rerunBtn.innerHTML = `<span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>`;
        try {
           await api.executeMarkdown(activeId, question, logId, null);
           
           container.querySelector(`#cell-edit-${idx}`)?.classList.add('hidden');
           container.querySelector(`#cell-static-${idx}`)?.classList.remove('hidden');
           container.querySelector(`#cell-divider-${idx}`)?.classList.remove('opacity-0');

           const newLogs = await api.listLogs(activeId);
           store.setLogs(newLogs);
        } catch (e) {
           console.error(e);
           rerunBtn.disabled = false;
           rerunBtn.innerHTML = `<span class="material-symbols-outlined text-[14px]">done</span>`;
        }
        return;
      }
      
      const cellBody = rerunBtn.closest('.glass-panel.rounded-3xl') as HTMLElement;
      if (cellBody) {
        await runCell(idx, logId, toolName || 'chat', question, cellBody);
      }
      return;
    }

    // Insert New Unexecuted Cell
    const insertBtn = target.closest('.btn-insert-cell') as HTMLElement;
    if (insertBtn) {
      const type = parseCellType(insertBtn.getAttribute('data-type'));
      const afterLogId = parseAfterLogId(insertBtn.getAttribute('data-after'));
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
       const rawTempId = runNewBtn.getAttribute('data-temp-id');
       const tempId = rawTempId && /^[A-Za-z0-9_-]+$/.test(rawTempId) ? rawTempId : null;
       
       if (!type || !tempId) return;
       
       const txt = container.querySelector(`#cell-input-${tempId}`) as HTMLTextAreaElement;
       const question = txt?.value;
       if (!question) return;

       runNewBtn.disabled = true;

       const cellBody = runNewBtn.closest('.glass-panel.rounded-3xl');
       if (!cellBody) return;

       if (type === 'markdown') {
          runNewBtn.innerHTML = `<span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>`;
          try {
             await api.executeMarkdown(activeId, question, null, afterLogId);
             
             const newCellBlock = runNewBtn.closest('.new-cell-block');
             newCellBlock?.remove();

             const newLogs = await api.listLogs(activeId);
             store.setLogs(newLogs);
          } catch (e) {
             console.error(e);
             runNewBtn.disabled = false;
             runNewBtn.innerHTML = `<span class="material-symbols-outlined text-[14px]">done</span>`;
          }
          return;
       }

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
                const newCellBlock = runNewBtn.closest('.new-cell-block');
                newCellBlock?.remove();

                const newLogs = await api.listLogs(activeId!);
                store.setLogs(newLogs);
             },
             (err) => {
                console.error(err);
                if (outGutter) {
                   outGutter.textContent = 'Error';
                   outGutter.classList.remove('flex', 'items-center', 'justify-end', 'gap-1');
                }
                if (streamingContent) {
                   streamingContent.innerHTML += '<br><span class="text-error">Execution Failed.</span>';
                   streamingContent.classList.remove('animate-pulse');
                }
             }
          );
       } else if (type === 'sql' || type === 'python') {
          try {
             if (type === 'sql') {
                await api.executeSql(activeId, question, null, afterLogId);
             } else {
                await api.executePython(activeId, question, null, afterLogId);
             }

             const currentStreamingContent = cellBody?.querySelector(`#streaming-content-${tempId}`);
             if (currentStreamingContent) {
                 currentStreamingContent.removeAttribute('id');
             }

             const newCellBlock = runNewBtn.closest('.new-cell-block');
             newCellBlock?.remove();

             const newLogs = await api.listLogs(activeId);
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

  });
}

export async function showDataPreviewModal(fullTableName: string, filename: string) {
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
