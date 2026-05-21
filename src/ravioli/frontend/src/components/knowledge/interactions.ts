import { api } from '../../services/api';
import { store } from '../../store';
import { escapeHTML, sanitizeImageUrl, getCoverUrl, getIconDisplay, getBlocksPreview, textToBlocks } from './utils';

export function renderKnowledgeEditor(id?: string) {
  const existing = id ? store.getKnowledgePages().find(p => p.id === id) : null;
  const allPages = store.getKnowledgePages().filter(p => p.id !== id);

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-500';

  const coverUrl = getCoverUrl(existing?.cover);
  const safeCoverUrl = sanitizeImageUrl(coverUrl);
  const coverHtml = safeCoverUrl 
      ? `<img src="${escapeHTML(safeCoverUrl)}" class="w-full h-full object-cover">` 
      : '<div class="w-full h-full bg-gradient-to-br from-primary/10 to-tertiary/5"></div>';

  modal.innerHTML = `
        <div class="glass-panel w-full max-w-4xl rounded-[3.5rem] border-primary/20 overflow-hidden relative animate-in zoom-in slide-in-from-bottom-12 duration-700 ease-out shadow-[0_0_100px_rgba(var(--primary-rgb),0.1)] flex flex-col max-h-[90vh]">
             <!-- Page Aesthetics Section -->
             <div class="h-48 w-full relative bg-surface-container-high overflow-hidden" id="editor-cover-preview">
                ${coverHtml}
                <div class="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent"></div>
                <div class="absolute top-8 right-8 flex gap-3">
                    <button id="close-modal" class="w-12 h-12 rounded-2xl bg-surface/40 backdrop-blur-md flex items-center justify-center hover:bg-error/20 hover:text-error transition-all duration-300 group">
                        <span class="material-symbols-outlined text-white group-hover:text-error transition-colors">close</span>
                    </button>
                </div>
                <div class="absolute bottom-0 left-12 transform translate-y-1/2">
                   <div class="relative group">
                    <input type="text" id="icon-input" name="icon_emoji" value="${escapeHTML(getIconDisplay(existing?.icon))}" 
                        class="w-20 h-20 rounded-3xl bg-surface-container-highest border-2 border-primary/20 text-4xl flex items-center justify-center text-center outline-none focus:border-primary transition-all shadow-2xl cursor-pointer">
                    <div class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span class="material-symbols-outlined text-white text-sm">emoji_emotions</span>
                    </div>
                   </div>
                </div>
             </div>

             <div class="p-12 pt-16 overflow-y-auto custom-scrollbar flex-1">
                <form id="knowledge-form" class="space-y-10">
                    <!-- Section 1: Page Properties -->
                    <div class="space-y-8">
                        <div class="grid grid-cols-12 gap-8">
                            <div class="col-span-8 space-y-3">
                                <label class="text-[10px] uppercase tracking-[0.3em] text-primary font-bold ml-2">Page Title</label>
                                <input type="text" name="title" value="${escapeHTML(existing?.title || '')}" placeholder="Untitled" 
                                    class="w-full bg-transparent border-none text-5xl font-headline-lg text-white placeholder:text-outline/20 focus:ring-0 transition-all outline-none p-0" required>
                            </div>
                            <div class="col-span-4 space-y-3">
                                <label class="text-[10px] uppercase tracking-[0.3em] text-primary font-bold ml-2">Access Type</label>
                                <div class="flex gap-2 p-1.5 bg-surface-container-high border border-outline-variant/20 rounded-2xl w-full">
                                    <button type="button" data-value="individual" class="ownership-toggle flex-1 py-3 rounded-xl transition-all font-headline-sm ${(!existing || existing.ownership_type === 'individual') ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-outline/50 hover:text-white'}">Individual</button>
                                    <button type="button" data-value="team" class="ownership-toggle flex-1 py-3 rounded-xl transition-all font-headline-sm ${existing?.ownership_type === 'team' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-outline/50 hover:text-white'}">Team</button>
                                    <input type="hidden" name="ownership_type" value="${escapeHTML(existing?.ownership_type || 'individual')}">
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-8">
                            <div class="space-y-3">
                                <label class="text-[10px] uppercase tracking-[0.3em] text-outline font-bold ml-2">Cover URL</label>
                                <input type="text" id="cover-input" name="cover_url" value="${escapeHTML(coverUrl)}" placeholder="https://..." 
                                    class="w-full bg-surface-container-high border border-outline-variant/20 rounded-2xl px-6 py-4 text-white placeholder:text-outline/30 focus:border-primary/50 transition-all outline-none">
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] uppercase tracking-[0.3em] text-outline font-bold ml-2">Parent Page</label>
                                <select name="parent_id" class="w-full bg-surface-container-high border border-outline-variant/20 rounded-2xl px-6 py-4 text-white appearance-none outline-none focus:border-primary/50 transition-all">
                                    <option value="">No Parent</option>
                                    ${allPages.map(p => `<option value="${p.id}" ${existing?.parent_id === p.id ? 'selected' : ''}>${escapeHTML(p.title)}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Section 2: Page Content (Blocks) -->
                    <div class="space-y-3 pt-6 border-t border-outline-variant/10">
                        <label class="text-[10px] uppercase tracking-[0.3em] text-primary font-bold ml-2">Page Content (Blocks Preview)</label>
                        <textarea name="raw_content" rows="12" placeholder="Start typing page content here... This will be codified into blocks." 
                            class="w-full bg-transparent border-none text-xl leading-relaxed text-on-surface-variant placeholder:text-outline/20 focus:ring-0 transition-all outline-none resize-none min-h-[300px]" required>${escapeHTML(getBlocksPreview(existing?.content))}</textarea>
                    </div>

                    <div class="flex gap-4 pt-8 sticky bottom-0 bg-surface/80 backdrop-blur-md pb-4">
                        <button type="submit" class="flex-1 bg-primary text-on-primary py-5 rounded-3xl font-headline-md hover:brightness-110 hover:scale-[1.01] transition-all shadow-2xl shadow-primary/20 active:scale-[0.99] flex items-center justify-center gap-3">
                            <span class="material-symbols-outlined">${id ? 'auto_fix' : 'add_task'}</span>
                            ${id ? 'Update Intelligence' : 'Establish Page'}
                        </button>
                        ${id ? `
                            <button type="button" id="delete-btn" class="px-8 bg-error/10 text-error rounded-3xl hover:bg-error hover:text-white transition-all duration-300">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                        ` : ''}
                    </div>
                </form>
             </div>
        </div>
    `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#knowledge-form') as HTMLFormElement;
  const closeBtn = modal.querySelector('#close-modal');
  const deleteBtn = modal.querySelector('#delete-btn');
  const toggles = modal.querySelectorAll('.ownership-toggle');
  const hiddenOwnershipInput = modal.querySelector('input[name="ownership_type"]') as HTMLInputElement;
  const coverInput = modal.querySelector('#cover-input') as HTMLInputElement;
  const coverPreview = modal.querySelector('#editor-cover-preview');

  // Live Cover Update
  coverInput.addEventListener('input', () => {
    const val = coverInput.value;
    const safeUrl = sanitizeImageUrl(val);
    const img = coverPreview!.querySelector('img');
    if (safeUrl) {
      if (img) img.src = safeUrl;
      else {
        const newImg = document.createElement('img');
        newImg.src = safeUrl;
        newImg.className = 'w-full h-full object-cover';
        coverPreview!.prepend(newImg);
        coverPreview!.querySelector('.bg-gradient-to-br')?.remove();
      }
    }
  });

  toggles.forEach(t => {
    t.addEventListener('click', () => {
      const val = t.getAttribute('data-value')!;
      hiddenOwnershipInput.value = val;
      toggles.forEach(btn => {
        if (btn === t) {
          btn.classList.add('bg-primary', 'text-on-primary', 'shadow-lg', 'shadow-primary/20');
          btn.classList.remove('text-outline/50');
        } else {
          btn.classList.remove('bg-primary', 'text-on-primary', 'shadow-lg', 'shadow-primary/20');
          btn.classList.add('text-outline/50');
        }
      });
    });
  });

  const closeModal = () => {
    modal.classList.add('animate-out', 'fade-out');
    modal.firstElementChild?.classList.add('animate-out', 'zoom-out', 'slide-out-to-bottom-12');
    setTimeout(() => modal.remove(), 500);
  };

  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  deleteBtn?.addEventListener('click', async () => {
    if (id && confirm('Delete this intelligence page?')) {
      await api.deleteKnowledgePage(id);
      const pages = await api.listKnowledgePages();
      store.setKnowledgePages(pages);
      closeModal();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;

    const formData = new FormData(form);
    const title = formData.get('title') as string;
    const rawContent = formData.get('raw_content') as string;
    const coverUrl = formData.get('cover_url') as string;
    const iconEmoji = formData.get('icon_emoji') as string;
    const ownership = formData.get('ownership_type') as 'individual' | 'team';
    const parentId = (formData.get('parent_id') as string) || undefined;

    const data: any = {
      title,
      ownership_type: ownership,
      parent_id: parentId,
      properties: {
        title: [{ type: 'text', text: { content: title } }],
        ownership: { select: { name: ownership } }
      },
      content: textToBlocks(rawContent),
      icon: { type: 'emoji', emoji: iconEmoji || '📄' },
      cover: coverUrl ? { type: 'external', external: { url: coverUrl } } : null
    };

    try {
      if (id) {
        await api.updateKnowledgePage(id, data);
      } else {
        await api.createKnowledgePage(data);
      }
      const pages = await api.listKnowledgePages();
      store.setKnowledgePages(pages);
      closeModal();
    } catch (err) {
      console.error('Failed to save', err);
      submitBtn.disabled = false;
      alert('Sync failed.');
    }
  });
}
