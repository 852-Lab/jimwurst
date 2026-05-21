import { api } from '../../services/api';
import { store } from '../../store';
import { state } from './state';
import { renderGeneralHtml, renderIntegrationsHtml } from './templates';
import { withButtonLoading } from '../utils/dom';

export const renderContent = (container: HTMLElement) => {
    const user = store.getCurrentUser();
    if (!user) return;

    container.innerHTML = `
      <header class="px-12 pt-12 pb-4 max-w-4xl mx-auto w-full">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/30">
            <span class="material-symbols-outlined text-primary-fixed-dim">settings</span>
          </div>
          <div>
            <h1 class="text-3xl font-display-lg tracking-tight text-neutral-100">Settings</h1>
            <p class="text-sm font-label-md text-on-surface-variant opacity-80 uppercase tracking-widest mt-1">Platform Configuration</p>
          </div>
        </div>

        <!-- Sub-navigation -->
        <div class="flex border-b border-outline-variant/30">
          <button id="tab-general" class="px-6 py-3 text-sm font-bold transition-all border-b-2 ${state.currentSubPage === 'general' ? 'border-primary-fixed-dim text-neutral-100' : 'border-transparent text-on-surface-variant hover:text-neutral-100'}">
            General
          </button>
          <button id="tab-integrations" class="px-6 py-3 text-sm font-bold transition-all border-b-2 ${state.currentSubPage === 'integrations' ? 'border-primary-fixed-dim text-neutral-100' : 'border-transparent text-on-surface-variant hover:text-neutral-100'}">
            Integrations
          </button>
        </div>
      </header>

      <main id="settings-main-content" class="flex-1 px-12 pb-12 max-w-4xl mx-auto w-full flex flex-col gap-8 mt-6">
        ${state.currentSubPage === 'general' ? renderGeneralHtml(user) : renderIntegrationsHtml()}
      </main>
    `;

    // Attach Tab Listeners
    container.querySelector('#tab-general')?.addEventListener('click', () => {
      state.currentSubPage = 'general';
      renderContent(container);
    });
    container.querySelector('#tab-integrations')?.addEventListener('click', () => {
      state.currentSubPage = 'integrations';
      renderContent(container);
    });

    if (state.currentSubPage === 'general') {
      attachGeneralListeners(container, user);
    } else {
      attachIntegrationsListeners(container, renderContent);
    }
  };

export const attachGeneralListeners = (container: HTMLElement, user: any) => {
    const saveBtn = container.querySelector('#btn-save-profile');
    const nameInput = container.querySelector('#user-name') as HTMLInputElement;
    const status = container.querySelector('#profile-save-status');

    saveBtn?.addEventListener('click', async () => {
      const newName = nameInput.value.trim();
      if (!newName) return;
      await withButtonLoading(
        saveBtn as HTMLButtonElement,
        '<span class="animate-spin mr-2">⏳</span> Saving...',
        async () => {
          const updatedUser = await api.updateUser(user.id, { name: newName });
          store.setCurrentUser(updatedUser);
          if (status) {
            status.classList.remove('opacity-0');
            setTimeout(() => status.classList.add('opacity-0'), 2000);
          }
        }
      ).catch(err => {
        console.error('Failed to update profile', err);
        alert('Failed to update profile. Please try again.');
      });
    });
  };

