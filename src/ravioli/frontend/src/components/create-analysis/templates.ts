import { store } from '../../store';

export function renderSelection() {
    return `
      <div class="grid grid-cols-2 gap-8">
        <!-- Quick Insight Card -->
        <button id="mode-quick" class="glass-panel p-10 rounded-3xl space-y-6 text-left group hover:border-primary-fixed-dim/40 transition-all hover:-translate-y-1">
          <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-3xl" data-icon="bolt">bolt</span>
          </div>
          <div class="space-y-2">
            <h3 class="text-2xl font-headline-sm text-white">Quick Insight</h3>
            <p class="text-on-surface-variant text-sm leading-relaxed opacity-70">
              Upload a Flat File (CSV/XLSX) and get an instant AI-powered executive summary. Perfect for vibe-checking new data streams.
            </p>
          </div>
          <div class="flex items-center gap-2 text-primary text-[10px] font-label-sm uppercase tracking-widest pt-4">
            <span>Fast Track</span>
            <span class="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
          </div>
        </button>

        <!-- Deep Dive Card -->
        <button id="mode-deep" class="glass-panel p-10 rounded-3xl space-y-6 text-left group hover:border-secondary-fixed-dim/40 transition-all hover:-translate-y-1">
          <div class="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-3xl" data-icon="biotech">biotech</span>
          </div>
          <div class="space-y-2">
            <h3 class="text-2xl font-headline-sm text-white">Deep Dive</h3>
            <p class="text-on-surface-variant text-sm leading-relaxed opacity-70">
              Create a full analysis notebook. Query, transform, and visualize with the complete Ravioli toolset.
            </p>
          </div>
          <div class="flex items-center gap-2 text-secondary text-[10px] font-label-sm uppercase tracking-widest pt-4">
            <span>Orchestration</span>
            <span class="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
          </div>
        </button>
      </div>
      
      <div class="flex justify-center pt-8">
        <button id="cancel-create" class="text-sm font-label-sm text-outline hover:text-white uppercase tracking-widest transition-colors">
          Abort Mission
        </button>
      </div>
    `;
  }

export function renderQuick(isFetchingFiles: boolean, existingFiles: any[]) {
    const fileListHtml = isFetchingFiles
      ? `
        <div class="pt-6 text-center space-y-2">
          <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="text-[10px] text-outline uppercase tracking-widest opacity-40">Retrieving local assets...</p>
        </div>
      `
      : existingFiles.length > 0
        ? `
          <div class="space-y-3 pt-6 border-t border-outline-variant/20">
            <p class="text-[10px] font-label-sm text-outline uppercase tracking-widest opacity-60">Or use existing data</p>
            <div class="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              ${existingFiles.map(file => `
                <button class="existing-file-item flex items-center justify-between p-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-all group text-left border border-transparent hover:border-primary/20" data-file-id="${file.id}">
                  <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-outline group-hover:text-primary transition-colors">
                      <span class="material-symbols-outlined text-lg" data-icon="description">description</span>
                    </div>
                    <div class="overflow-hidden">
                      <p class="text-sm text-white font-medium truncate">${file.original_filename}</p>
                      <p class="text-[10px] text-outline-variant uppercase tracking-tighter">${(file.size_bytes / 1024).toFixed(1)} KB • ${file.row_count || 0} rows</p>
                    </div>
                  </div>
                  <span class="material-symbols-outlined text-sm text-outline opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" data-icon="arrow_forward">arrow_forward</span>
                </button>
              `).join('')}
            </div>
          </div>
        `
        : '';

    return `
      <div class="glass-panel p-10 rounded-3xl space-y-8 max-w-xl mx-auto w-full">
        <div id="quick-main-content" class="space-y-6">
          <div id="drop-zone" class="border-2 border-dashed border-outline-variant/30 rounded-2xl p-12 text-center space-y-4 hover:border-primary-fixed-dim/50 transition-colors cursor-pointer group">
            <input type="file" id="file-input" class="hidden" accept=".csv,.xlsx" />
            <div class="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
              <span class="material-symbols-outlined text-3xl text-outline" data-icon="upload_file">upload_file</span>
            </div>
            <div class="space-y-1">
              <p class="text-white font-medium">Drop your file here</p>
              <p class="text-xs text-on-surface-variant opacity-60">or click to browse CSV / XLSX</p>
            </div>
          </div>

          ${fileListHtml}
        </div>

        <div id="processing-state" class="hidden space-y-6 py-8 text-center">
          <div class="relative w-20 h-20 mx-auto">
            <div class="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div class="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div class="space-y-2">
            <p class="text-xl font-headline-sm text-white animate-pulse">Syncing Neural Link...</p>
            <p class="text-xs text-on-surface-variant uppercase tracking-widest opacity-60">Generating Executive Summary</p>
          </div>
          <div id="quick-insight-logs" class="mt-8 max-h-48 overflow-y-auto text-left bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-[10px] text-primary/80 space-y-1 w-full max-w-md mx-auto custom-scrollbar hidden">
            <!-- logs will be appended here -->
          </div>
        </div>

        <div class="flex items-center justify-between pt-4">
          <button id="back-to-select" class="text-sm font-label-sm text-outline hover:text-white uppercase tracking-widest transition-colors">
            Back
          </button>
          <p class="text-[10px] text-outline uppercase tracking-widest opacity-40">Local LLM Node Ready</p>
        </div>
      </div>
    `;
  }

