import { store } from '../store';
import { format } from 'date-fns';
import { escapeHTML, sanitizeImageUrl, getCoverUrl, getIconDisplay, getBlocksPreview } from './knowledge/utils';
import { renderKnowledgeEditor } from './knowledge/interactions';

export function renderKnowledge() {
  const container = document.createElement('main');
  container.className = 'flex-1 ml-64 h-full overflow-y-auto bg-surface relative p-12 custom-scrollbar';

  const pages = store.getKnowledgePages();

  // Header
  const header = `
    <div class="flex items-end justify-between mb-12 relative z-10">
      <div class="space-y-2">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
          <span class="text-[10px] uppercase tracking-[0.3em] text-primary font-medium">Intelligence Core</span>
        </div>
        <h1 class="text-5xl font-headline-lg text-white tracking-tight">Knowledge Base</h1>
        <p class="text-on-surface-variant font-body-lg max-w-2xl">
          Codified domain intelligence structured as Page Properties and Page Content (Blocks) for maximum analytical alignment.
        </p>
      </div>
      <button id="add-knowledge-btn" class="px-8 py-4 rounded-2xl bg-primary text-on-primary font-headline-sm hover:brightness-110 hover:scale-[1.02] transition-all flex items-center gap-3 shadow-2xl shadow-primary/20 active:scale-[0.98]">
        <span class="material-symbols-outlined">add_circle</span>
        Codify New Page
      </button>
    </div>
  `;

  // List
  const listContent = pages.length === 0 ? `
    <div class="h-[60vh] flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/20 rounded-[4rem] text-outline/50 relative z-10 group hover:border-primary/20 transition-colors duration-500">
      <div class="w-24 h-24 rounded-[2rem] bg-surface-container-high flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
        <span class="material-symbols-outlined text-5xl">auto_stories</span>
      </div>
      <h3 class="text-xl text-white/50 font-headline-sm mb-2">No intelligence codified yet</h3>
      <p class="text-sm uppercase tracking-widest opacity-50">Establish your first Page</p>
    </div>
  ` : `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10 pb-20">
      ${pages.map((page, index) => {
        const coverUrl = getCoverUrl(page.cover);
        const safeCoverUrl = sanitizeImageUrl(coverUrl);
        const coverStyle = safeCoverUrl
          ? `background-image: url('${escapeHTML(safeCoverUrl)}'); background-size: cover; background-position: center;`
          : `background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.1) 0%, rgba(var(--tertiary-rgb), 0.05) 100%);`;

        const parentIndicator = page.parent_id ? `
                   <span class="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary backdrop-blur-md" title="Nested Page">
                    <span class="material-symbols-outlined text-[14px]">account_tree</span>
                   </span>
                ` : '';

        return `
          <div class="glass-panel rounded-[2.5rem] border-primary/5 hover:border-primary/20 transition-all duration-500 group cursor-pointer flex flex-col hover:shadow-2xl hover:shadow-primary/5 animate-reveal overflow-hidden" style="animation-delay: ${index * 0.05}s" data-id="${escapeHTML(page.id)}">
            <!-- Cover -->
            <div class="h-32 w-full relative" style="${coverStyle}">
              <div class="absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent"></div>
              <div class="absolute top-4 right-4 flex gap-2">
                <span class="px-3 py-1 rounded-full bg-surface/40 backdrop-blur-md text-[9px] font-bold uppercase tracking-widest text-white border border-white/10">
                  ${escapeHTML(page.ownership_type)}
                </span>
                ${parentIndicator}
              </div>
            </div>

            <!-- Content Area -->
            <div class="p-8 pt-0 -mt-6 relative z-10 flex-1 flex flex-col">
              <!-- Icon -->
              <div class="w-14 h-14 rounded-2xl bg-surface-container-high border border-outline-variant/20 text-3xl flex items-center justify-center mb-4 shadow-xl group-hover:scale-110 transition-transform duration-500">
                ${escapeHTML(getIconDisplay(page.icon))}
              </div>

              <h3 class="text-2xl font-headline-md text-white mb-3 group-hover:text-primary transition-colors duration-300">${escapeHTML(page.title)}</h3>
              <p class="text-on-surface-variant line-clamp-3 text-sm leading-relaxed mb-6 flex-1 group-hover:text-on-surface transition-colors">
                ${escapeHTML(getBlocksPreview(page.content))}
              </p>
              
              <!-- Owner, Creator, Reviewer row -->
              <div class="flex flex-col gap-2 mb-6 pt-4 border-t border-outline-variant/5">
                <div class="flex flex-wrap gap-x-4 gap-y-1.5 items-center text-[10px] uppercase tracking-[0.1em] text-neutral-400">
                  <span class="flex items-center gap-1" title="Owner (${escapeHTML(page.ownership_type)})">
                    <span class="material-symbols-outlined text-[12px] text-primary">shield</span>
                    <span class="font-bold">${escapeHTML(page.owner_user?.name || page.owner_group?.name || 'Admin')}</span>
                  </span>
                  <span class="flex items-center gap-1" title="Creator">
                    <span class="material-symbols-outlined text-[12px] text-secondary">person</span>
                    <span class="font-bold">${escapeHTML(page.creator_user?.name || 'Admin')}</span>
                  </span>
                  ${page.reviewer_user?.name ? `
                    <span class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-bold border border-green-500/20" title="Approved by Reviewer">
                      <span class="material-symbols-outlined text-[10px]">fact_check</span>
                      <span>Approved: ${escapeHTML(page.reviewer_user.name)}</span>
                    </span>
                  ` : ''}
                </div>
              </div>
              
              <div class="flex items-center justify-between mt-auto pt-6 border-t border-outline-variant/10 text-[10px] text-outline uppercase tracking-[0.2em] font-medium">
                <span class="flex items-center gap-2">
                  <span class="w-1 h-1 rounded-full bg-outline/30"></span>
                  ${format(new Date(page.updated_at), 'MMM d, yyyy')}
                </span>
                <div class="flex gap-4">
                  <button class="edit-page text-primary hover:text-white transition-colors flex items-center gap-1" data-id="${escapeHTML(page.id)}">
                    <span class="material-symbols-outlined text-sm">edit_note</span>
                    Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;

  container.innerHTML = `
    <div class="cinematic-vignette fixed inset-0 z-0 pointer-events-none opacity-50"></div>
    <div class="relative z-10 max-w-7xl mx-auto">
      ${header}
      ${listContent}
    </div>
  `;

  // Event Listeners
  container.querySelector('#add-knowledge-btn')?.addEventListener('click', () => {
    renderKnowledgeEditor();
  });

  container.querySelectorAll('.glass-panel').forEach(card => {
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const id = card.getAttribute('data-id');
      if (id) renderKnowledgeEditor(id);
    });
  });

  container.querySelectorAll('.edit-page').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) renderKnowledgeEditor(id);
    });
  });

  return container;
}
