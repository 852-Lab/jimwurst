import { store } from '../../store';
import { api } from '../../services/api';

export function bindDataInteractions(container: HTMLElement) {
  let isIngesting = false;
  
  // --- Modal Logic ---
  const addModal = container.querySelector('#add-source-modal') as HTMLElement;
  const btnAddSource = container.querySelector('#btn-add-source');
  const closeAddModal = container.querySelector('#close-add-modal');
  const stepSelection = container.querySelector('#step-selection') as HTMLElement;
  const stepWfs = container.querySelector('#step-wfs') as HTMLElement;
  const stepCsv = container.querySelector('#step-csv') as HTMLElement;
  const stepSubtitle = container.querySelector('#modal-step-subtitle') as HTMLElement;
  const sourceTypeCards = container.querySelectorAll('.source-type-card');
  const btnBacks = container.querySelectorAll('.btn-back');

  const showStep = (step: 'selection' | 'wfs' | 'csv') => {
    stepSelection.classList.toggle('hidden', step !== 'selection');
    stepWfs.classList.toggle('hidden', step !== 'wfs');
    stepCsv.classList.toggle('hidden', step !== 'csv');
    
    if (step === 'selection') stepSubtitle.textContent = 'Select ingestion method';
    else if (step === 'wfs') stepSubtitle.textContent = 'Configure WFS API Source';
    else if (step === 'csv') stepSubtitle.textContent = 'Upload Flat File (CSV / XLSX)';
  };

  btnAddSource?.addEventListener('click', () => {
    addModal.classList.remove('hidden');
    setTimeout(() => {
      addModal.classList.remove('opacity-0');
      addModal.querySelector('div')?.classList.remove('translate-y-4');
    }, 10);
    showStep('selection');
  });

  const hideAddModal = () => {
    addModal.classList.add('opacity-0');
    addModal.querySelector('div')?.classList.add('translate-y-4');
    setTimeout(() => addModal.classList.add('hidden'), 300);
  };

  closeAddModal?.addEventListener('click', () => {
    if (isIngesting) return;
    hideAddModal();
  });
  
  sourceTypeCards.forEach(card => {
    card.addEventListener('click', () => {
      if (isIngesting) return;
      const type = card.getAttribute('data-type');
      showStep(type as any);
    });
  });

  btnBacks.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isIngesting) return;
      showStep('selection');
    });
  });

  // --- WFS Ingestion Logic ---
  const wfsUrlInput = container.querySelector('#wfs-url') as HTMLInputElement;
  const ingestBtn = container.querySelector('#btn-ingest-wfs') as HTMLButtonElement;

  ingestBtn?.addEventListener('click', async () => {
    const url = wfsUrlInput.value.trim();
    if (!url) return;

    ingestBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Starting...';
    ingestBtn.disabled = true;

    try {
      // Fire ingestion — backend returns the pending record immediately and
      // auto-detects the layer in the background if not specified.
      const result = await api.ingestWFSLayer(url);

      // Close modal and optimistically inject the pending record into the
      // store right now — no round-trip re-fetch needed. The global poller
      // in main.ts will keep it updated every 3s from here on.
      hideAddModal();
      const existingSources = store.getDataSources();
      store.setDataSources([result, ...existingSources]);
    } catch (err: any) {
      alert(`Failed to start ingestion: ${err.message || err}`);
    } finally {
      ingestBtn.innerHTML = 'Start Ingestion <span class="material-symbols-outlined">arrow_forward</span>';
      ingestBtn.disabled = false;
    }
  });

  // --- CSV Upload Logic ---
  const dropZone = container.querySelector('#drop-zone');
  const fileInput = container.querySelector('#file-input') as HTMLInputElement;
  
  dropZone?.addEventListener('click', () => {
    if (isIngesting) return;
    fileInput.click();
  });
  
  // Drag & Drop
  ['dragover', 'dragenter'].forEach(eventName => {
    dropZone?.addEventListener(eventName, (e) => {
      if (isIngesting) return;
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('border-primary/50', 'bg-surface-container');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-primary/50', 'bg-surface-container');
    });
  });

  dropZone?.addEventListener('drop', async (e: any) => {
    if (isIngesting) return;
    const items = e.dataTransfer?.items;
    if (!items) return;

    const files: File[] = [];
    
    // UI Feedback for scanning
    const dropZoneContent = container.querySelector('#drop-zone-content');
    const dropZoneLoading = container.querySelector('#drop-zone-loading');
    const ingestionLogs = container.querySelector('#ingestion-logs');
    const ingestionStatus = container.querySelector('#ingestion-status');
    
    dropZoneContent?.classList.add('opacity-0');
    dropZoneLoading?.classList.remove('opacity-0', 'pointer-events-none');
    if (ingestionLogs) ingestionLogs.innerHTML = '<div class="text-primary/50 italic font-mono">Scanning folder contents...</div>';
    if (ingestionStatus) ingestionStatus.textContent = 'Scanning...';

    async function scanEntry(entry: any) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
        const ext = file.name.toLowerCase();
        if (ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xml') || ext.endsWith('.gpx')) {
          files.push(file);
        }
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readEntries = async () => {
          const entries: any[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
          if (entries.length > 0) {
            for (const child of entries) {
              await scanEntry(child);
            }
            await readEntries(); // Continue reading in case of many files
          }
        };
        await readEntries();
      }
    }

    const scanPromises = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) scanPromises.push(scanEntry(entry));
    }
    
    await Promise.all(scanPromises);
    
    if (files.length > 0) {
      const contextInput = container.querySelector('#upload-context') as HTMLInputElement;
      const context = contextInput?.value.trim() || '';
      await handleUploads(files, context);
    } else {
      alert('No uploadable files (.csv, .xlsx) found in selection.');
      dropZoneContent?.classList.remove('opacity-0');
      dropZoneLoading?.classList.add('opacity-0', 'pointer-events-none');
    }
  });

  fileInput?.addEventListener('change', async (e) => {
    if (isIngesting) return;
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      const contextInput = container.querySelector('#upload-context') as HTMLInputElement;
      const context = contextInput?.value.trim() || '';
      await handleUploads(Array.from(files), context);
    }
  });

  async function handleUploads(filesArray: File[], context?: string) {
    // Filter to be safe, though drop handles it, file input might not
    const filteredFiles = filesArray.filter(f => {
      const ext = f.name.toLowerCase();
      return ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xml') || ext.endsWith('.gpx');
    });
    
    if (filteredFiles.length === 0) return;
    
    isIngesting = true;

    const dropZoneContent = container.querySelector('#drop-zone-content');
    const dropZoneLoading = container.querySelector('#drop-zone-loading');
    const ingestionLogs = container.querySelector('#ingestion-logs');
    const consoleFilename = container.querySelector('#console-filename');
    const queueStatus = container.querySelector('#queue-status');
    const ingestionStatus = container.querySelector('#ingestion-status');
    
    dropZoneContent?.classList.add('opacity-0');
    dropZoneLoading?.classList.remove('opacity-0', 'pointer-events-none');
    
    if (ingestionLogs) ingestionLogs.innerHTML = '';
    if (ingestionStatus) ingestionStatus.textContent = 'Ingestion in Progress...';

    const addLog = (msg: string, isHeader = false, isWarning = false) => {
      if (ingestionLogs) {
        const div = document.createElement('div');
        div.className = 'font-mono text-[10px] py-0.5 animate-in fade-in slide-in-from-left-1 duration-300 whitespace-pre-wrap break-all';
        
        if (isHeader) {
          div.className = 'text-primary font-bold mt-2 mb-1 border-b border-primary/10 pb-1';
          div.textContent = msg;
        } else if (isWarning) {
          div.className += ' text-amber-500 bg-amber-500/5 px-2 py-1 rounded-lg border border-amber-500/10 my-2';
          div.textContent = msg;
        } else {
          // Detect log levels
          if (msg.startsWith('INFO: ')) {
            const span = document.createElement('span');
            span.className = 'text-blue-400 mr-2 opacity-80';
            span.textContent = 'INFO';
            div.appendChild(span);
            div.appendChild(document.createTextNode(msg.substring(6)));
          } else if (msg.startsWith('WARNING: ')) {
            const span = document.createElement('span');
            span.className = 'text-amber-500 mr-2';
            span.textContent = 'WARN';
            div.appendChild(span);
            div.appendChild(document.createTextNode(msg.substring(9)));
            div.className += ' bg-amber-500/5 px-2 rounded';
          } else if (msg.startsWith('ERROR: ')) {
            const span = document.createElement('span');
            span.className = 'text-red-500 mr-2';
            span.textContent = 'ERR ';
            div.appendChild(span);
            div.appendChild(document.createTextNode(msg.substring(7)));
            div.className += ' bg-red-500/5 px-2 rounded';
          } else {
            div.className += ' text-neutral-400';
            div.textContent = msg;
          }
        }
        ingestionLogs.appendChild(div);
        const consoleEl = container.querySelector('#ingestion-console');
        if (consoleEl) consoleEl.scrollTop = consoleEl.scrollHeight;
      }
    };

    // Check for massive files (> 1GB) to activate chucking warning
    const largeFiles = filteredFiles.filter(f => f.size > 1_000_000_000);
    if (largeFiles.length > 0) {
      addLog(`🚀 Massive file(s) detected (>1GB). "is_chucking" mode activated. Ingestion will be distributed across multiple CPU cores via chunking.`, false, true);
    }

    let completed = 0;
    let failed = 0;

    for (const file of filteredFiles) {
      if (queueStatus) queueStatus.textContent = `Processing file ${completed + failed + 1} of ${filteredFiles.length}`;
      if (consoleFilename) consoleFilename.textContent = file.name;
      
      addLog(`Starting ingestion for ${file.name}...`, true);

      try {
        const result = await api.streamUpload(file, (msg) => addLog(msg), context);
        if (result.is_duplicate) {
          addLog(`Notice: Duplicate file detected. Skipping new ingestion, using existing record.`, false);
        }
        addLog(`Success: ${file.name} ingested successfully.`, false);
        completed++;
      } catch (err: any) {
        addLog(`Error processing ${file.name}: ${err.message || err}`, false);
        failed++;
      }
    }

    // Final state
    if (ingestionStatus) ingestionStatus.textContent = 'Ingestion Complete';
    if (queueStatus) queueStatus.textContent = `${completed} Success, ${failed} Failed`;
    if (consoleFilename) consoleFilename.textContent = 'Summary';
    
    addLog(`--- Ingestion Summary ---`, true);
    addLog(`Total files discovered: ${filteredFiles.length}`);
    addLog(`Successfully processed: ${completed}`);
    if (failed > 0) addLog(`Failed: ${failed}`);

    setTimeout(() => {
      isIngesting = false;
      hideAddModal();
      refreshFiles();
    }, 2000);
  }

  // --- General Table Logic ---
  const refreshFiles = async () => {
    const updatedSources = await api.listFiles();
    store.setDataSources(updatedSources);
    // Note: In this pure vanilla setup, the store update triggers a re-render 
    // of the app via the subscription in main.ts.
  };

  container.querySelectorAll('.btn-inspect').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tableName = btn.getAttribute('data-table');
      const filename = btn.getAttribute('data-filename');
      if (tableName) showPreview(tableName, filename || tableName);
    });
  });

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fileId = btn.getAttribute('data-id');
      if (fileId && confirm('Delete this data?')) {
        await api.deleteFile(fileId);
        refreshFiles();
      }
    });
  });

  // Preview Logic
  const previewModal = container.querySelector('#preview-modal') as HTMLElement;
  const modalContent = container.querySelector('#modal-content') as HTMLElement;
  const modalTitle = container.querySelector('#modal-title') as HTMLElement;
  const closePreviewModal = container.querySelector('#close-preview-modal');

  async function showPreview(tableName: string, filename: string) {
    modalTitle.textContent = filename;
    previewModal.classList.remove('hidden');
    setTimeout(() => {
      previewModal.classList.remove('opacity-0');
      previewModal.querySelector('div')?.classList.remove('translate-y-4');
    }, 10);

    try {
      const data = await api.getPreview(tableName);
      if (data.length === 0) {
        modalContent.innerHTML = '<div class="text-center py-20 italic">No data found.</div>';
        return;
      }
      const headers = Object.keys(data[0]);
      modalContent.innerHTML = `
        <div class="overflow-x-auto rounded-xl border border-outline/5">
          <table class="w-full text-left border-collapse bg-surface-container-lowest">
            <thead>
              <tr class="bg-surface-container-highest">
                ${headers.map(h => `<th class="px-4 py-3 text-[10px] uppercase tracking-widest text-neutral-400 border-b border-outline/10">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr class="border-b border-outline/5 hover:bg-white/[0.02]">
                  ${headers.map(h => `<td class="px-4 py-3 text-sm text-neutral-300 font-mono whitespace-nowrap">${row[h]}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      modalContent.innerHTML = `<div class="text-center text-red-400 py-20">Load failed.</div>`;
    }
  }

  const hidePreviewModal = () => {
    previewModal.classList.add('opacity-0');
    previewModal.querySelector('div')?.classList.add('translate-y-4');
    setTimeout(() => previewModal.classList.add('hidden'), 300);
  };
  closePreviewModal?.addEventListener('click', hidePreviewModal);

  // Description Editing
  container.querySelectorAll('.desc-container').forEach(descContainer => {
    const textSpan = descContainer.querySelector('.desc-text') as HTMLSpanElement;
    const inputEl = descContainer.querySelector('.desc-input') as HTMLInputElement;
    const editBtn = descContainer.querySelector('.btn-edit-desc') as HTMLButtonElement;
    const generateBtn = descContainer.querySelector('.btn-generate-desc') as HTMLButtonElement;
    const fileId = descContainer.getAttribute('data-id');

    const startEditing = () => {
      textSpan.classList.add('hidden');
      editBtn.closest('div')?.classList.add('hidden');
      inputEl.classList.remove('hidden');
      inputEl.focus();
    };

    const stopEditing = async (save: boolean) => {
      if (inputEl.classList.contains('hidden')) return;
      inputEl.classList.add('hidden');
      textSpan.classList.remove('hidden');
      editBtn.closest('div')?.classList.remove('hidden');
      if (save && fileId) {
        const newDesc = inputEl.value.trim();
        if (newDesc !== textSpan.getAttribute('data-desc')) {
          await api.updateFileDescription(fileId, newDesc);
          refreshFiles();
        }
      }
    };

    generateBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!fileId) return;
      generateBtn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">sync</span>';
      try {
        await api.generateFileDescription(fileId);
        refreshFiles();
      } catch (err) {
        alert('Generation failed.');
        generateBtn.innerHTML = 'auto_awesome';
      }
    });

    textSpan.addEventListener('click', startEditing);
    editBtn.addEventListener('click', startEditing);
    inputEl.addEventListener('blur', () => stopEditing(true));
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') stopEditing(true);
      else if (e.key === 'Escape') stopEditing(false);
    });
  });

  // PII Tag Dismissal
  container.querySelectorAll('.btn-dismiss-pii').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const badge = btn.closest('.pii-badge') as HTMLElement;
      const fileId = badge.getAttribute('data-id');
      if (fileId && confirm('Mark this as false positive? The PII tag will be removed.')) {
        try {
          await api.togglePIITag(fileId, false);
          refreshFiles();
        } catch (err) {
          alert('Failed to update PII status.');
        }
      }
    });
  });
}