export function renderDeep(selectedDataSourceIds: string[], selectedKnowledgePageIds: string[]) {
    const dataSources = store.getDataSources().filter(ds => ds.status === 'completed');
    const knowledgePages = store.getKnowledgePages();

    const dataSourcesHtml = dataSources.length > 0
      ? `
        <div class="space-y-3">
          <p class="text-[10px] font-label-sm text-outline uppercase tracking-widest opacity-60">1. Select Data Sources to Ingest</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
            ${dataSources.map(ds => {
        const isSelected = selectedDataSourceIds.includes(ds.id);
        return `
                <button type="button" class="ds-select-btn flex items-center justify-between p-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-all group text-left border ${isSelected ? 'border-primary bg-primary/[0.03]' : 'border-transparent'} cursor-pointer" data-ds-id="${ds.id}">
                  <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-outline group-hover:text-primary transition-colors">
                      <span class="material-symbols-outlined text-lg" data-icon="database">database</span>
                    </div>
                    <div class="overflow-hidden">
                      <p class="text-sm text-white font-medium truncate">${ds.original_filename}</p>
                      <p class="text-[10px] text-outline-variant uppercase tracking-tighter">${(ds.size_bytes / 1024).toFixed(1)} KB • ${ds.row_count || 0} rows</p>
                    </div>
                  </div>
                  <span class="material-symbols-outlined text-primary text-sm ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75'} transition-all" data-icon="check_circle">check_circle</span>
                </button>
              `;
      }).join('')}
          </div>
        </div>
      `
      : `
        <div class="space-y-3">
          <p class="text-[10px] font-label-sm text-outline uppercase tracking-widest opacity-60">1. Select Data Sources to Ingest</p>
          <div class="p-4 rounded-xl bg-surface-container-low border border-dashed border-outline-variant/10 text-center">
            <span class="material-symbols-outlined text-outline opacity-40 text-2xl" data-icon="database">database</span>
            <p class="text-xs text-outline opacity-50 mt-1">No completed data sources found.</p>
          </div>
        </div>
      `;

    const knowledgePagesHtml = knowledgePages.length > 0
      ? `
        <div class="space-y-3">
          <p class="text-[10px] font-label-sm text-outline uppercase tracking-widest opacity-60">2. Append Context from Knowledge Base (Optional)</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
            ${knowledgePages.map(kp => {
        const isSelected = selectedKnowledgePageIds.includes(kp.id);
        const iconEmoji = kp.icon?.emoji || 'description';
        const iconType = kp.icon?.type === 'emoji' ? 'emoji' : 'icon';
        return `
                <button type="button" class="kp-select-btn flex items-center justify-between p-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-all group text-left border ${isSelected ? 'border-secondary bg-secondary/[0.03]' : 'border-transparent'} cursor-pointer" data-kp-id="${kp.id}">
                  <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-outline group-hover:text-secondary transition-colors">
                      ${iconType === 'emoji'
            ? `<span class="text-lg">${iconEmoji}</span>`
            : `<span class="material-symbols-outlined text-lg" data-icon="${iconEmoji}">${iconEmoji}</span>`}
                    </div>
                    <div class="overflow-hidden">
                      <p class="text-sm text-white font-medium truncate">${kp.title}</p>
                      <p class="text-[10px] text-outline-variant uppercase tracking-tighter">${kp.ownership_type || 'individual'} ownership</p>
                    </div>
                  </div>
                  <span class="material-symbols-outlined text-secondary text-sm ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75'} transition-all" data-icon="check_circle">check_circle</span>
                </button>
              `;
      }).join('')}
          </div>
        </div>
      `
      : `
        <div class="space-y-3">
          <p class="text-[10px] font-label-sm text-outline uppercase tracking-widest opacity-60">2. Append Context from Knowledge Base (Optional)</p>
          <div class="p-4 rounded-xl bg-surface-container-low border border-dashed border-outline-variant/10 text-center">
            <span class="material-symbols-outlined text-outline opacity-40 text-2xl" data-icon="local_library">local_library</span>
            <p class="text-xs text-outline opacity-50 mt-1">No knowledge articles found.</p>
          </div>
        </div>
      `;

    return `
      <div class="glass-panel p-8 rounded-3xl space-y-6 max-w-2xl mx-auto w-full">
        <div class="space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2 group">
              <label for="analysis-title" class="text-[10px] font-label-sm text-outline uppercase tracking-widest opacity-60 group-focus-within:opacity-100 transition-opacity">Title</label>
              <input 
                type="text" 
                id="analysis-title" 
                placeholder="e.g., Q3 Financial Review" 
                class="w-full bg-transparent border-b border-outline-variant/30 py-2 text-white focus:outline-none focus:border-primary transition-colors text-lg font-headline-sm"
              />
            </div>

            <div class="space-y-2 group">
              <label for="analysis-desc" class="text-[10px] font-label-sm text-outline uppercase tracking-widest opacity-60 group-focus-within:opacity-100 transition-opacity">Description</label>
              <textarea 
                id="analysis-desc" 
                placeholder="What mysteries shall we unravel today?" 
                rows="2"
                class="w-full bg-transparent border-b border-outline-variant/30 py-2 text-on-surface-variant focus:outline-none focus:border-primary transition-colors resize-none font-body-lg"
              ></textarea>
            </div>
          </div>

          <!-- Select Data Sources -->
          ${dataSourcesHtml}

          <!-- Append Knowledge Page -->
          ${knowledgePagesHtml}
        </div>

        <div class="flex items-center justify-between pt-4 border-t border-outline-variant/10">
          <button id="back-to-select" class="text-sm font-label-sm text-outline hover:text-white uppercase tracking-widest transition-colors cursor-pointer">
            Back
          </button>
          <button id="confirm-create" class="btn-primary flex items-center gap-3 group cursor-pointer">
            <span>Initialize Deep Dive</span>
            <span class="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform" data-icon="rocket_launch">rocket_launch</span>
          </button>
        </div>
      </div>
    `;
  }