export const attachIntegrationsListeners = (container: HTMLElement, renderContent: (c: HTMLElement) => void) => {
    // Ollama listeners
    const baseUrlInput = container.querySelector('#ollama-base-url') as HTMLInputElement | null;
    if (baseUrlInput) baseUrlInput.value = state.ollamaConfig.base_url;

    const defaultModelInput = container.querySelector('#ollama-default-model') as HTMLInputElement | null;
    if (defaultModelInput) defaultModelInput.value = state.ollamaConfig.default_model;

    const configureBtn = container.querySelector('#btn-configure-ollama');
    if (configureBtn) {
      configureBtn.addEventListener('click', () => {
        state.isConfiguringOllama = true;
        renderContent(container);
      });
    }

    const cancelBtn = container.querySelector('#btn-cancel-ollama');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        state.isConfiguringOllama = false;
        renderContent(container);
      });
    }

    const modeRadios = container.querySelectorAll('input[name="ollama-mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        state.ollamaConfig.mode = (e.target as HTMLInputElement).value;
        renderContent(container);
      });
    });

    const testBtn = container.querySelector('#btn-test-ollama');
    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        const btn = testBtn as HTMLButtonElement;
        const statusDiv = container.querySelector('#test-status') as HTMLDivElement;
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Testing...';
        statusDiv.classList.remove('hidden', 'bg-green-400/10', 'border-green-400/30', 'text-green-400', 'bg-red-400/10', 'border-red-400/30', 'text-red-400');
        statusDiv.classList.add('bg-surface-container-highest', 'border-outline-variant/30', 'text-on-surface-variant');
        statusDiv.textContent = 'Contacting server...';
        statusDiv.classList.remove('hidden');

        try {
          const REDACTED = '••••••••';
          const urlInput = container.querySelector('#ollama-base-url') as HTMLInputElement;
          if (urlInput) state.ollamaConfig.base_url = urlInput.value;
          const modelInput = container.querySelector('#ollama-default-model') as HTMLInputElement;
          if (modelInput) state.ollamaConfig.default_model = modelInput.value;

          const keyInput = container.querySelector('#ollama-api-key') as HTMLInputElement;
          if (keyInput && keyInput.value && keyInput.value !== REDACTED) {
            state.ollamaConfig.api_key = keyInput.value;
          } else if (state.apiKeyIsSet) {
            state.ollamaConfig.api_key = REDACTED;
          } else {
            state.ollamaConfig.api_key = '';
          }

          await api.updateSetting('ollama', {
            mode: state.ollamaConfig.mode,
            base_url: state.ollamaConfig.base_url,
            default_model: state.ollamaConfig.default_model,
            api_key: state.ollamaConfig.api_key
          });

          const result = await api.testOllamaConnection();
          statusDiv.classList.remove('bg-surface-container-highest', 'border-outline-variant/30', 'text-on-surface-variant');
          statusDiv.classList.add('bg-green-400/10', 'border-green-400/30', 'text-green-400');
          statusDiv.innerHTML = `<div class="flex items-center gap-2"><span class="material-symbols-outlined text-sm">check_circle</span> ${result.message}</div>`;
          if (result.models && result.models.length > 0) {
            statusDiv.innerHTML += `<div class="mt-1 opacity-80">Available models: ${result.models.join(', ')}</div>`;
          }
        } catch (e: any) {
          statusDiv.classList.remove('bg-surface-container-highest', 'border-outline-variant/30', 'text-on-surface-variant');
          statusDiv.classList.add('bg-red-400/10', 'border-red-400/30', 'text-red-400');
          statusDiv.innerHTML = `<div class="flex items-center gap-2"><span class="material-symbols-outlined text-sm">error</span> ${e.message}</div>`;
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    }

    const saveBtn = container.querySelector('#btn-save-ai');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const urlInput = container.querySelector('#ollama-base-url') as HTMLInputElement;
        if (urlInput) state.ollamaConfig.base_url = urlInput.value;

        const modelInput = container.querySelector('#ollama-default-model') as HTMLInputElement;
        if (modelInput) state.ollamaConfig.default_model = modelInput.value;

        const REDACTED = '••••••••';
        const keyInput = container.querySelector('#ollama-api-key') as HTMLInputElement;
        if (keyInput && keyInput.value && keyInput.value !== REDACTED) {
          state.ollamaConfig.api_key = keyInput.value;
        } else if (state.apiKeyIsSet) {
          state.ollamaConfig.api_key = REDACTED;
        } else {
          state.ollamaConfig.api_key = '';
        }

        if (state.ollamaConfig.mode === 'default') {
          state.ollamaConfig.base_url = 'http://localhost:11434';
          state.ollamaConfig.default_model = 'gemma3:4b';
          state.ollamaConfig.api_key = '';
        }

        const btn = saveBtn as HTMLButtonElement;
        btn.disabled = true;
        btn.classList.add('opacity-50');

        try {
          await api.updateSetting('ollama', {
            mode: state.ollamaConfig.mode,
            base_url: state.ollamaConfig.base_url,
            default_model: state.ollamaConfig.default_model,
            api_key: state.ollamaConfig.api_key
          });

          const status = container.querySelector('#save-status');
          if (status) {
            status.classList.remove('opacity-0');
            setTimeout(() => {
              status.classList.add('opacity-0');
              setTimeout(() => {
                state.isConfiguringOllama = false;
                renderContent(container);
              }, 300);
            }, 1500);
          }
        } catch (e) {
          console.error('Failed to save settings', e);
        } finally {
          btn.disabled = false;
          btn.classList.remove('opacity-50');
        }
      });
    }

    // Motherduck listeners
    const configureMdBtn = container.querySelector('#btn-configure-motherduck');
    if (configureMdBtn) {
      configureMdBtn.addEventListener('click', () => {
        state.isConfiguringMotherduck = true;
        renderContent(container);
      });
    }

    const cancelMdBtn = container.querySelector('#btn-cancel-motherduck');
    if (cancelMdBtn) {
      cancelMdBtn.addEventListener('click', () => {
        state.isConfiguringMotherduck = false;
        renderContent(container);
      });
    }

    const clearMdTokenBtn = container.querySelector('#btn-clear-md-token');
    if (clearMdTokenBtn) {
      clearMdTokenBtn.addEventListener('click', () => {
        state.motherduckTokenIsSet = false;
        renderContent(container);
      });
    }

    const testMdBtn = container.querySelector('#btn-test-motherduck');
    if (testMdBtn) {
      testMdBtn.addEventListener('click', async () => {
        const btn = testMdBtn as HTMLButtonElement;
        const statusDiv = container.querySelector('#md-test-status') as HTMLDivElement;
        const tokenInput = container.querySelector('#md-token') as HTMLInputElement;
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.textContent = 'Testing...';
        statusDiv.classList.remove('hidden', 'bg-green-400/10', 'text-green-400', 'bg-red-400/10', 'text-red-400');
        statusDiv.classList.add('bg-surface-container-highest', 'text-on-surface-variant');
        statusDiv.textContent = 'Connecting to Motherduck...';
        statusDiv.classList.remove('hidden');

        try {
          const REDACTED = '••••••••';
          let tokenToSave = tokenInput.value;
          if (state.motherduckTokenIsSet && !tokenToSave) tokenToSave = REDACTED;

          if (tokenToSave && tokenToSave !== REDACTED) {
            await api.updateSetting('motherduck', { token: tokenToSave });
          }

          const result = await api.testMotherduckConnection();
          statusDiv.classList.remove('bg-surface-container-highest', 'text-on-surface-variant');
          statusDiv.classList.add('bg-green-400/10', 'text-green-400');
          statusDiv.innerHTML = `<span class="material-symbols-outlined text-sm inline-block align-middle mr-1">check_circle</span> ${result.message}`;
        } catch (e: any) {
          statusDiv.classList.remove('bg-surface-container-highest', 'text-on-surface-variant');
          statusDiv.classList.add('bg-red-400/10', 'text-red-400');
          statusDiv.innerHTML = `<span class="material-symbols-outlined text-sm inline-block align-middle mr-1">error</span> ${e.message}`;
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    }

    const saveMdBtn = container.querySelector('#btn-save-motherduck');
    if (saveMdBtn) {
      saveMdBtn.addEventListener('click', async () => {
        const tokenInput = container.querySelector('#md-token') as HTMLInputElement;
        const REDACTED = '••••••••';
        let tokenToSave = tokenInput.value;
        if (state.motherduckTokenIsSet && !tokenToSave) tokenToSave = REDACTED;

        await withButtonLoading(
          saveMdBtn as HTMLButtonElement,
          'Saving...',
          async () => {
            await api.updateSetting('motherduck', { token: tokenToSave });
            state.motherduckTokenIsSet = tokenToSave !== '';
            state.isConfiguringMotherduck = false;
            renderContent(container);
          }
        ).catch(e => {
          console.error('Failed to save Motherduck settings', e);
          alert('Failed to save settings');
        });
      });
    }

    // Global Sync listeners
    const pushAllBtn = container.querySelector('#btn-push-all');
    const pullAllBtn = container.querySelector('#btn-pull-all');
    const syncStatus = container.querySelector('#sync-all-status');

    const handleSyncAll = async (direction: 'push' | 'pull') => {
      if (!pushAllBtn || !pullAllBtn || !syncStatus) return;
      
      const btn = direction === 'push' ? pushAllBtn : pullAllBtn;
      const otherBtn = direction === 'push' ? pullAllBtn : pushAllBtn;
      const originalText = btn.innerHTML;
      
      btn.disabled = true;
      otherBtn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">sync</span> ${direction === 'push' ? 'Pushing...' : 'Pulling...'}`;
      
      syncStatus.classList.remove('hidden');
      syncStatus.innerHTML = `<div class="animate-pulse">Initializing synchronization sequence...</div>`;
      
      try {
        const result = direction === 'push' ? await api.pushAllToMotherduck() : await api.pullAllFromMotherduck();
        
        syncStatus.innerHTML = result.results.map((r: any) => `
          <div class="flex items-center justify-between py-1 border-b border-outline-variant/5 last:border-0">
            <span class="${r.status === 'success' ? 'text-green-400' : 'text-red-400'}">
              ${r.status === 'success' ? '✓' : '✗'} ${r.table}
            </span>
            <span class="text-[8px] opacity-60 uppercase font-bold">${r.status}</span>
          </div>
        `).join('');
        
        if (result.results.length === 0) {
          syncStatus.innerHTML = '<div class="text-center py-2 italic opacity-60">No tables found to synchronize.</div>';
        }
      } catch (err: any) {
        syncStatus.innerHTML = `<div class="text-red-400 font-bold">Sync Error: ${err.message}</div>`;
      } finally {
        btn.disabled = false;
        otherBtn.disabled = false;
        btn.innerHTML = originalText;
      }
    };

    pushAllBtn?.addEventListener('click', () => handleSyncAll('push'));
    pullAllBtn?.addEventListener('click', () => handleSyncAll('pull'));

    // Notion listeners
    const configureNotionBtn = container.querySelector('#btn-configure-notion');
    if (configureNotionBtn) {
      configureNotionBtn.addEventListener('click', () => {
        state.isConfiguringNotion = true;
        renderContent(container);
      });
    }

    const cancelNotionBtn = container.querySelector('#btn-cancel-notion');
    if (cancelNotionBtn) {
      cancelNotionBtn.addEventListener('click', () => {
        state.isConfiguringNotion = false;
        renderContent(container);
      });
    }

    const clearNotionTokenBtn = container.querySelector('#btn-clear-notion-token');
    if (clearNotionTokenBtn) {
      clearNotionTokenBtn.addEventListener('click', () => {
        state.notionTokenIsSet = false;
        renderContent(container);
      });
    }

    const saveNotionBtn = container.querySelector('#btn-save-notion');
    if (saveNotionBtn) {
      saveNotionBtn.addEventListener('click', async () => {
        const tokenInput = container.querySelector('#notion-token') as HTMLInputElement;
        const REDACTED = '••••••••';
        let tokenToSave = tokenInput.value;
        if (state.notionTokenIsSet && !tokenToSave) tokenToSave = REDACTED;

        await withButtonLoading(
          saveNotionBtn as HTMLButtonElement,
          'Saving...',
          async () => {
            await api.updateSetting('notion', { token: tokenToSave });
            state.notionTokenIsSet = tokenToSave !== '';
            state.isConfiguringNotion = false;
            renderContent(container);
          }
        ).catch(e => {
          console.error('Failed to save Notion settings', e);
          alert('Failed to save settings');
        });
      });
    }

    const syncNotionBtn = container.querySelector('#btn-sync-notion');
    const syncNotionStatus = container.querySelector('#sync-notion-status');

    if (syncNotionBtn && syncNotionStatus) {
      syncNotionBtn.addEventListener('click', async () => {
        const btn = syncNotionBtn as HTMLButtonElement;
        const originalText = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span> Syncing...';
        
        syncNotionStatus.classList.remove('hidden', 'text-red-400', 'text-green-400');
        syncNotionStatus.classList.add('text-on-surface-variant');
        syncNotionStatus.innerHTML = '<div class="animate-pulse">Fetching pages from Notion...</div>';
        
        try {
          const result = await api.syncNotionPages(true);
          syncNotionStatus.classList.remove('text-on-surface-variant');
          syncNotionStatus.classList.add('text-green-400');
          syncNotionStatus.innerHTML = `<span class="material-symbols-outlined text-sm inline-block align-middle mr-1">check_circle</span> Successfully synced ${result.synced_count} pages!`;
          
          // Update global state so the Knowledge page reflects the new data
          const updatedPages = await api.listKnowledgePages();
          store.setKnowledgePages(updatedPages);
        } catch (err: any) {
          syncNotionStatus.classList.remove('text-on-surface-variant');
          syncNotionStatus.classList.add('text-red-400');
          syncNotionStatus.innerHTML = `<div class="font-bold">Sync Error: ${err.message}</div>`;
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    }
  };

export const loadInitialData = (container: HTMLElement, renderContent: (c: HTMLElement) => void) => {
  api.getSetting('ollama').then(setting => {
    if (setting && setting.value && Object.keys(setting.value).length > 0) {
      const { api_key, ...rest } = setting.value;
      state.apiKeyIsSet = api_key === '••••••••';
      state.ollamaConfig = { ...state.ollamaConfig, ...rest, api_key: '' };
      renderContent(container);
    }
  }).catch(e => console.error('Failed to fetch settings', e));

  api.getSetting('motherduck').then(setting => {
    if (setting && setting.value && setting.value.token) {
      state.motherduckTokenIsSet = setting.value.token === '••••••••';
      renderContent(container);
    }
  }).catch(e => console.error('Failed to fetch Motherduck settings', e));

  api.getSetting('notion').then(setting => {
    if (setting && setting.value && setting.value.token) {
      state.notionTokenIsSet = setting.value.token === '••••••••';
      renderContent(container);
    }
  }).catch(e => console.error('Failed to fetch Notion settings', e));
}
