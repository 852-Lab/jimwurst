import { store } from '../../store';
import { api } from '../../services/api';
import { renderMarkdown } from '../notebook/templates';

export function bindQuickInsightInteractions(container: HTMLElement) {
  // Helper for Chatbox submissions (Quick Insights)
  function handleQuickInsightSend(questionText: string) {
    if (!questionText.trim()) return;
    
    const textarea = container.querySelector('#quick-insight-chat-input') as HTMLTextAreaElement;
    if (textarea) {
       textarea.value = '';
       textarea.style.height = 'auto';
    }
    
    const cellContainer = container.querySelector('#cell-container');
    if (!cellContainer) return;
    
    const activeId = store.getActiveAnalysisId();
    if (!activeId) return;

    const logs = store.getLogs();
    const lastLog = logs[logs.length - 1];
    const afterLogId = lastLog?.id ?? null;
    
    // Create temporary ID
    const tempId = 'temp-' + Date.now();
    
    // Append User Bubble and AI loading bubble to cellContainer
    const chatBlock = document.createElement('div');
    chatBlock.className = 'space-y-8 py-4 relative group animate-in fade-in duration-300';
    chatBlock.innerHTML = `
      <div class="flex flex-col items-end gap-2 mb-8">
         <div class="max-w-[85%] bg-surface-container-highest/80 px-6 py-4 rounded-3xl rounded-tr-md text-on-surface text-[15px] font-medium leading-relaxed border border-outline-variant/10 shadow-sm whitespace-pre-wrap">${questionText.trim()}</div>
      </div>
      <div class="flex items-start gap-4">
        <div class="w-10 h-10 rounded-2xl bg-secondary/15 flex flex-shrink-0 items-center justify-center border border-secondary/20 shadow-lg shadow-secondary/5 mt-1">
          <span class="material-symbols-outlined text-secondary" data-icon="auto_awesome">auto_awesome</span>
        </div>
        <div class="flex-1 min-w-0 space-y-6 pt-1">
           <div class="prose prose-invert max-w-none text-on-surface-variant leading-relaxed font-body-lg animate-pulse" id="streaming-content-${tempId}">
              <span class="inline-block w-1 h-4 bg-primary animate-pulse"></span>
           </div>
        </div>
      </div>
    `;
    cellContainer.appendChild(chatBlock);
    cellContainer.scrollTop = cellContainer.scrollHeight;
    
    let fullText = "";
    api.streamQuestion(activeId, questionText.trim(), null, afterLogId,
       (token) => {
          fullText += token;
          const streamingContent = cellContainer.querySelector(\`#streaming-content-\${tempId}\`);
          if (streamingContent) {
             streamingContent.innerHTML = renderMarkdown(fullText) + '<span class="inline-block w-1 h-4 bg-primary animate-pulse ml-1"></span>';
             cellContainer.scrollTop = cellContainer.scrollHeight;
          }
       },
       async () => {
          const newLogs = await api.listLogs(activeId);
          store.setLogs(newLogs);
       },
       (err) => {
          console.error(err);
          const streamingContent = cellContainer.querySelector(\`#streaming-content-\${tempId}\`);
          if (streamingContent) {
             streamingContent.innerHTML += '<br><span class="text-error">Execution Failed.</span>';
             streamingContent.classList.remove('animate-pulse');
          }
       }
    );
  }

  // Quick Insight Chatbox Send Button Click
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const sendBtn = target.closest('#btn-quick-insight-send') as HTMLButtonElement;
    if (sendBtn) {
      const textarea = container.querySelector('#quick-insight-chat-input') as HTMLTextAreaElement;
      if (textarea) handleQuickInsightSend(textarea.value);
      return;
    }

    // Follow-up Question Click
    const followupBtn = target.closest('.followup-question-btn') as HTMLElement;
    if (followupBtn) {
      const question = followupBtn.getAttribute('data-question');
      if (question) {
         handleQuickInsightSend(question);
      }
      return;
    }
  });

  // Quick Insight Chatbox Input Auto-resize
  container.addEventListener('input', (e) => {
    const textarea = e.target as HTMLTextAreaElement;
    if (textarea && textarea.id === 'quick-insight-chat-input') {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
    }
  });

  // Quick Insight Chatbox Enter Key
  container.addEventListener('keydown', (e) => {
    const textarea = e.target as HTMLTextAreaElement;
    if (textarea && textarea.id === 'quick-insight-chat-input') {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleQuickInsightSend(textarea.value);
      }
    }
  });
}
