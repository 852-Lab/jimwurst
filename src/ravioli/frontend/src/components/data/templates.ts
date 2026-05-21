import { formatBytes, formatDateTime } from '../../utils/formatters';

export function getTableAndModalHTML(sources: any[]): string {
  return `
    <div class="max-w-6xl mx-auto w-full pb-20">
      <header class="mb-12 flex items-end justify-between">
        <div>
          <h1 class="text-4xl font-medium tracking-tight text-neutral-100 mb-2">Data Sources</h1>
          <p class="text-neutral-500 max-w-2xl">Manage your analytical assets. Ingested data is automatically synced with DuckDB.</p>
        </div>
        <button id="btn-add-source" class="px-6 py-3 rounded-2xl bg-primary text-on-primary font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 group">
          <span class="material-symbols-outlined group-hover:rotate-90 transition-transform">add</span>
          Add New Source
        </button>
      </header>

      <!-- Assets Table -->
      <div class="bg-surface-container-low rounded-3xl overflow-hidden border border-outline/10 shadow-2xl">
        <div class="px-8 py-6 border-b border-outline/10 flex items-center justify-between bg-surface-container-low/50 backdrop-blur-sm sticky top-0 z-10">
          <h2 class="text-lg font-medium text-neutral-200">Ingested Assets</h2>
          <span class="text-[10px] text-neutral-500 uppercase tracking-[0.2em]">${sources.length} Total Assets</span>
        </div>
        
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-[10px] uppercase tracking-[0.2em] text-neutral-500 border-b border-outline/5">
                <th class="px-8 py-4 font-medium">Type</th>
                <th class="px-8 py-4 font-medium">Asset Name</th>
                <th class="px-8 py-4 font-medium">Description</th>
                <th class="px-8 py-4 font-medium">Rows</th>
                <th class="px-8 py-4 font-medium">Status</th>
                <th class="px-8 py-4 font-medium">Timeline</th>
                <th class="px-8 py-4 font-medium">Owner / Creator</th>
                <th class="px-8 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline/5">
              ${sources.length === 0 ? `
                <tr>
                  <td colspan="9" class="px-8 py-20 text-center">
                    <div class="flex flex-col items-center justify-center">
                      <div class="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center mb-4 opacity-50">
                        <span class="material-symbols-outlined text-3xl">database_off</span>
                      </div>
                      <p class="text-neutral-500 italic">No assets ingested yet. Click "Add New Source" to get started.</p>
                    </div>
                  </td>
                </tr>
              ` : sources.map(source => `
                <tr class="hover:bg-white/[0.02] transition-colors group">
                  <td class="px-8 py-5">
                    <div class="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center border border-outline/5">
                      <span class="material-symbols-outlined text-lg ${source.source_type === 'wfs' ? 'text-primary' : 'text-neutral-400'}">
                        ${source.source_type === 'wfs' ? 'api' : 'description'}
                      </span>
                    </div>
                  </td>
                  <td class="px-8 py-5">
                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <span class="text-neutral-200 font-medium">${source.original_filename}</span>
                        ${source.has_pii ? `
                          <span class="pii-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase tracking-wider border border-amber-500/20 group/pii" data-id="${source.id}" title="Likely contains PII">
                            PII
                            <button class="btn-dismiss-pii hover:text-amber-300 transition-colors opacity-0 group-hover/pii:opacity-100 transition-opacity">
                              <span class="material-symbols-outlined text-[10px]">close</span>
                            </button>
                          </span>
                        ` : ''}
                      </div>
                      <span class="text-[10px] text-neutral-500 font-mono mt-0.5">${source.source_type === 'wfs' ? 'WFS API' : 'Flat File'} • ${formatBytes(source.size_bytes)}</span>
                    </div>
                  </td>
                  <td class="px-8 py-5">
                    <div class="desc-container flex items-center gap-2 group/desc max-w-xs w-full" data-id="${source.id}">
                      <span class="desc-text text-neutral-400 text-sm truncate cursor-pointer hover:text-neutral-200 transition-colors flex-1" title="${source.description || ''}" data-desc="${source.description || ''}">${source.description || '<span class="italic opacity-30">Add description...</span>'}</span>
                      <input type="text" class="desc-input hidden w-full bg-surface-container-highest border border-primary/30 rounded px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all" value="${source.description || ''}" placeholder="Enter description..." />
                      <div class="flex items-center gap-1 opacity-0 group-hover/desc:opacity-100 transition-opacity">
                        <button class="btn-generate-desc p-1 rounded-md hover:bg-primary/10 text-primary/70 hover:text-primary transition-all flex-shrink-0" title="AI Generate Description">
                          <span class="material-symbols-outlined text-[16px]">auto_awesome</span>
                        </button>
                        <button class="btn-edit-desc p-1 rounded-md hover:bg-white/10 text-neutral-500 hover:text-primary transition-all flex-shrink-0" title="Edit Description">
                          <span class="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      </div>
                    </div>
                  </td>
                  <td class="px-8 py-5 text-neutral-300 font-medium">
                    ${source.status === 'pending'
                      ? `<span class="flex items-center gap-1.5">
                           ${source.row_count
                             ? `<span class="text-blue-400">${source.row_count.toLocaleString()}</span>
                                <span class="text-blue-400/50 text-[10px] animate-pulse">fetching…</span>`
                             : `<span class="text-blue-400/50 text-[10px] animate-pulse">fetching…</span>`
                           }
                         </span>`
                      : (source.row_count ? source.row_count.toLocaleString() : '--')
                    }
                  </td>
                  <td class="px-8 py-5">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                      source.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                      source.status === 'failed'    ? 'bg-red-500/10 text-red-400' :
                      source.status === 'pending'   ? 'bg-blue-500/10 text-blue-400' :
                                                    'bg-yellow-500/10 text-yellow-400'
                    }">
                      ${source.status === 'pending'
                        ? `<span class="material-symbols-outlined text-[10px] animate-spin">sync</span>`
                        : `<span class="w-1.5 h-1.5 rounded-full ${
                            source.status === 'completed' ? 'bg-green-400' :
                            source.status === 'failed'    ? 'bg-red-400'   : 'bg-yellow-400'
                          }"></span>`
                      }
                      ${source.status === 'pending'   ? 'In Progress' :
                        source.status === 'completed' ? 'Completed'   :
                        source.status === 'failed'    ? 'Failed'      : source.status}
                    </span>
                  </td>
                  <td class="px-8 py-5">
                    <div class="flex flex-col gap-0.5 whitespace-nowrap">
                      <div class="flex items-center gap-1.5 text-[11px] text-neutral-300">
                        <span class="material-symbols-outlined text-[14px] opacity-50">event</span>
                        ${formatDateTime(source.created_at)}
                      </div>
                      ${source.updated_at !== source.created_at ? `
                        <div class="flex items-center gap-1.5 text-[9px] text-neutral-500 italic">
                          <span class="material-symbols-outlined text-[12px] opacity-30">update</span>
                          Updated ${formatDateTime(source.updated_at)}
                        </div>
                      ` : ''}
                    </div>
                  </td>
                  <td class="px-8 py-5">
                    <div class="flex flex-col gap-1.5 min-w-[140px]">
                      <!-- Owner -->
                      <div class="flex items-center gap-2" title="Owner">
                        <div class="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center border border-primary/20 shrink-0">
                          <span class="text-[8px] font-bold text-primary">${((source.owner_user?.name || source.owner_group?.name || source.owner?.name || 'Admin')[0]).toUpperCase()}</span>
                        </div>
                        <span class="text-xs text-neutral-300 font-medium truncate max-w-[100px]">${source.owner_user?.name || source.owner_group?.name || source.owner?.name || 'Admin'}</span>
                        <span class="text-[8px] uppercase tracking-wider text-outline px-1 py-0.5 rounded bg-white/5 border border-white/5 shrink-0">${source.owner_group ? 'Team' : 'Owner'}</span>
                      </div>
                      <!-- Creator -->
                      <div class="flex items-center gap-2" title="Creator">
                        <div class="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary/20 shrink-0">
                          <span class="text-[8px] font-bold text-secondary">${((source.creator_user?.name || 'Admin')[0]).toUpperCase()}</span>
                        </div>
                        <span class="text-[11px] text-neutral-500 font-medium truncate max-w-[100px]">${source.creator_user?.name || 'Admin'}</span>
                        <span class="text-[8px] uppercase tracking-wider text-outline px-1 py-0.5 rounded bg-white/5 border border-white/5 shrink-0">Creator</span>
                      </div>
                    </div>
                  </td>
                  <td class="px-8 py-5 text-right flex justify-end gap-2">
                    <button class="btn-inspect p-2 rounded-lg hover:bg-primary/10 text-neutral-400 hover:text-primary transition-all" data-table="${source.schema_name}.${source.table_name}" data-filename="${source.original_filename}" title="Preview">
                      <span class="material-symbols-outlined">visibility</span>
                    </button>
                    <button class="btn-delete p-2 rounded-lg hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-all" data-id="${source.id}" title="Delete">
                      <span class="material-symbols-outlined">delete</span>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Add Source Modal -->
    <div id="add-source-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md hidden opacity-0 transition-opacity duration-300">
      <div class="bg-surface-container rounded-[2rem] w-full max-w-2xl flex flex-col shadow-2xl border border-outline/10 translate-y-4 transition-transform duration-300 overflow-hidden">
        <header class="px-8 py-6 border-b border-outline/10 flex items-center justify-between bg-surface-container-high/50">
          <div>
            <h2 class="text-xl font-medium text-neutral-100">Add New Data Source</h2>
            <p id="modal-step-subtitle" class="text-xs text-neutral-500 uppercase tracking-widest mt-1">Select ingestion method</p>
          </div>
          <button id="close-add-modal" class="p-2 rounded-full hover:bg-white/5 text-neutral-400 hover:text-white transition-colors">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>
        
        <div id="add-modal-content" class="p-8">
          <!-- Step 1: Selection -->
          <div id="step-selection" class="grid grid-cols-2 gap-6">
            <div class="source-type-card p-8 rounded-3xl bg-surface-container-highest border border-outline/10 hover:border-primary/50 hover:bg-surface-container-highest/80 cursor-pointer transition-all group flex flex-col items-center text-center" data-type="wfs">
              <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span class="material-symbols-outlined text-primary text-4xl">api</span>
              </div>
              <h3 class="text-lg font-medium text-neutral-100 mb-2">WFS API</h3>
              <p class="text-sm text-neutral-500">Connect to geospatial web feature services (Opendata, Geoserver)</p>
            </div>
            
            <div class="source-type-card p-8 rounded-3xl bg-surface-container-highest border border-outline/10 hover:border-primary/50 hover:bg-surface-container-highest/80 cursor-pointer transition-all group flex flex-col items-center text-center" data-type="csv">
              <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span class="material-symbols-outlined text-primary text-4xl">upload_file</span>
              </div>
              <h3 class="text-lg font-medium text-neutral-100 mb-2">Flat File</h3>
              <p class="text-sm text-neutral-500">Upload CSV or XLSX files from your local machine</p>
            </div>
          </div>

          <!-- Step 2: WFS Form -->
          <div id="step-wfs" class="hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div class="space-y-6">
              <div class="relative">
                <label class="text-[10px] uppercase tracking-widest text-neutral-500 mb-2 block">Service URL</label>
                <input type="text" id="wfs-url" placeholder="https://..." 
                  class="w-full bg-surface-container-highest border border-outline/20 rounded-2xl px-6 py-4 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-primary/50 transition-all" />
              </div>
              
              <div id="wfs-ingest-controls" class="flex justify-end pt-4 border-t border-outline/5">
                <button id="btn-ingest-wfs" class="px-8 py-3 rounded-2xl bg-primary text-on-primary font-medium hover:bg-primary/90 transition-all flex items-center gap-2 group">
                  Start Ingestion
                  <span class="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </div>
            </div>
            <button class="btn-back mt-8 text-neutral-500 hover:text-neutral-300 flex items-center gap-2 text-sm transition-colors">
              <span class="material-symbols-outlined text-lg">arrow_back</span>
              Back to Selection
            </button>
          </div>

          <!-- Step 2: CSV Form -->
          <div id="step-csv" class="hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div class="space-y-4 mb-6">
              <div class="relative group">
                <label class="text-[10px] uppercase tracking-widest text-neutral-500 mb-2 block group-focus-within:text-primary transition-colors">Upload Context (Optional)</label>
                <div class="relative">
                  <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-primary transition-colors text-lg">info</span>
                  <input type="text" id="upload-context" placeholder="e.g. Substack export data for April..." 
                    class="w-full bg-surface-container-highest border border-outline/20 rounded-2xl pl-12 pr-6 py-4 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all" />
                </div>
                <p class="text-[9px] text-neutral-600 mt-2 ml-1">This context helps the AI generate more accurate descriptions for your assets.</p>
              </div>
            </div>
            
            <div id="drop-zone" class="border-2 border-dashed border-outline/20 rounded-3xl p-12 flex flex-col items-center justify-center bg-surface-container-highest hover:bg-surface-container hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden">
              <div id="drop-zone-content" class="flex flex-col items-center justify-center transition-opacity duration-300">
                <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <span class="material-symbols-outlined text-primary text-3xl">upload_file</span>
                </div>
                <h3 class="text-xl font-medium text-neutral-200 mb-2">Drop files or folders here</h3>
                <p class="text-neutral-500 text-sm">or click to browse CSV / XLSX</p>
              </div>
              <div id="drop-zone-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-surface-container/90 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300 z-10 p-6">
                <span class="material-symbols-outlined animate-spin text-primary text-4xl mb-4">sync</span>
                <p id="ingestion-status" class="text-neutral-200 font-medium animate-pulse text-center">Ingestion in Progress...</p>
                <p id="queue-status" class="text-[10px] text-primary/70 mt-1 uppercase tracking-[0.2em] font-bold"></p>
                
                <div id="ingestion-console" class="mt-6 w-full max-w-md bg-black/40 rounded-xl p-4 font-mono text-[10px] text-neutral-400 overflow-y-auto max-h-48 border border-outline/10 text-left">
                  <div class="text-primary/70 mb-2 border-b border-outline/5 pb-1 uppercase tracking-tighter flex justify-between">
                    <span id="console-filename">System Terminal</span>
                    <span class="animate-pulse">●</span>
                  </div>
                  <div id="ingestion-logs" class="space-y-1">
                    <div class="text-neutral-600 italic">Initializing neural link...</div>
                  </div>
                </div>
              </div>
              <input type="file" id="file-input" class="hidden" accept=".csv,.xlsx,.xml,.gpx" multiple>
            </div>
            <button class="btn-back mt-8 text-neutral-500 hover:text-neutral-300 flex items-center gap-2 text-sm transition-colors">
              <span class="material-symbols-outlined text-lg">arrow_back</span>
              Back to Selection
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <div id="preview-modal" class="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md hidden opacity-0 transition-opacity duration-300">
      <div class="bg-surface-container rounded-[2rem] w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl border border-outline/10 translate-y-4 transition-transform duration-300 overflow-hidden">
        <header class="px-8 py-6 border-b border-outline/10 flex items-center justify-between">
          <div>
            <h2 id="modal-title" class="text-xl font-medium text-neutral-100">Data Preview</h2>
            <p id="modal-subtitle" class="text-xs text-neutral-500 uppercase tracking-widest mt-1">Showing first 10 rows</p>
          </div>
          <button id="close-preview-modal" class="p-2 rounded-full hover:bg-white/5 text-neutral-400 hover:text-white transition-colors">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>
        <div id="modal-content" class="flex-1 overflow-auto p-8">
          <div class="flex items-center justify-center h-full">
            <span class="material-symbols-outlined animate-spin text-primary">sync</span>
          </div>
        </div>
      </div>
    </div>

  `;
}
