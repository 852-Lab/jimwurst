import { api } from '../services/api';
import { store } from '../store';

export function renderSettings() {
  const container = document.createElement('div');
  container.className = 'flex-1 ml-64 bg-surface-container-lowest flex flex-col h-full overflow-y-auto text-on-surface custom-scrollbar';

  let currentSubPage = 'general'; // 'general' or 'integrations'

  // Ollama State (Preserved across tab switches)
  let ollamaConfig = {
    mode: 'default', // 'default', 'local', 'cloud'
    base_url: 'http://localhost:11434',
    default_model: 'gemma3:4b',
    api_key: ''
  };
  let apiKeyIsSet = false;
  let isConfiguringOllama = false;

  // Motherduck State
  let motherduckTokenIsSet = false;
  let isConfiguringMotherduck = false;

  const renderContent = () => {
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
          <button id="tab-general" class="px-6 py-3 text-sm font-bold transition-all border-b-2 ${currentSubPage === 'general' ? 'border-primary-fixed-dim text-neutral-100' : 'border-transparent text-on-surface-variant hover:text-neutral-100'}">
            General
          </button>
          <button id="tab-integrations" class="px-6 py-3 text-sm font-bold transition-all border-b-2 ${currentSubPage === 'integrations' ? 'border-primary-fixed-dim text-neutral-100' : 'border-transparent text-on-surface-variant hover:text-neutral-100'}">
            Integrations
          </button>
        </div>
      </header>

      <main id="settings-main-content" class="flex-1 px-12 pb-12 max-w-4xl mx-auto w-full flex flex-col gap-8 mt-6">
        ${currentSubPage === 'general' ? renderGeneralHtml(user) : renderIntegrationsHtml()}
      </main>
    `;

    // Attach Tab Listeners
    container.querySelector('#tab-general')?.addEventListener('click', () => {
      currentSubPage = 'general';
      renderContent();
    });
    container.querySelector('#tab-integrations')?.addEventListener('click', () => {
      currentSubPage = 'integrations';
      renderContent();
    });

    if (currentSubPage === 'general') {
      attachGeneralListeners(user);
    } else {
      attachIntegrationsListeners();
    }
  };

  const renderGeneralHtml = (user: any) => `
    <section class="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 class="text-lg font-bold text-neutral-100 border-b border-outline-variant pb-2 mb-4">Account Profile</h2>
      <div class="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-6 space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Display Name</label>
            <input id="user-name" type="text" class="w-full bg-surface-container-highest border border-outline-variant/50 rounded-lg px-4 py-3 text-sm text-neutral-100 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors" value="${user.name}" />
          </div>
          <div>
            <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Email Address</label>
            <div class="w-full bg-surface-container-highest/50 border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface-variant cursor-not-allowed">
              ${user.email}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
            <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Role</label>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-fixed-dim/10 border border-primary-fixed-dim/30 text-primary-fixed-dim text-xs font-bold">
              <span class="material-symbols-outlined text-sm">verified_user</span>
              ${user.role}
            </div>
          </div>
           <div>
            <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Account Status</label>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-400/10 border border-green-400/30 text-green-400 text-xs font-bold">
              <span class="material-symbols-outlined text-sm">check_circle</span>
              ${user.status}
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-outline-variant/30 flex items-center gap-4">
          <button id="btn-save-profile" class="bg-primary-fixed-dim text-on-primary-fixed font-bold py-2 px-6 rounded-full text-sm hover:brightness-110 transition-all shadow-md">
            Save Changes
          </button>
          <span id="profile-save-status" class="text-sm text-green-400 opacity-0 transition-opacity duration-300 font-bold flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">check_circle</span> Changes saved
          </span>
        </div>
      </div>
    </section>
  `;

  const attachGeneralListeners = (user: any) => {
    const saveBtn = container.querySelector('#btn-save-profile');
    const nameInput = container.querySelector('#user-name') as HTMLInputElement;
    const status = container.querySelector('#profile-save-status');

    saveBtn?.addEventListener('click', async () => {
      const newName = nameInput.value.trim();
      if (!newName) return;

      const btn = saveBtn as HTMLButtonElement;
      btn.disabled = true;
      btn.innerHTML = '<span class="animate-spin mr-2">⏳</span> Saving...';

      try {
        const updatedUser = await api.updateUser(user.id, { name: newName });
        store.setCurrentUser(updatedUser);

        if (status) {
          status.classList.remove('opacity-0');
          setTimeout(() => status.classList.add('opacity-0'), 2000);
        }
      } catch (err) {
        console.error('Failed to update profile', err);
        alert('Failed to update profile. Please try again.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Changes';
      }
    });
  };

  const renderIntegrationsHtml = () => {
    let ollamaContent = '';

    if (!isConfiguringOllama) {
      ollamaContent = `
        <div class="pt-2">
          <button id="btn-configure-ollama" class="bg-surface-container-highest border border-outline-variant/50 text-neutral-100 font-bold py-2 px-6 rounded-full text-sm hover:bg-surface-container transition-all shadow-sm">
            Configure
          </button>
        </div>
      `;
    } else {
      ollamaContent = `
        <div class="space-y-6 mt-4">
          <div class="space-y-3">
            <label class="flex items-center gap-3 p-3 rounded-lg border ${ollamaConfig.mode === 'default' ? 'border-primary-fixed-dim bg-primary-fixed-dim/10' : 'border-outline-variant/50 bg-surface-container-highest'} cursor-pointer transition-colors">
              <input type="radio" name="ollama-mode" value="default" class="text-primary-fixed-dim focus:ring-primary-fixed-dim" ${ollamaConfig.mode === 'default' ? 'checked' : ''}>
              <div class="flex flex-col">
                <span class="text-sm font-bold text-neutral-100">Default</span>
                <span class="text-xs text-on-surface-variant">Use the built-in default model of Gemma3:4b from local Ollama</span>
              </div>
            </label>
            
            <label class="flex items-center gap-3 p-3 rounded-lg border ${ollamaConfig.mode === 'local' ? 'border-primary-fixed-dim bg-primary-fixed-dim/10' : 'border-outline-variant/50 bg-surface-container-highest'} cursor-pointer transition-colors">
              <input type="radio" name="ollama-mode" value="local" class="text-primary-fixed-dim focus:ring-primary-fixed-dim" ${ollamaConfig.mode === 'local' ? 'checked' : ''}>
              <div class="flex flex-col">
                <span class="text-sm font-bold text-neutral-100">Custom Local Runtime</span>
                <span class="text-xs text-on-surface-variant">Enter a custom base URL to another Ollama server on your network</span>
              </div>
            </label>
            
            <label class="flex items-center gap-3 p-3 rounded-lg border ${ollamaConfig.mode === 'cloud' ? 'border-primary-fixed-dim bg-primary-fixed-dim/10' : 'border-outline-variant/50 bg-surface-container-highest'} cursor-pointer transition-colors">
              <input type="radio" name="ollama-mode" value="cloud" class="text-primary-fixed-dim focus:ring-primary-fixed-dim" ${ollamaConfig.mode === 'cloud' ? 'checked' : ''}>
              <div class="flex flex-col">
                <span class="text-sm font-bold text-neutral-100">Ollama Cloud</span>
                <span class="text-xs text-on-surface-variant">Connect to Ollama Cloud with an API Key</span>
              </div>
            </label>
          </div>
          
          <div class="space-y-4 pt-2 border-t border-outline-variant/30">
            ${ollamaConfig.mode === 'local' ? `
              <div>
                <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Base URL</label>
                <input id="ollama-base-url" type="text" class="w-full bg-surface-container-highest border border-outline-variant/50 rounded-lg px-4 py-3 text-sm text-neutral-100 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors" placeholder="e.g. http://localhost:11434" />
              </div>
            ` : ''}
            
            ${ollamaConfig.mode !== 'default' ? `
              <div>
                <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Default Model</label>
                <input id="ollama-default-model" type="text" class="w-full bg-surface-container-highest border border-outline-variant/50 rounded-lg px-4 py-3 text-sm text-neutral-100 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors" placeholder="e.g. gemma3:4b" />
              </div>
            ` : ''}
            
            ${ollamaConfig.mode === 'cloud' ? `
              <div>
                <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">API Key</label>
                ${apiKeyIsSet ? `
                  <div class="flex items-center gap-3 mb-2">
                    <span class="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/30 px-3 py-1 rounded-full">
                      <span class="material-symbols-outlined text-sm">lock</span> Key stored securely
                    </span>
                    <button id="btn-clear-key" class="text-xs text-on-surface-variant hover:text-red-400 transition-colors underline">Replace key</button>
                  </div>
                  <input id="ollama-api-key" type="password" class="w-full bg-surface-container-highest border border-outline-variant/50 rounded-lg px-4 py-3 text-sm text-neutral-100 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors" placeholder="Enter new API key to replace the stored one" />
                ` : `
                  <input id="ollama-api-key" type="password" class="w-full bg-surface-container-highest border border-outline-variant/50 rounded-lg px-4 py-3 text-sm text-neutral-100 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors" placeholder="Required for Ollama Cloud (e.g. sk-...)" />
                `}
              </div>
            ` : ''}
            
            <div class="pt-2 flex items-center gap-4">
              <button id="btn-save-ai" class="bg-primary-fixed-dim text-on-primary-fixed font-bold py-2 px-6 rounded-full text-sm hover:brightness-110 transition-all shadow-md">
                Save AI Settings
              </button>
              <button id="btn-test-ollama" class="bg-surface-container-highest border border-outline-variant/50 text-neutral-100 font-bold py-2 px-6 rounded-full text-sm hover:bg-surface-container transition-all shadow-sm flex items-center gap-2">
                <span class="material-symbols-outlined text-sm">network_check</span> Test Connection
              </button>
              <button id="btn-cancel-ollama" class="text-sm font-bold text-on-surface-variant hover:text-neutral-100 transition-colors">
                Cancel
              </button>
              <span id="save-status" class="text-sm text-green-400 opacity-0 transition-opacity duration-300 font-bold flex items-center gap-1 ml-auto">
                <span class="material-symbols-outlined text-sm">check_circle</span> Saved
              </span>
            </div>
            <div id="test-status" class="text-xs mt-2 hidden p-3 rounded-lg border"></div>
          </div>
        </div>
      `;
    }

    return `
      <section class="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <h2 class="text-lg font-bold text-neutral-100 border-b border-outline-variant pb-2 mb-4">AI Models</h2>
        
        <div class="bg-surface-container-low border border-outline-variant/50 rounded-2xl overflow-hidden">
          <div class="p-6">
            <div class="flex items-center gap-3 mb-4">
              <span class="material-symbols-outlined text-primary-fixed-dim text-2xl">memory</span>
              <h3 class="text-xl font-medium text-neutral-100">Ollama</h3>
            </div>
            <p class="text-sm text-on-surface-variant mb-2">Configure your local or remote Ollama instance for AI model integration.</p>
            
            ${ollamaContent}
            
          </div>
        </div>

        <!-- Gemini -->
        <div class="bg-surface-container-low border border-outline-variant/50 rounded-2xl overflow-hidden mt-4 relative group">
          <div class="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-purple-500 text-2xl">auto_awesome</span>
                <h3 class="text-xl font-medium text-neutral-100">Google Gemini</h3>
              </div>
              <span class="text-[10px] bg-purple-500/20 text-purple-500 border border-purple-500/30 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Coming Soon</span>
            </div>
            <p class="text-sm text-on-surface-variant mb-4">Integrate with Google's most capable AI models.</p>
            <button class="text-sm font-bold text-outline-variant cursor-not-allowed" disabled>Configure</button>
          </div>
        </div>
      </section>
      
      <!-- Documentation Integrations -->
      <section>
        <h2 class="text-lg font-bold text-neutral-100 border-b border-outline-variant pb-2 mb-4">Documentations</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <!-- Notion -->
          <div class="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-6 relative group overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-neutral-100/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-neutral-100 text-2xl">book</span>
                <h3 class="text-lg font-medium text-neutral-100">Notion</h3>
              </div>
              <span class="text-[10px] bg-primary-fixed-dim/20 text-primary-fixed-dim border border-primary-fixed-dim/30 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Planned</span>
            </div>
            <p class="text-sm text-on-surface-variant mb-4">Synchronize structured page content and properties directly from your workspace.</p>
            <button class="text-sm font-bold text-outline-variant cursor-not-allowed" disabled>Coming Soon</button>
          </div>

          <!-- Confluence -->
          <div class="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-6 relative group overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-blue-400 text-2xl">description</span>
                <h3 class="text-lg font-medium text-neutral-100">Confluence</h3>
              </div>
              <span class="text-[10px] bg-blue-400/20 text-blue-400 border border-blue-400/30 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Planned</span>
            </div>
            <p class="text-sm text-on-surface-variant mb-4">Import documentation and enterprise knowledge from Atlassian Confluence.</p>
            <button class="text-sm font-bold text-outline-variant cursor-not-allowed" disabled>Coming Soon</button>
          </div>
        </div>
      </section>

      <!-- Data Warehouse Integrations -->
      <section>
        <h2 class="text-lg font-bold text-neutral-100 border-b border-outline-variant pb-2 mb-4">Data Warehouses</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Motherduck -->
          <div class="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-6 relative group overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-yellow-500 text-2xl">database</span>
                <h3 class="text-lg font-medium text-neutral-100">Motherduck</h3>
              </div>
              ${motherduckTokenIsSet ? `
                <span class="text-[10px] bg-green-400/20 text-green-400 border border-green-400/30 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Connected</span>
              ` : `
                <span class="text-[10px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Setup Needed</span>
              `}
            </div>
            
            ${!isConfiguringMotherduck ? `
              <p class="text-sm text-on-surface-variant mb-4">Serverless cloud analytics using DuckDB. Connect your local instance to Motherduck cloud.</p>
              <div class="flex items-center gap-4">
                <button id="btn-configure-motherduck" class="text-sm font-bold text-primary-fixed-dim hover:text-primary-fixed transition-colors">Configure</button>
                <a href="https://motherduck.com/docs/key-tasks/authenticating-and-connecting-to-motherduck/authenticating-to-motherduck/#creating-an-access-token" target="_blank" class="text-xs text-on-surface-variant hover:text-neutral-100 transition-colors flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">help_outline</span>
                  How to get a token?
                </a>
              </div>

              ${motherduckTokenIsSet ? `
                <div class="mt-6 pt-6 border-t border-outline-variant/30">
                  <div class="flex items-center justify-between mb-3">
                    <span class="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Synchronize Entire Database</span>
                    <span class="text-[9px] text-on-surface-variant/60 italic">Local as source of truth</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="flex-1 flex flex-col gap-1.5">
                      <button id="btn-push-all" class="w-full bg-surface-container-highest border border-outline-variant/50 text-neutral-100 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-all flex items-center justify-center gap-2 shadow-sm group">
                        <span class="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">upload</span> Push All
                      </button>
                      <div class="flex items-center gap-1.5 px-1">
                        <span class="material-symbols-outlined text-[12px] text-amber-500">security</span>
                        <span class="text-[9px] text-on-surface-variant leading-none font-medium">PII Excluded</span>
                      </div>
                    </div>
                    <div class="flex-1 flex flex-col gap-1.5">
                      <button id="btn-pull-all" class="w-full bg-surface-container-highest border border-outline-variant/50 text-neutral-100 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-surface-container transition-all flex items-center justify-center gap-2 shadow-sm group">
                        <span class="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">download</span> Pull All
                      </button>
                      <div class="h-[12px]"></div> <!-- Spacer for alignment -->
                    </div>
                  </div>
                  <div id="sync-all-status" class="mt-3 text-[10px] hidden p-3 rounded-lg bg-black/20 border border-outline-variant/10 max-h-40 overflow-y-auto custom-scrollbar font-mono text-on-surface-variant"></div>
                </div>
              ` : ''}
            ` : `
              <div class="space-y-4 pt-2">
                <div>
                  <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Motherduck Token</label>
                  ${motherduckTokenIsSet ? `
                    <div class="flex items-center gap-3 mb-2">
                      <span class="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/30 px-3 py-1 rounded-full">
                        <span class="material-symbols-outlined text-sm">lock</span> Token stored securely
                      </span>
                      <button id="btn-clear-md-token" class="text-xs text-on-surface-variant hover:text-red-400 transition-colors underline">Replace</button>
                    </div>
                  ` : ''}
                  <input id="md-token" type="password" class="w-full bg-surface-container-highest border border-outline-variant/50 rounded-lg px-4 py-3 text-sm text-neutral-100 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors" placeholder="${motherduckTokenIsSet ? 'Enter new token' : 'e.g. eyJhbG...'}" />
                  <div class="mt-2">
                    <a href="https://motherduck.com/docs/key-tasks/authenticating-and-connecting-to-motherduck/authenticating-to-motherduck/#creating-an-access-token" target="_blank" class="text-[10px] text-on-surface-variant hover:text-neutral-100 transition-colors flex items-center gap-1">
                      <span class="material-symbols-outlined text-[12px]">info</span>
                      Guide: Create an Access Token (Read & Write)
                    </a>
                  </div>
                </div>
                
                <div class="flex items-center gap-4">
                  <button id="btn-save-motherduck" class="bg-primary-fixed-dim text-on-primary-fixed font-bold py-2 px-6 rounded-full text-sm hover:brightness-110 transition-all shadow-md">
                    Save
                  </button>
                  <button id="btn-test-motherduck" class="text-sm font-bold text-neutral-100 hover:text-primary-fixed-dim transition-colors">Test</button>
                  <button id="btn-cancel-motherduck" class="text-sm font-bold text-on-surface-variant hover:text-neutral-100 transition-colors">Cancel</button>
                </div>
                <div id="md-test-status" class="text-xs mt-2 hidden p-2 rounded border"></div>
              </div>
            `}
          </div>

          <!-- BigQuery -->
          <div class="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-6 relative group overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-blue-500 text-2xl">cloud</span>
                <h3 class="text-lg font-medium text-neutral-100">BigQuery</h3>
              </div>
              <span class="text-[10px] bg-blue-500/20 text-blue-500 border border-blue-500/30 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Coming Soon</span>
            </div>
            <p class="text-sm text-on-surface-variant mb-4">Google's fully managed, serverless data warehouse.</p>
            <button class="text-sm font-bold text-outline-variant cursor-not-allowed" disabled>Configure</button>
          </div>
        </div>
      </section>
    `;
  };

  const attachIntegrationsListeners = () => {
    // Ollama listeners
    const baseUrlInput = container.querySelector('#ollama-base-url') as HTMLInputElement | null;
    if (baseUrlInput) baseUrlInput.value = ollamaConfig.base_url;

    const defaultModelInput = container.querySelector('#ollama-default-model') as HTMLInputElement | null;
    if (defaultModelInput) defaultModelInput.value = ollamaConfig.default_model;

    const configureBtn = container.querySelector('#btn-configure-ollama');
    if (configureBtn) {
      configureBtn.addEventListener('click', () => {
        isConfiguringOllama = true;
        renderContent();
      });
    }

    const cancelBtn = container.querySelector('#btn-cancel-ollama');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        isConfiguringOllama = false;
        renderContent();
      });
    }

    const modeRadios = container.querySelectorAll('input[name="ollama-mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        ollamaConfig.mode = (e.target as HTMLInputElement).value;
        renderContent();
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
          if (urlInput) ollamaConfig.base_url = urlInput.value;
          const modelInput = container.querySelector('#ollama-default-model') as HTMLInputElement;
          if (modelInput) ollamaConfig.default_model = modelInput.value;

          const keyInput = container.querySelector('#ollama-api-key') as HTMLInputElement;
          if (keyInput && keyInput.value && keyInput.value !== REDACTED) {
            ollamaConfig.api_key = keyInput.value;
          } else if (apiKeyIsSet) {
            ollamaConfig.api_key = REDACTED;
          } else {
            ollamaConfig.api_key = '';
          }

          await api.updateSetting('ollama', {
            mode: ollamaConfig.mode,
            base_url: ollamaConfig.base_url,
            default_model: ollamaConfig.default_model,
            api_key: ollamaConfig.api_key
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
        if (urlInput) ollamaConfig.base_url = urlInput.value;

        const modelInput = container.querySelector('#ollama-default-model') as HTMLInputElement;
        if (modelInput) ollamaConfig.default_model = modelInput.value;

        const REDACTED = '••••••••';
        const keyInput = container.querySelector('#ollama-api-key') as HTMLInputElement;
        if (keyInput && keyInput.value && keyInput.value !== REDACTED) {
          ollamaConfig.api_key = keyInput.value;
        } else if (apiKeyIsSet) {
          ollamaConfig.api_key = REDACTED;
        } else {
          ollamaConfig.api_key = '';
        }

        if (ollamaConfig.mode === 'default') {
          ollamaConfig.base_url = 'http://localhost:11434';
          ollamaConfig.default_model = 'gemma3:4b';
          ollamaConfig.api_key = '';
        }

        const btn = saveBtn as HTMLButtonElement;
        btn.disabled = true;
        btn.classList.add('opacity-50');

        try {
          await api.updateSetting('ollama', {
            mode: ollamaConfig.mode,
            base_url: ollamaConfig.base_url,
            default_model: ollamaConfig.default_model,
            api_key: ollamaConfig.api_key
          });

          const status = container.querySelector('#save-status');
          if (status) {
            status.classList.remove('opacity-0');
            setTimeout(() => {
              status.classList.add('opacity-0');
              setTimeout(() => {
                isConfiguringOllama = false;
                renderContent();
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
        isConfiguringMotherduck = true;
        renderContent();
      });
    }

    const cancelMdBtn = container.querySelector('#btn-cancel-motherduck');
    if (cancelMdBtn) {
      cancelMdBtn.addEventListener('click', () => {
        isConfiguringMotherduck = false;
        renderContent();
      });
    }

    const clearMdTokenBtn = container.querySelector('#btn-clear-md-token');
    if (clearMdTokenBtn) {
      clearMdTokenBtn.addEventListener('click', () => {
        motherduckTokenIsSet = false;
        renderContent();
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
          if (motherduckTokenIsSet && !tokenToSave) tokenToSave = REDACTED;

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
        if (motherduckTokenIsSet && !tokenToSave) tokenToSave = REDACTED;

        const btn = saveMdBtn as HTMLButtonElement;
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
          await api.updateSetting('motherduck', { token: tokenToSave });
          motherduckTokenIsSet = tokenToSave !== '';
          isConfiguringMotherduck = false;
          renderContent();
        } catch (e) {
          console.error('Failed to save Motherduck settings', e);
          alert('Failed to save settings');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Save';
        }
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
  };

  // Initial Load
  renderContent();

  // Load actual data
  api.getSetting('ollama').then(setting => {
    if (setting && setting.value && Object.keys(setting.value).length > 0) {
      const { api_key, ...rest } = setting.value;
      apiKeyIsSet = api_key === '••••••••';
      ollamaConfig = { ...ollamaConfig, ...rest, api_key: '' };
      renderContent();
    }
  }).catch(e => console.error('Failed to fetch settings', e));

  api.getSetting('motherduck').then(setting => {
    if (setting && setting.value && setting.value.token) {
      motherduckTokenIsSet = setting.value.token === '••••••••';
      renderContent();
    }
  }).catch(e => console.error('Failed to fetch Motherduck settings', e));

  return container;
}
