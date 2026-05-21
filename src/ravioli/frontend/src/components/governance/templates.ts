import { formatDistanceToNow } from 'date-fns';
import type { Insight } from '../../types';

export function insightReviewCard(insight: Insight) {
  const ago = formatDistanceToNow(new Date(insight.created_at), { addSuffix: true });
  const source = insight.source_label ?? 'Unknown analysis';

  return `
    <div class="review-item flex items-start gap-6 p-6 rounded-3xl glass-card border-white/5 hover:border-tertiary/30 transition-all duration-500 group insight-card-hover" data-insight-id="${insight.id}">
      <div class="w-2.5 h-2.5 rounded-full bg-tertiary mt-2.5 shrink-0 animate-pulse shadow-[0_0_12px_rgba(var(--tertiary-rgb),0.5)]"></div>
      <div class="flex-1 min-w-0 space-y-3">
        <p class="text-base font-body-md text-on-surface leading-relaxed group-hover:text-white transition-colors duration-300">${insight.content}</p>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5 opacity-40">
            <span class="material-symbols-outlined text-sm" data-icon="analytics">analytics</span>
            <span class="text-[10px] uppercase tracking-[0.2em] font-bold">${source}</span>
          </div>
          <span class="text-[10px] text-outline opacity-20">|</span>
          <div class="flex items-center gap-1.5 opacity-40">
            <span class="material-symbols-outlined text-sm" data-icon="schedule">schedule</span>
            <span class="text-[10px] uppercase tracking-[0.2em] font-bold">${ago}</span>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
        <button class="btn-verify-insight flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary text-on-primary shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-[11px] uppercase tracking-[0.2em] font-bold" data-id="${insight.id}">
          <span class="material-symbols-outlined text-sm" data-icon="check">check</span>
          Verify
        </button>
        <button class="btn-reject-insight flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-surface-container-high text-outline hover:text-error hover:bg-error/10 border border-white/5 transition-all text-[11px] uppercase tracking-[0.2em] font-bold" data-id="${insight.id}">
          <span class="material-symbols-outlined text-sm" data-icon="close">close</span>
          Reject
        </button>
      </div>
    </div>`;
}

