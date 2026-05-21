import { formatDistanceToNow, format } from 'date-fns';
import type { Insight, LineageNode } from '../../types';

export function banCard(value: number | string, label: string, icon: string, accent = 'text-primary') {
  return `
    <div class="glass-card px-6 py-5 rounded-2xl flex items-center gap-5 group cursor-default">
      <div class="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
        <span class="material-symbols-outlined ${accent} text-2xl shrink-0" data-icon="${icon}">${icon}</span>
      </div>
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-[10px] uppercase tracking-[0.3em] text-outline font-label-sm opacity-50 truncate">${label}</span>
        <span class="font-display-lg text-3xl text-on-surface tracking-tighter tabular-nums leading-none">${value}</span>
      </div>
    </div>`;
}

export function insightPill(insight: Insight) {
  const ago = formatDistanceToNow(new Date(insight.created_at), { addSuffix: true });
  const dateStr = format(new Date(insight.created_at), 'MMM d');
  const source = insight.source_label ?? 'Unknown analysis';

  const ownerName = insight.owner_user?.name || insight.owner_group?.name || 'Admin';
  const ownerTypeLabel = insight.owner_group ? 'Team' : 'User';
  const creatorName = insight.creator_user?.name || 'Admin';
  const reviewerName = insight.reviewer_user?.name;

  return `
    <div class="flex items-start gap-5 py-6 border-b border-white/5 last:border-0 group insight-card-hover rounded-xl px-4 -mx-4 transition-all duration-500">
      <div class="flex flex-col items-center gap-1 shrink-0 w-12 text-center">
        <span class="text-xl font-display-lg text-primary tabular-nums group-hover:scale-110 transition-transform duration-500">${dateStr.split(' ')[1]}</span>
        <span class="text-[9px] uppercase tracking-[0.2em] text-outline opacity-40 font-bold">${dateStr.split(' ')[0]}</span>
      </div>
      <div class="flex-1 min-w-0 space-y-3">
        <p class="text-sm font-body-md text-on-surface-variant leading-relaxed group-hover:text-white transition-colors duration-500">${insight.content}</p>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <div class="flex flex-wrap items-center gap-y-2 gap-x-4">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-xs opacity-50 group-hover:opacity-100 transition-opacity" data-icon="verified">verified</span>
              <span class="text-[10px] uppercase tracking-[0.2em] text-outline font-label-sm opacity-30 group-hover:opacity-60 transition-opacity">${source}</span>
            </div>
            <span class="text-[10px] text-outline opacity-20 hidden sm:inline">·</span>
            
            <!-- Owner & Creator metadata stack -->
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1.5" title="Owner (${ownerTypeLabel})">
                <span class="material-symbols-outlined text-[12px] text-primary opacity-40">shield</span>
                <span class="text-[9px] uppercase tracking-[0.1em] text-outline opacity-40 font-bold">${ownerName}</span>
              </div>
              <div class="flex items-center gap-1.5" title="Creator">
                <span class="material-symbols-outlined text-[12px] text-secondary opacity-40">person</span>
                <span class="text-[9px] uppercase tracking-[0.1em] text-outline opacity-40 font-bold">${creatorName}</span>
              </div>
              ${reviewerName ? `
                <div class="flex items-center gap-1.5" title="Approved by Reviewer">
                  <span class="material-symbols-outlined text-[12px] text-green-400 opacity-60">fact_check</span>
                  <span class="text-[9px] uppercase tracking-[0.1em] text-green-400 font-bold">Approved by: ${reviewerName}</span>
                </div>
              ` : ''}
            </div>
            
            <span class="text-[10px] text-outline opacity-20 hidden sm:inline">·</span>
            <span class="text-[10px] uppercase tracking-[0.2em] text-outline font-label-sm opacity-30 group-hover:opacity-60 transition-opacity">${ago}</span>
          </div>

          <!-- Trace Lineage Action Button -->
          <button class="btn-trace-lineage shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/20 text-[9px] text-outline hover:text-primary font-bold uppercase tracking-[0.15em] rounded-full transition-all duration-300 shadow-sm" data-insight-id="${insight.id}">
            <span class="material-symbols-outlined text-[11px]" data-icon="schema">schema</span>
            <span>Trace Lineage</span>
          </button>
        </div>
      </div>
    </div>`;
}

export function renderNodeElement(parent: HTMLElement, node: LineageNode, x: number, y: number, animDelay: number) {
  let icon = 'description';
  let accentClass = 'text-sky-400';
  if (node.type === 'analysis') {
    icon = 'analytics';
    accentClass = 'text-purple-400';
  } else if (node.type === 'insight') {
    icon = 'auto_awesome';
    accentClass = 'text-rose-400';
  } else if (node.type === 'knowledge') {
    icon = 'article';
    accentClass = 'text-emerald-400';
  }

  const nodeEl = document.createElement('div');
  nodeEl.className = 'lineage-node glass-card p-4 rounded-2xl border border-white/5 hover:border-white/20 hover:scale-[1.02] cursor-pointer transition-all duration-300 absolute group flex flex-col gap-2 opacity-0 animate-reveal';
  nodeEl.style.left = `${x}px`;
  nodeEl.style.top = `${y}px`;
  nodeEl.style.width = `220px`;
  nodeEl.style.zIndex = '10';
  nodeEl.style.animationDelay = `${animDelay}s`;
  
  nodeEl.setAttribute('data-node-id', node.id);
  nodeEl.setAttribute('data-node-type', node.type);

  nodeEl.innerHTML = `
    <div class="flex items-center justify-between pointer-events-none">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[13px] ${accentClass}" data-icon="${icon}">${icon}</span>
        <span class="text-[8px] uppercase tracking-[0.2em] font-bold text-outline opacity-40">${node.type}</span>
      </div>
      ${node.metadata?.is_verified ? `<span class="material-symbols-outlined text-[11px] text-primary" data-icon="verified">verified</span>` : ''}
    </div>
    <p class="text-[11px] text-on-surface leading-snug font-medium line-clamp-2 pr-1 pointer-events-none group-hover:text-white transition-colors duration-300">${node.label}</p>
  `;

  parent.appendChild(nodeEl);
}

export function renderExpandButton(parent: HTMLElement, x: number, y: number, type: 'upstream' | 'downstream', count: number, onClick: () => void) {
  const btn = document.createElement('div');
  btn.className = 'lineage-node expand-node glass-card px-4 py-3.5 rounded-full border border-primary/20 hover:bg-primary/10 hover:border-primary/40 text-center cursor-pointer transition-all duration-300 flex items-center justify-center gap-1.5';
  btn.style.position = 'absolute';
  btn.style.left = `${x}px`;
  btn.style.top = `${y}px`;
  btn.style.width = `220px`;
  btn.style.zIndex = '15';

  btn.innerHTML = `
    <span class="material-symbols-outlined text-[12px] text-primary" data-icon="add">add</span>
    <span class="text-[9px] uppercase tracking-[0.2em] font-bold text-primary">Expand (${count} more)</span>
  `;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });

  parent.appendChild(btn);
}
