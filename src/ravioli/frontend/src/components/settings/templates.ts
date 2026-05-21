import { state } from './state';

export const renderGeneralHtml = (user: any) => `
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

export const renderIntegrationsHtml = () => {
    let ollamaContent = '';

    if (!state.isConfiguringOllama) {
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
            <label class="flex items-center gap-3 p-3 rounded-lg border ${state.ollamaConfig.mode === 'default' ? 'border-primary-fixed-dim bg-primary-fixed-dim/10' : 'border-outline-variant/50 bg-surface-container-highest'} cursor-pointer transition-colors">
              <input type="radio" name="ollama-mode" value="default" class="text-primary-fixed-dim focus:ring-primary-fixed-dim" ${state.ollamaConfig.mode === 'default' ? 'checked' : ''}>
              <div class="flex flex-col">
                <span class="text-sm font-bold text-neutral-100">Default</span>
                <span class="text-xs text-on-surface-variant">Use the built-in default model of Gemma3:4b from local Ollama</span>
              </div>
            </label>
            
            <label class="flex items-center gap-3 p-3 rounded-lg border ${state.ollamaConfig.mode === 'local' ? 'border-primary-fixed-dim bg-primary-fixed-dim/10' : 'border-outline-variant/50 bg-surface-container-highest'} cursor-pointer transition-colors">
              <input type="radio" name="ollama-mode" value="local" class="text-primary-fixed-dim focus:ring-primary-fixed-dim" ${state.ollamaConfig.mode === 'local' ? 'checked' : ''}>
              <div class="flex flex-col">
                <span class="text-sm font-bold text-neutral-100">Custom Local Runtime</span>
                <span class="text-xs text-on-surface-variant">Enter a custom base URL to another Ollama server on your network</span>
              </div>
            </label>
            
            <label class="flex items-center gap-3 p-3 rounded-lg border ${state.ollamaConfig.mode === 'cloud' ? 'border-primary-fixed-dim bg-primary-fixed-dim/10' : 'border-outline-variant/50 bg-surface-container-highest'} cursor-pointer transition-colors">
              <input type="radio" name="ollama-mode" value="cloud" class="text-primary-fixed-dim focus:ring-primary-fixed-dim" ${state.ollamaConfig.mode === 'cloud' ? 'checked' : ''}>
              <div class="flex flex-col">
                <span class="text-sm font-bold text-neutral-100">Ollama Cloud</span>
                <span class="text-xs text-on-surface-variant">Connect to Ollama Cloud with an API Key</span>
              </div>
            </label>
          </div>
          
          <div class="space-y-4 pt-2 border-t border-outline-variant/30">
            ${state.ollamaConfig.mode === 'local' ? `
              <div>
                <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Base URL</label>
                <input id="ollama-base-url" type="text" class="w-full bg-surface-container-highest border border-outline-variant/50 rounded-lg px-4 py-3 text-sm text-neutral-100 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors" placeholder="e.g. http://localhost:11434" />
              </div>
            ` : ''}
            
            ${state.ollamaConfig.mode !== 'default' ? `
              <div>
                <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Default Model</label>
                <input id="ollama-default-model" type="text" class="w-full bg-surface-container-highest border border-outline-variant/50 rounded-lg px-4 py-3 text-sm text-neutral-100 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors" placeholder="e.g. gemma3:4b" />
              </div>
            ` : ''}
            
            ${state.ollamaConfig.mode === 'cloud' ? `
              <div>
                <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">API Key</label>
                ${state.apiKeyIsSet ? `
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
              ${state.motherduckTokenIsSet ? `
                <span class="text-[10px] bg-green-400/20 text-green-400 border border-green-400/30 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Connected</span>
              ` : `
                <span class="text-[10px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Setup Needed</span>
              `}
            </div>
            
            ${!state.isConfiguringMotherduck ? `
              <p class="text-sm text-on-surface-variant mb-4">Serverless cloud analytics using DuckDB. Connect your local instance to Motherduck cloud.</p>
              <div class="flex items-center gap-4">
                <button id="btn-configure-motherduck" class="text-sm font-bold text-primary-fixed-dim hover:text-primary-fixed transition-colors">Configure</button>
                <a href="https://motherduck.com/docs/key-tasks/authenticating-and-connecting-to-motherduck/authenticating-to-motherduck/#creating-an-access-token" target="_blank" class="text-xs text-on-surface-variant hover:text-neutral-100 transition-colors flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">help_outline</span>
                  How to get a token?
                </a>
              </div>

              ${state.motherduckTokenIsSet ? `
                <div class="mt-6 pt-6 border-t border-outline-variant/30">
                  <div class="flex items-center justify-between mb-3">
                    <span class="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Synchronize Entire Database</span>
                    <span class="text-[9px] text-on-surface-variant/60 italic">Local as source of truth</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <button id="btn-push-all" class="flex-1 bg-surface-container-highest border border-outline-variant/50 text-neutral-100 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-all flex items-center justify-center gap-2 shadow-sm group">
                      <span class="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">upload</span> Push All
                    </button>
                    <button id="btn-pull-all" class="flex-1 bg-surface-container-highest border border-outline-variant/50 text-neutral-100 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-surface-container transition-all flex items-center justify-center gap-2 shadow-sm group">
                      <span class="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">download</span> Pull All
                    </button>
                  </div>
                  <div class="flex items-center gap-1.5 mt-2 px-1 opacity-80">
                    <span class="material-symbols-outlined text-[12px] text-amber-500">security</span>
                    <span class="text-[9px] text-on-surface-variant font-medium">PII data sources are automatically excluded from Push operations</span>
                  </div>
                  <div id="sync-all-status" class="mt-3 text-[10px] hidden p-3 rounded-lg bg-black/20 border border-outline-variant/10 max-h-40 overflow-y-auto custom-scrollbar font-mono text-on-surface-variant"></div>
                </div>
              ` : ''}
            ` : `
              <div class="space-y-4 pt-2">
                <div>
                  <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Motherduck Token</label>
                  ${state.motherduckTokenIsSet ? `
                    <div class="flex items-center gap-3 mb-2">
                      <span class="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/30 px-3 py-1 rounded-full">
                        <span class="material-symbols-outlined text-sm">lock</span> Token stored securely
                      </span>
                      <button id="btn-clear-md-token" class="text-xs text-on-surface-variant hover:text-red-400 transition-colors underline">Replace</button>
                    </div>
                  ` : ''}
                  <input id="md-token" type="password" class="w-full bg-surface-container-highest border border-outline-variant/50 rounded-lg px-4 py-3 text-sm text-neutral-100 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors" placeholder="${state.motherduckTokenIsSet ? 'Enter new token' : 'e.g. eyJhbG...'}" />
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
