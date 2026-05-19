import { api } from '../services/api';
import { formatDistanceToNow, format } from 'date-fns';
import type { Insight, InsightStats, InsightsSummary, LineageResponse, LineageNode, LineageEdge } from '../types';

const DAY_OPTIONS = [1, 3, 7, 14, 28, 30];

// Module-level state so re-renders within the same session preserve selections
let activeDays = 7;
let activeView: 'feed' | 'lineage' = 'feed';
let summaryCache: Map<number, InsightsSummary> = new Map();
let currentLineageData: LineageResponse | null = null;
let resizeObserver: ResizeObserver | null = null;
let selectedNodeId: string | null = null;

// Focused Subgraph Lineage State
let focusedInsightId: string | null = null;
let maxUpstreamCount = 5;
let maxDownstreamCount = 5;

export const clearInsightsCache = () => {
  summaryCache.clear();
  currentLineageData = null;
  selectedNodeId = null;
  focusedInsightId = null;
  maxUpstreamCount = 5;
  maxDownstreamCount = 5;
};

function banCard(value: number | string, label: string, icon: string, accent = 'text-primary') {
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

function insightPill(insight: Insight) {
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

export function renderInsights() {
  const container = document.createElement('main');
  container.className = 'flex-1 ml-64 overflow-y-auto bg-background h-screen flex flex-col custom-scrollbar';

  container.innerHTML = `
    <!-- Page Header -->
    <header class="px-12 pt-12 pb-4 shrink-0 animate-reveal flex flex-col gap-6">
      <div class="flex items-start justify-between">
        <div class="space-y-2">
          <p class="text-[10px] uppercase tracking-[0.3em] text-primary-fixed-dim opacity-60 font-label-sm">Studio Noir</p>
          <h1 class="font-display-lg text-4xl text-on-surface tracking-tight">Insights</h1>
          <p class="text-sm text-on-surface-variant font-body-md opacity-60">Distilled intelligence and lineage tracking from your warehouse.</p>
        </div>
        
        <!-- View Toggle Switcher -->
        <div class="inline-flex p-1 bg-surface-container-low/50 backdrop-blur-md rounded-full border border-white/5" id="view-selector">
          <button class="view-btn px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-500 ${activeView === 'feed' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-outline hover:text-white hover:bg-white/5'}" data-view="feed">
            Feed & Summary
          </button>
          <button class="view-btn px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-500 ${activeView === 'lineage' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-outline hover:text-white hover:bg-white/5'}" data-view="lineage">
            Lineage Map
          </button>
        </div>
      </div>
      <div class="h-px bg-gradient-to-r from-primary/20 via-outline-variant/20 to-transparent"></div>
    </header>

    <div class="flex-1 px-12 pb-16 relative">
      
      <!-- VIEW 1: Chronological Feed & AI Summary -->
      <div id="feed-view" class="${activeView === 'feed' ? 'space-y-16' : 'hidden'} animate-reveal">
        <!-- BANs -->
        <section id="bans-section">
          <div class="grid grid-cols-3 gap-4">
            <div class="rounded-2xl animate-pulse bg-surface-container-low h-16"></div>
            <div class="rounded-2xl animate-pulse bg-surface-container-low h-16"></div>
            <div class="rounded-2xl animate-pulse bg-surface-container-low h-16"></div>
          </div>
        </section>

        <!-- Hero: AI Summary -->
        <section id="hero-section" class="relative">
          <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-5">
              <div class="w-14 h-14 rounded-[1.25rem] bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5 animate-float">
                <span class="material-symbols-outlined text-primary text-3xl glow-primary" data-icon="auto_awesome">auto_awesome</span>
              </div>
              <div>
                <h2 class="text-2xl font-headline-sm text-on-surface uppercase tracking-[0.2em] font-medium">Intelligence Brief</h2>
                <div class="flex items-center gap-2 mt-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  <p class="text-[10px] uppercase tracking-[0.3em] text-primary-fixed-dim opacity-40 font-bold">Synthesized Analytics</p>
                </div>
              </div>
            </div>
            <!-- Day selector -->
            <div class="flex items-center gap-1 p-1.5 bg-surface-container-low/50 backdrop-blur-md rounded-full border border-white/5" id="day-selector">
              ${DAY_OPTIONS.map(d => `
                <button class="day-btn px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-500 ${d === activeDays ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-outline hover:text-white hover:bg-white/5'}" data-days="${d}">${d}d</button>
              `).join('')}
            </div>
          </div>
          
          <div id="hero-content" class="glass-card p-12 rounded-[2.5rem] relative overflow-hidden group">
            <div class="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none group-hover:bg-primary/10 transition-colors duration-1000"></div>
            <div class="absolute -bottom-16 -left-16 w-64 h-64 bg-tertiary/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-tertiary/10 transition-colors duration-1000"></div>
            <div class="absolute inset-0 bg-noise opacity-[0.02] pointer-events-none"></div>
            
            <div id="hero-text" class="relative z-10 min-h-[160px] flex flex-col justify-center">
              <div class="flex flex-col items-center gap-4 py-8 opacity-40">
                <span class="material-symbols-outlined text-4xl animate-spin" data-icon="progress_activity">progress_activity</span>
                <span class="text-xs uppercase tracking-[0.3em] font-bold">Initializing intelligence core…</span>
              </div>
            </div>
          </div>
        </section>

        <!-- News Feed -->
        <section class="max-w-4xl mx-auto">
          <div class="flex items-center gap-3 mb-8">
            <div class="w-10 h-10 rounded-[1rem] bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
              <span class="material-symbols-outlined text-primary text-2xl" data-icon="newspaper">newspaper</span>
            </div>
            <div>
              <h2 class="text-xl font-headline-sm text-on-surface uppercase tracking-[0.2em] font-medium">Intelligence Feed</h2>
              <p class="text-[10px] uppercase tracking-[0.3em] text-outline opacity-30 font-bold mt-0.5">Chronicle of verified signals</p>
            </div>
          </div>
          <div id="news-feed" class="space-y-0 min-h-[200px]">
            <div class="h-20 border-b border-white/5 animate-pulse bg-surface-container-low/20 rounded mb-2"></div>
            <div class="h-20 border-b border-white/5 animate-pulse bg-surface-container-low/20 rounded mb-2"></div>
            <div class="h-20 border-b border-white/5 animate-pulse bg-surface-container-low/20 rounded"></div>
          </div>
        </section>
      </div>

      <!-- VIEW 2: Pedigree Lineage DAG Graph (Airflow Style) -->
      <div id="lineage-view" class="${activeView === 'lineage' ? 'flex flex-col' : 'hidden'} h-full min-h-[600px] relative animate-reveal">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-[1rem] bg-secondary/10 flex items-center justify-center border border-secondary/20 shadow-lg shadow-secondary/5">
              <span class="material-symbols-outlined text-secondary text-2xl" data-icon="schema">schema</span>
            </div>
            <div>
              <h2 class="text-xl font-headline-sm text-on-surface uppercase tracking-[0.2em] font-medium">Lineage Map</h2>
              <p class="text-[10px] uppercase tracking-[0.3em] text-outline opacity-30 font-bold mt-0.5">GENEALOGY AND PROPAGATION OF INSIGHT SIGNALS (DAG)</p>
            </div>
          </div>
          <div class="flex items-center gap-3" id="lineage-header-controls">
            <!-- Dynamic button will be placed here -->
            <button class="px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-[10px] font-bold uppercase tracking-[0.15em] rounded-full transition-all duration-300 flex items-center gap-2" id="refresh-lineage">
              <span class="material-symbols-outlined text-xs animate-spin-hover" data-icon="refresh">refresh</span> Refresh Map
            </button>
          </div>
        </div>

        <!-- Scrollable and Pannable Unified DAG Canvas -->
        <div class="relative w-full h-[650px] overflow-auto glass-card rounded-[2.5rem] border border-white/5 bg-[#080809] dag-canvas custom-scrollbar" id="lineage-graph-container" style="scrollbar-color: rgba(255,255,255,0.1) transparent;">
          
          <!-- Floating Category Header Labels at the top of the canvas -->
          <div class="absolute top-6 left-0 w-full h-8 pointer-events-none flex z-20" id="dag-headers" style="width: 1240px;">
            <div style="position: absolute; left: 60px; width: 220px;" class="text-center">
              <span class="text-[9px] uppercase tracking-[0.3em] text-outline opacity-40 font-bold px-3 py-1.5 bg-[#101012] border border-white/5 rounded-full">Data Sources</span>
            </div>
            <div style="position: absolute; left: 360px; width: 220px;" class="text-center">
              <span class="text-[9px] uppercase tracking-[0.3em] text-outline opacity-40 font-bold px-3 py-1.5 bg-[#101012] border border-white/5 rounded-full">Analyses</span>
            </div>
            <div style="position: absolute; left: 660px; width: 220px;" class="text-center">
              <span class="text-[9px] uppercase tracking-[0.3em] text-outline opacity-40 font-bold px-3 py-1.5 bg-[#101012] border border-white/5 rounded-full">Insights</span>
            </div>
            <div style="position: absolute; left: 960px; width: 220px;" class="text-center">
              <span class="text-[9px] uppercase tracking-[0.3em] text-outline opacity-40 font-bold px-3 py-1.5 bg-[#101012] border border-white/5 rounded-full">Knowledge Pages</span>
            </div>
          </div>

          <!-- SVG connectors overlay (stretching across complete scroll dimensions) -->
          <svg class="absolute inset-0 pointer-events-none" id="lineage-connectors" style="z-index: 1; min-width: 1240px; min-height: 650px;"></svg>

          <!-- Absolutely positioned nodes container -->
          <div class="absolute inset-0" id="dag-nodes-container" style="z-index: 10; min-width: 1240px; min-height: 650px;"></div>
        </div>

        <!-- Node Details Drawer overlay card (floating fixed above scroll viewport bottom-right) -->
        <div id="node-details-panel" class="absolute bottom-6 right-6 w-[26rem] p-8 rounded-[2rem] glass-card border-white/10 shadow-2xl translate-y-12 opacity-0 pointer-events-none transition-all duration-500 z-30 flex flex-col gap-4">
          <div class="flex items-start justify-between">
            <span class="node-tag text-[9px] uppercase tracking-[0.25em] font-bold px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary">Node</span>
            <button class="text-outline hover:text-white p-1 hover:bg-white/5 rounded-full transition-all" id="close-details-btn">
              <span class="material-symbols-outlined text-base">close</span>
            </button>
          </div>
          <h4 class="node-title text-lg font-semibold text-white tracking-tight leading-snug">Node Title</h4>
          <div class="node-meta-grid grid grid-cols-2 gap-4 border-y border-white/5 py-4 my-1">
            <!-- Grid items injected -->
          </div>
          <p class="node-desc text-xs text-on-surface-variant font-body-md leading-relaxed">Select any node in the pedigree lanes to reveal structural dependencies and propagation logs.</p>
          <div class="node-actions flex items-center justify-end gap-3 mt-1">
            <!-- Action buttons -->
          </div>
        </div>
      </div>

    </div>
  `;

  hydrate(container);
  return container;
}

async function hydrate(container: HTMLElement) {
  // Setup view switcher
  container.querySelectorAll('#view-selector button').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view') as 'feed' | 'lineage';
      if (view === activeView) return;
      activeView = view;

      // Update switcher UI
      container.querySelectorAll('#view-selector button').forEach(b => {
        b.classList.toggle('bg-primary', b === btn);
        b.classList.toggle('text-on-primary', b === btn);
        b.classList.toggle('shadow-lg', b === btn);
        b.classList.toggle('shadow-primary/20', b === btn);
        b.classList.toggle('text-outline', b !== btn);
        b.classList.toggle('hover:bg-white/5', b !== btn);
      });

      // Switch views
      const feedView = container.querySelector('#feed-view');
      const lineageView = container.querySelector('#lineage-view');
      if (view === 'feed') {
        feedView?.classList.remove('hidden');
        feedView?.classList.add('space-y-16');
        lineageView?.classList.add('hidden');
      } else {
        feedView?.classList.add('hidden');
        feedView?.classList.remove('space-y-16');
        lineageView?.classList.remove('hidden');
        hydrateLineage(container);
      }
    });
  });

  // Hydrate standard feed in parallel
  await Promise.all([
    hydrateBans(container),
    hydrateSummary(container, activeDays),
    hydrateFeed(container),
  ]);

  // Day selector interaction
  container.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const days = parseInt(btn.getAttribute('data-days') || '7');
      activeDays = days;
      container.querySelectorAll('.day-btn').forEach(b => {
        b.classList.toggle('bg-primary', b === btn);
        b.classList.toggle('text-on-primary', b === btn);
        b.classList.toggle('text-outline', b !== btn);
      });
      await hydrateSummary(container, days);
    });
  });

  // Hook up refresh map button
  container.querySelector('#refresh-lineage')?.addEventListener('click', () => {
    hydrateLineage(container, true);
  });
}

async function hydrateBans(container: HTMLElement) {
  const section = container.querySelector('#bans-section');
  if (!section) return;
  try {
    const stats = await api.getInsightStats();
    section.innerHTML = `
      <div class="grid grid-cols-3 gap-6">
        <div class="opacity-0 animate-reveal stagger-1">${banCard(stats.verified_count, 'Verified Insights', 'verified', 'text-primary')}</div>
        <div class="opacity-0 animate-reveal stagger-2">${banCard(stats.analyses_count, 'Total Analyses', 'analytics', 'text-secondary')}</div>
        <div class="opacity-0 animate-reveal stagger-3">${banCard(stats.contributors_count, 'Insight Contributors', 'group', 'text-tertiary')}</div>
      </div>`;
  } catch {
    section.innerHTML = `<p class="text-sm text-outline opacity-50">Failed to load stats.</p>`;
  }
}

async function hydrateSummary(container: HTMLElement, days: number) {
  const heroText = container.querySelector('#hero-text');
  if (!heroText) return;

  heroText.innerHTML = `
    <div class="flex items-center gap-3 opacity-40">
      <span class="material-symbols-outlined animate-spin" data-icon="progress_activity">progress_activity</span>
      <span class="text-sm uppercase tracking-widest font-label-sm">Synthesizing ${days}d intelligence…</span>
    </div>`;

  try {
    let data = summaryCache.get(days);
    if (!data) {
      data = await api.getInsightsSummary(days);
      summaryCache.set(days, data);
    }
    const allBullets = data.summary
      .split('\n')
      .map(l => l.replace(/^[\s\-*•]+/, '').trim())
      .filter(l => l.length > 10);

    const isExpandable = allBullets.length > 4;
    const bullets = isExpandable ? allBullets.slice(0, 4) : allBullets;
    const hiddenBullets = isExpandable ? allBullets.slice(4) : [];

    const renderBullet = (b: string, index: number) => `
      <li class="flex items-start gap-5 group/item opacity-0 animate-reveal" style="animation-delay: ${index * 0.1}s">
        <div class="mt-[0.65em] shrink-0 w-2 h-2 rounded-full bg-primary/40 group-hover/item:bg-primary group-hover/item:scale-125 transition-all duration-300 shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]"></div>
        <span class="text-lg font-body-lg text-on-surface-variant leading-relaxed group-hover/item:text-on-surface transition-colors duration-300">${b}</span>
      </li>`;

    const isActuallyEmpty = bullets.length === 0 && data.summary.toLowerCase().includes('no verified insights');

    const bulletHtml = !isActuallyEmpty
      ? (bullets.length > 0 ? bullets.map((b, i) => renderBullet(b, i)).join('') : `<li class="text-on-surface-variant opacity-60 font-body-md text-sm">${data.summary}</li>`)
      : `<div class="flex flex-col items-center gap-6 py-8 animate-reveal">
          <div class="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center border border-white/5">
            <span class="material-symbols-outlined text-outline opacity-20 text-4xl" data-icon="history">history</span>
          </div>
          <div class="text-center space-y-2 max-w-sm">
            <p class="text-on-surface-variant font-body-md text-lg leading-relaxed">No verified signals found in the last ${days} days.</p>
            ${data.total_verified_count > 0 ? `<p class="text-xs text-outline opacity-40 uppercase tracking-widest font-bold">Try selecting a longer period to see all ${data.total_verified_count} verified insights.</p>` : ''}
          </div>
        </div>`;

    const countNote = data.insight_count > 0
      ? `<div class="pt-8 border-t border-white/5 flex items-center justify-between mt-10">
          <div class="flex items-center gap-3 opacity-30">
            <span class="material-symbols-outlined text-base" data-icon="data_exploration">data_exploration</span>
            <span class="text-[10px] uppercase tracking-[0.3em] font-bold">${data.insight_count} verified signal${data.insight_count !== 1 ? 's' : ''} ingested</span>
          </div>
          <button id="btn-copy-brief" class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-[10px] uppercase tracking-[0.2em] text-outline hover:text-primary transition-all font-bold group/copy">
            <span class="material-symbols-outlined text-sm group-hover/copy:scale-110 transition-transform" data-icon="content_copy">content_copy</span>
            <span>Copy Brief</span>
          </button>
        </div>`
      : '';

    heroText.innerHTML = `
      <ul id="hero-bullets" class="space-y-6 list-none">${bulletHtml}</ul>
      ${isExpandable ? `
        <div id="hidden-bullets" class="hidden space-y-6 mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
          ${hiddenBullets.map(renderBullet).join('')}
        </div>
        <button id="btn-toggle-hero" class="mt-10 flex items-center gap-2.5 text-[10px] uppercase tracking-[0.25em] text-primary hover:text-primary-fixed transition-all font-bold group">
          <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <span class="material-symbols-outlined text-xs group-hover:translate-y-0.5 transition-transform" data-icon="expand_more">expand_more</span>
          </div>
          <span>Explore Full Intelligence</span>
        </button>
      ` : ''}
      ${countNote}`;

    // Handle Copy
    heroText.querySelector('#btn-copy-brief')?.addEventListener('click', () => {
      navigator.clipboard.writeText(allBullets.join('\n'));
      const btn = heroText.querySelector('#btn-copy-brief');
      if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-outlined text-sm text-primary" data-icon="done">done</span><span class="text-primary">Copied!</span>`;
        setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
      }
    });

    if (isExpandable) {
      const toggleBtn = heroText.querySelector('#btn-toggle-hero');
      const hiddenEl = heroText.querySelector('#hidden-bullets');
      toggleBtn?.addEventListener('click', () => {
        const isHidden = hiddenEl?.classList.contains('hidden');
        hiddenEl?.classList.toggle('hidden');
        if (toggleBtn) {
          toggleBtn.innerHTML = isHidden 
            ? `<span class="material-symbols-outlined text-sm group-hover:-translate-y-0.5 transition-transform" data-icon="expand_less">expand_less</span><span>Collapse Brief</span>`
            : `<span class="material-symbols-outlined text-sm group-hover:translate-y-0.5 transition-transform" data-icon="expand_more">expand_more</span><span>Expand Brief</span>`;
        }
      });
    }
  } catch {
    heroText.innerHTML = `<p class="text-sm text-outline opacity-50">Summary unavailable.</p>`;
  }
}

async function hydrateFeed(container: HTMLElement) {
  const feedEl = container.querySelector('#news-feed');
  if (!feedEl) return;
  try {
    const feed = await api.getInsightsFeed(activeDays <= 7 ? 30 : activeDays);
    feedEl.innerHTML = feed.length === 0
      ? `<div class="glass-card flex flex-col items-center gap-4 py-16 text-center rounded-[2rem] border-dashed border-white/5 group animate-reveal">
          <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-700">
            <span class="material-symbols-outlined text-4xl text-outline opacity-20" data-icon="newspaper">newspaper</span>
          </div>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-[0.3em] font-bold text-on-surface opacity-40">No Activity</p>
            <p class="text-[10px] uppercase tracking-[0.1em] text-outline opacity-20 font-medium">Verified signals will appear here</p>
          </div>
        </div>`
      : feed.map((i, index) => `<div class="opacity-0 animate-reveal" style="animation-delay: ${index * 0.05}s">${insightPill(i)}</div>`).join('');

    // Wire up chronological feed 'Trace Lineage' button clicks
    container.querySelectorAll('.btn-trace-lineage').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const insightId = btn.getAttribute('data-insight-id');
        if (!insightId) return;

        // Switch to Focused Lineage Mode for this Insight!
        focusedInsightId = insightId.startsWith('insight-') ? insightId : `insight-${insightId}`;
        maxUpstreamCount = 5;
        maxDownstreamCount = 5;

        // Switch to Lineage Map view
        const lineageTabBtn = container.querySelector('[data-view="lineage"]') as HTMLElement;
        if (lineageTabBtn) {
          lineageTabBtn.click();
        }
      });
    });

  } catch {
    feedEl.innerHTML = `<p class="text-sm text-outline opacity-50">Failed to load feed.</p>`;
  }
}

/* =========================================================================
   GENEALOGY AND PEDIGREE LINEAGE DAG GRAPH LOGIC (VIEW 2)
   ========================================================================= */

function renderNodeElement(parent: HTMLElement, node: LineageNode, x: number, y: number, animDelay: number) {
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

function renderExpandButton(parent: HTMLElement, x: number, y: number, type: 'upstream' | 'downstream', count: number, onClick: () => void) {
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

async function hydrateLineage(container: HTMLElement, forceRefresh = false) {
  const graphContainer = container.querySelector('#lineage-graph-container');
  if (!graphContainer) return;

  const nodesContainer = graphContainer.querySelector('#dag-nodes-container') as HTMLElement;
  const svg = graphContainer.querySelector('#lineage-connectors') as SVGElement;
  const headers = graphContainer.querySelector('#dag-headers') as HTMLElement;

  if (!nodesContainer || !svg) return;

  // 1. Show loading indicator
  nodesContainer.innerHTML = `
    <div class="absolute inset-0 flex items-center justify-center gap-3 opacity-40">
      <span class="material-symbols-outlined animate-spin text-primary text-3xl" data-icon="progress_activity">progress_activity</span>
      <span class="text-xs uppercase tracking-[0.3em] font-bold">Assembling intelligence DAG…</span>
    </div>
  `;
  svg.innerHTML = '';

  try {
    // 2. Fetch lineage map
    if (!currentLineageData || forceRefresh) {
      currentLineageData = await api.getInsightsLineage();
    }
    const data = currentLineageData;
    nodesContainer.innerHTML = '';

    if (data.nodes.length === 0) {
      nodesContainer.innerHTML = `
        <div class="absolute inset-0 flex items-center justify-center gap-3 opacity-30">
          <span class="text-xs uppercase tracking-[0.3em] font-bold">No lineage records found</span>
        </div>
      `;
      return;
    }

    if (focusedInsightId) {
      // FOCUSED LINEAGE SUBGRAPH MODE
      const centralNode = data.nodes.find(n => n.id === focusedInsightId);
      if (!centralNode) {
        focusedInsightId = null;
        hydrateLineage(container, forceRefresh);
        return;
      }

      // Find direct upstream (top 5) and downstream (top 5)
      const directUpstreamNodes: LineageNode[] = [];
      const directDownstreamNodes: LineageNode[] = [];

      data.edges.forEach(edge => {
        if (edge.target === focusedInsightId) {
          const srcNode = data.nodes.find(n => n.id === edge.source);
          if (srcNode && !directUpstreamNodes.some(n => n.id === srcNode.id)) {
            directUpstreamNodes.push(srcNode);
          }
        }
        if (edge.source === focusedInsightId) {
          const tgtNode = data.nodes.find(n => n.id === edge.target);
          if (tgtNode && !directDownstreamNodes.some(n => n.id === tgtNode.id)) {
            directDownstreamNodes.push(tgtNode);
          }
        }
      });

      const totalUpstreamsCount = directUpstreamNodes.length;
      const totalDownstreamsCount = directDownstreamNodes.length;

      const visibleUpstreams = directUpstreamNodes.slice(0, maxUpstreamCount);
      const visibleDownstreams = directDownstreamNodes.slice(0, maxDownstreamCount);

      const hasMoreUpstreams = totalUpstreamsCount > maxUpstreamCount;
      const hasMoreDownstreams = totalDownstreamsCount > maxDownstreamCount;

      const col1Count = visibleUpstreams.length + (hasMoreUpstreams ? 1 : 0);
      const col2Count = 1;
      const col3Count = visibleDownstreams.length + (hasMoreDownstreams ? 1 : 0);

      const maxInLayer = Math.max(col1Count, col2Count, col3Count);
      const vSpace = 120;
      const canvasHeight = Math.max(650, maxInLayer * vSpace + 140);
      const canvasWidth = 1240;
      const centerY = canvasHeight / 2;

      // Apply dynamic layout bounds
      svg.style.minWidth = `${canvasWidth}px`;
      svg.style.minHeight = `${canvasHeight}px`;
      svg.style.width = `${canvasWidth}px`;
      svg.style.height = `${canvasHeight}px`;

      nodesContainer.style.minWidth = `${canvasWidth}px`;
      nodesContainer.style.minHeight = `${canvasHeight}px`;
      nodesContainer.style.width = `${canvasWidth}px`;
      nodesContainer.style.height = `${canvasHeight}px`;

      if (headers) {
        headers.style.width = `${canvasWidth}px`;
        headers.innerHTML = `
          <div style="position: absolute; left: 100px; width: 220px;" class="text-center">
            <span class="text-[9px] uppercase tracking-[0.3em] text-outline opacity-40 font-bold px-3 py-1.5 bg-[#101012] border border-white/5 rounded-full">Direct Upstream</span>
          </div>
          <div style="position: absolute; left: 520px; width: 220px;" class="text-center">
            <span class="text-[9px] uppercase tracking-[0.3em] text-primary font-bold px-4 py-1.5 bg-[#101012] border border-primary/20 rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.1)]">Target Insight</span>
          </div>
          <div style="position: absolute; left: 940px; width: 220px;" class="text-center">
            <span class="text-[9px] uppercase tracking-[0.3em] text-outline opacity-40 font-bold px-3 py-1.5 bg-[#101012] border border-white/5 rounded-full">Direct Downstream</span>
          </div>
        `;
      }

      // Dynamically display "Show Full Map" button
      const headerControls = container.querySelector('#lineage-header-controls');
      if (headerControls) {
        let fullMapBtn = headerControls.querySelector('#btn-show-full-map');
        if (!fullMapBtn) {
          fullMapBtn = document.createElement('button');
          fullMapBtn.id = 'btn-show-full-map';
          fullMapBtn.className = 'px-5 py-2.5 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-[10px] font-bold uppercase tracking-[0.15em] rounded-full text-primary transition-all duration-300 flex items-center gap-2';
          fullMapBtn.innerHTML = `<span class="material-symbols-outlined text-xs" data-icon="grid_view">grid_view</span> Show Full Map`;
          headerControls.insertBefore(fullMapBtn, headerControls.firstChild);
          fullMapBtn.addEventListener('click', () => {
            focusedInsightId = null;
            fullMapBtn?.remove();
            hydrateLineage(container);
          });
        }
      }

      // Draw Column 1: Upstream nodes
      const x1 = 100;
      const col1Height = (col1Count - 1) * vSpace;
      const col1YStart = centerY - (col1Height / 2);

      visibleUpstreams.forEach((node, idx) => {
        const nodeY = col1YStart + idx * vSpace - 36;
        renderNodeElement(nodesContainer, node, x1, nodeY, idx * 0.03);
      });

      if (hasMoreUpstreams) {
        const nodeY = col1YStart + visibleUpstreams.length * vSpace - 36;
        renderExpandButton(nodesContainer, x1, nodeY, 'upstream', totalUpstreamsCount - maxUpstreamCount, () => {
          maxUpstreamCount = 999;
          hydrateLineage(container);
        });
      }

      // Draw Column 2: Central target node
      const x2 = 520;
      const nodeY = centerY - 36;
      renderNodeElement(nodesContainer, centralNode, x2, nodeY, 0.05);

      // Draw Column 3: Downstream nodes
      const x3 = 940;
      const col3Height = (col3Count - 1) * vSpace;
      const col3YStart = centerY - (col3Height / 2);

      visibleDownstreams.forEach((node, idx) => {
        const nodeY = col3YStart + idx * vSpace - 36;
        renderNodeElement(nodesContainer, node, x3, nodeY, idx * 0.03);
      });

      if (hasMoreDownstreams) {
        const nodeY = col3YStart + visibleDownstreams.length * vSpace - 36;
        renderExpandButton(nodesContainer, x3, nodeY, 'downstream', totalDownstreamsCount - maxDownstreamCount, () => {
          maxDownstreamCount = 999;
          hydrateLineage(container);
        });
      }

      // Filter visible edges
      const visibleNodes = [
        centralNode,
        ...visibleUpstreams,
        ...visibleDownstreams
      ];
      
      const filteredEdges = data.edges.filter(e => {
        return visibleNodes.some(n => n.id === e.source) && visibleNodes.some(n => n.id === e.target);
      });

      setTimeout(() => {
        drawLineageConnectorsForList(container, filteredEdges);
        setupLineageInteractions(container, data);
        
        // Auto-select central node and scroll pan to center
        selectAndHighlightInsightNode(container, focusedInsightId);
      }, 80);

    } else {
      // FULL MAP OVERVIEW (Original logic)
      const layerNodes = {
        datasource: data.nodes.filter(n => n.type === 'datasource'),
        analysis: data.nodes.filter(n => n.type === 'analysis'),
        insight: data.nodes.filter(n => n.type === 'insight'),
        knowledge: data.nodes.filter(n => n.type === 'knowledge'),
      };

      const maxInLayer = Math.max(
        layerNodes.datasource.length,
        layerNodes.analysis.length,
        layerNodes.insight.length,
        layerNodes.knowledge.length
      );

      const vSpace = 120;
      const canvasHeight = Math.max(650, maxInLayer * vSpace + 140);
      const canvasWidth = 1240;
      const centerY = canvasHeight / 2;

      // Apply dynamic bounds
      svg.style.minWidth = `${canvasWidth}px`;
      svg.style.minHeight = `${canvasHeight}px`;
      svg.style.width = `${canvasWidth}px`;
      svg.style.height = `${canvasHeight}px`;

      nodesContainer.style.minWidth = `${canvasWidth}px`;
      nodesContainer.style.minHeight = `${canvasHeight}px`;
      nodesContainer.style.width = `${canvasWidth}px`;
      nodesContainer.style.height = `${canvasHeight}px`;

      if (headers) {
        headers.style.width = `${canvasWidth}px`;
        headers.innerHTML = `
          <div style="position: absolute; left: 60px; width: 220px;" class="text-center">
            <span class="text-[9px] uppercase tracking-[0.3em] text-outline opacity-40 font-bold px-3 py-1.5 bg-[#101012] border border-white/5 rounded-full">Data Sources</span>
          </div>
          <div style="position: absolute; left: 360px; width: 220px;" class="text-center">
            <span class="text-[9px] uppercase tracking-[0.3em] text-outline opacity-40 font-bold px-3 py-1.5 bg-[#101012] border border-white/5 rounded-full">Analyses</span>
          </div>
          <div style="position: absolute; left: 660px; width: 220px;" class="text-center">
            <span class="text-[9px] uppercase tracking-[0.3em] text-outline opacity-40 font-bold px-3 py-1.5 bg-[#101012] border border-white/5 rounded-full">Insights</span>
          </div>
          <div style="position: absolute; left: 960px; width: 220px;" class="text-center">
            <span class="text-[9px] uppercase tracking-[0.3em] text-outline opacity-40 font-bold px-3 py-1.5 bg-[#101012] border border-white/5 rounded-full">Knowledge Pages</span>
          </div>
        `;
      }

      // Remove "Show Full Map" button if exists
      container.querySelector('#btn-show-full-map')?.remove();

      // Placement coordinates
      const layerKeys: ('datasource' | 'analysis' | 'insight' | 'knowledge')[] = ['datasource', 'analysis', 'insight', 'knowledge'];
      const startX = 60;
      const layerSpacing = 300;

      layerKeys.forEach((key, lIdx) => {
        const list = layerNodes[key];
        const K = list.length;
        if (K === 0) return;

        const x = startX + lIdx * layerSpacing;
        const totalHeight = (K - 1) * vSpace;
        const yStart = centerY - (totalHeight / 2);

        list.forEach((node, idx) => {
          const nodeY = yStart + idx * vSpace - 36;
          renderNodeElement(nodesContainer, node, x, nodeY, (lIdx * 3 + idx) * 0.03);
        });
      });

      setTimeout(() => {
        drawLineageConnectorsForList(container, data.edges);
        setupLineageInteractions(container, data);
        
        // If a node was pre-selected, apply highlights
        if (selectedNodeId) {
          applyLineageHighlights(container, selectedNodeId);
        }
      }, 80);
    }

  } catch (err) {
    console.error('Failed to load lineage graph:', err);
    nodesContainer.innerHTML = `<p class="absolute inset-0 flex items-center justify-center text-xs text-outline opacity-40">Error loading DAG</p>`;
  }
}

function drawLineageConnectorsForList(container: HTMLElement, edges: LineageEdge[], retryCount = 0) {
  const svg = container.querySelector('#lineage-connectors') as SVGElement;
  const graphContainer = container.querySelector('#lineage-graph-container');
  if (!svg || !graphContainer) return;

  svg.innerHTML = '';

  let hasZeroOffset = false;

  edges.forEach(edge => {
    const sourceEl = graphContainer.querySelector(`[data-node-id="${edge.source}"]`) as HTMLElement;
    const targetEl = graphContainer.querySelector(`[data-node-id="${edge.target}"]`) as HTMLElement;

    if (!sourceEl || !targetEl) return;

    // Direct positions relative to scrollable relative parent container
    const x1 = sourceEl.offsetLeft + sourceEl.offsetWidth;
    const y1 = sourceEl.offsetTop + sourceEl.offsetHeight / 2;

    const x2 = targetEl.offsetLeft;
    const y2 = targetEl.offsetTop + targetEl.offsetHeight / 2;

    if (x1 === 0 && x2 === 0) {
      hasZeroOffset = true;
    }

    // Cubic Bezier curve control path
    const dx = (x2 - x1) * 0.45;
    const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('class', 'lineage-path fill-none transition-all duration-300');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('data-source-id', edge.source);
    path.setAttribute('data-target-id', edge.target);

    svg.appendChild(path);
  });

  // Defensive Retry: If offsets are zero (due to layout lag), retry in 100ms
  if (hasZeroOffset && retryCount < 3) {
    setTimeout(() => {
      drawLineageConnectorsForList(container, edges, retryCount + 1);
    }, 100);
  }
}

function applyLineageHighlights(container: HTMLElement, targetId: string | null) {
  const graphContainer = container.querySelector('#lineage-graph-container');
  if (!graphContainer) return;

  const nodes = graphContainer.querySelectorAll('.lineage-node');
  const paths = graphContainer.querySelectorAll('.lineage-path');

  if (!targetId) {
    // Reset to default quiet state: all nodes normal, all paths extremely faint
    nodes.forEach(n => {
      n.classList.remove('lineage-dimmed', 'lineage-active', 'border-primary', 'shadow-primary/20');
    });
    paths.forEach(p => {
      p.classList.remove('lineage-dimmed', 'lineage-active');
    });
    return;
  }

  // 1. Recursive Ancestors and Descendants trace helper
  const activeNodes = new Set<string>([targetId]);
  const activePaths: SVGElement[] = [];

  // Helper: trace parents (backward)
  function traceUp(nodeId: string) {
    paths.forEach((p: any) => {
      const source = p.getAttribute('data-source-id');
      const target = p.getAttribute('data-target-id');
      if (target === nodeId && !activeNodes.has(source)) {
        activeNodes.add(source);
        activePaths.push(p);
        traceUp(source);
      }
    });
  }

  // Helper: trace children (forward)
  function traceDown(nodeId: string) {
    paths.forEach((p: any) => {
      const source = p.getAttribute('data-source-id');
      const target = p.getAttribute('data-target-id');
      if (source === nodeId && !activeNodes.has(target)) {
        activeNodes.add(target);
        activePaths.push(p);
        traceDown(target);
      }
    });
  }

  traceUp(targetId);
  traceDown(targetId);

  // 2. Dim/Highlight components
  nodes.forEach(n => {
    const id = n.getAttribute('data-node-id');
    if (id === targetId) {
      n.classList.remove('lineage-dimmed');
      n.classList.add('lineage-active', 'border-primary', 'shadow-primary/20');
    } else if (id && activeNodes.has(id)) {
      n.classList.remove('lineage-dimmed');
      n.classList.add('lineage-active');
    } else {
      n.classList.add('lineage-dimmed');
      n.classList.remove('lineage-active');
    }
  });

  paths.forEach(p => {
    if (activePaths.includes(p as SVGElement)) {
      p.classList.remove('lineage-dimmed');
      p.classList.add('lineage-active');
    } else {
      p.classList.add('lineage-dimmed');
      p.classList.remove('lineage-active');
    }
  });
}

function selectAndHighlightInsightNode(container: HTMLElement, nodeId: string) {
  selectedNodeId = nodeId;

  const graphContainer = container.querySelector('#lineage-graph-container') as HTMLElement;
  if (!graphContainer) return;

  const nodeEl = graphContainer.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
  if (!nodeEl) return;

  // 1. Smoothly scroll to center the selected node in the canvas viewport
  const containerWidth = graphContainer.clientWidth;
  const containerHeight = graphContainer.clientHeight;
  const nodeLeft = nodeEl.offsetLeft;
  const nodeTop = nodeEl.offsetTop;
  const nodeWidth = nodeEl.offsetWidth;
  const nodeHeight = nodeEl.offsetHeight;

  const targetScrollLeft = nodeLeft - (containerWidth / 2) + (nodeWidth / 2);
  const targetScrollTop = nodeTop - (containerHeight / 2) + (nodeHeight / 2);

  graphContainer.scrollTo({
    left: Math.max(0, targetScrollLeft),
    top: Math.max(0, targetScrollTop),
    behavior: 'smooth'
  });

  // 2. Apply neon high-visibility highlights
  applyLineageHighlights(container, nodeId);

  // 3. Open details drawer
  if (currentLineageData) {
    const nodeData = currentLineageData.nodes.find(n => n.id === nodeId);
    if (nodeData) {
      openNodeDetailsDrawer(container, nodeData);
    }
  }
}

function setupLineageInteractions(container: HTMLElement, data: LineageResponse) {
  const nodes = container.querySelectorAll('.lineage-node:not(.expand-node)');
  const detailsPanel = container.querySelector('#node-details-panel') as HTMLElement;
  const graphContainer = container.querySelector('#lineage-graph-container') as HTMLElement;

  if (!detailsPanel || !graphContainer) return;

  // Drag & Drop + Hover Highlight implementation
  nodes.forEach(node => {
    const nodeEl = node as HTMLElement;
    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let nodeLeft = 0;
    let nodeTop = 0;

    // Mouse handlers
    const onMouseDown = (e: MouseEvent) => {
      // Avoid text highlight conflicts
      e.preventDefault();
      
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      nodeLeft = nodeEl.offsetLeft;
      nodeTop = nodeEl.offsetTop;

      nodeEl.style.cursor = 'grabbing';
      nodeEl.classList.add('shadow-2xl', 'scale-[1.03]');
      nodeEl.style.zIndex = '50';

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      // Calculate absolute offset in relative viewport canvas
      const newLeft = nodeLeft + dx;
      const newTop = nodeTop + dy;

      nodeEl.style.left = `${newLeft}px`;
      nodeEl.style.top = `${newTop}px`;

      // Live update Bezier curves at 60fps
      if (focusedInsightId) {
        const visibleNodes = Array.from(container.querySelectorAll('.lineage-node:not(.expand-node)')).map(el => el.getAttribute('data-node-id'));
        const filteredEdges = data.edges.filter(e => visibleNodes.includes(e.source) && visibleNodes.includes(e.target));
        drawLineageConnectorsForList(container, filteredEdges);
      } else {
        drawLineageConnectorsForList(container, data.edges);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;

      nodeEl.style.cursor = 'pointer';
      nodeEl.classList.remove('shadow-2xl', 'scale-[1.03]');
      nodeEl.style.zIndex = '10';

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      // If dragging has not occurred, interpret it as a selection click
      if (!hasMoved) {
        const nodeId = nodeEl.getAttribute('data-node-id');
        if (nodeId) {
          selectedNodeId = nodeId;
          applyLineageHighlights(container, nodeId);
          const nodeData = data.nodes.find(n => n.id === nodeId);
          if (nodeData) {
            openNodeDetailsDrawer(container, nodeData);
          }
        }
      }
    };

    // Touch handlers for hybrid tablets
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      
      isDragging = true;
      hasMoved = false;
      startX = touch.clientX;
      startY = touch.clientY;
      nodeLeft = nodeEl.offsetLeft;
      nodeTop = nodeEl.offsetTop;

      nodeEl.classList.add('shadow-2xl', 'scale-[1.03]');
      nodeEl.style.zIndex = '50';

      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      e.preventDefault(); // suppress viewport scroll bounce
      
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      const newLeft = nodeLeft + dx;
      const newTop = nodeTop + dy;

      nodeEl.style.left = `${newLeft}px`;
      nodeEl.style.top = `${newTop}px`;

      if (focusedInsightId) {
        const visibleNodes = Array.from(container.querySelectorAll('.lineage-node:not(.expand-node)')).map(el => el.getAttribute('data-node-id'));
        const filteredEdges = data.edges.filter(e => visibleNodes.includes(e.source) && visibleNodes.includes(e.target));
        drawLineageConnectorsForList(container, filteredEdges);
      } else {
        drawLineageConnectorsForList(container, data.edges);
      }
    };

    const onTouchEnd = () => {
      if (!isDragging) return;
      isDragging = false;

      nodeEl.classList.remove('shadow-2xl', 'scale-[1.03]');
      nodeEl.style.zIndex = '10';

      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      if (!hasMoved) {
        const nodeId = nodeEl.getAttribute('data-node-id');
        if (nodeId) {
          selectedNodeId = nodeId;
          applyLineageHighlights(container, nodeId);
          const nodeData = data.nodes.find(n => n.id === nodeId);
          if (nodeData) {
            openNodeDetailsDrawer(container, nodeData);
          }
        }
      }
    };

    // Attach drag/drop listeners
    nodeEl.addEventListener('mousedown', onMouseDown);
    nodeEl.addEventListener('touchstart', onTouchStart, { passive: true });

    // Double click to focus and explore node recursively
    nodeEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const nodeId = nodeEl.getAttribute('data-node-id');
      if (nodeId) {
        focusedInsightId = nodeId;
        maxUpstreamCount = 5;
        maxDownstreamCount = 5;
        hydrateLineage(container);
      }
    });

    // Hover Highlight Traces
    nodeEl.addEventListener('mouseenter', () => {
      const nodeId = nodeEl.getAttribute('data-node-id');
      if (nodeId) applyLineageHighlights(container, nodeId);
    });

    nodeEl.addEventListener('mouseleave', () => {
      // Restore selected highlights or standard quiet state
      applyLineageHighlights(container, selectedNodeId);
    });
  });

  // Drawer dismiss triggers
  container.querySelector('#close-details-btn')?.addEventListener('click', () => {
    selectedNodeId = null;
    applyLineageHighlights(container, null);
    closeNodeDetailsDrawer();
  });
  
  container.querySelector('#lineage-graph-container')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'lineage-graph-container' || target.id === 'dag-nodes-container') {
      selectedNodeId = null;
      applyLineageHighlights(container, null);
      closeNodeDetailsDrawer();
    }
  });
}

function openNodeDetailsDrawer(container: HTMLElement, node: LineageNode) {
  const panel = container.querySelector('#node-details-panel') as HTMLElement;
  if (!panel) return;

  const tag = panel.querySelector('.node-tag') as HTMLElement;
  const title = panel.querySelector('.node-title') as HTMLElement;
  const grid = panel.querySelector('.node-meta-grid') as HTMLElement;
  const desc = panel.querySelector('.node-desc') as HTMLElement;
  const actions = panel.querySelector('.node-actions') as HTMLElement;

  // Clean class & background styles
  tag.className = 'node-tag text-[9px] uppercase tracking-[0.25em] font-bold px-3.5 py-1.5 rounded-full border';
  tag.textContent = node.type;

  title.textContent = node.label;
  grid.innerHTML = '';
  actions.innerHTML = '';

  const meta = node.metadata || {};

  if (node.type === 'datasource') {
    tag.classList.add('bg-sky-500/10', 'border-sky-500/20', 'text-sky-400');
    title.textContent = meta.filename || node.label;

    grid.innerHTML = `
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wider text-outline opacity-40 font-bold">Row Count</span>
        <span class="text-sm font-semibold text-white">${meta.row_count?.toLocaleString() || 'N/A'}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wider text-outline opacity-40 font-bold">PII Tagging</span>
        <span class="text-sm font-semibold ${meta.has_pii ? 'text-primary' : 'text-emerald-400'}">${meta.has_pii ? 'Has PII' : 'Clear'}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wider text-outline opacity-40 font-bold">Size</span>
        <span class="text-sm font-semibold text-white">${meta.size_bytes ? (meta.size_bytes / 1024).toFixed(1) + ' KB' : 'N/A'}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wider text-outline opacity-40 font-bold">Content Type</span>
        <span class="text-sm font-semibold text-white truncate">${meta.content_type || 'N/A'}</span>
      </div>
    `;
    desc.textContent = `This raw source file has been loaded and sync-structured in the warehouse's OLAP storage container.`;
    
    actions.innerHTML = `
      <button class="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-bold uppercase tracking-[0.15em] text-white transition-all duration-300" id="drawer-view-file">
        View Dataset
      </button>
    `;
    actions.querySelector('#drawer-view-file')?.addEventListener('click', () => {
      window.location.hash = '#data';
    });

  } else if (node.type === 'analysis') {
    tag.classList.add('bg-purple-500/10', 'border-purple-500/20', 'text-purple-400');
    title.textContent = node.label;

    grid.innerHTML = `
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wider text-outline opacity-40 font-bold">Status</span>
        <span class="text-sm font-semibold text-emerald-400 capitalize">${meta.status || 'N/A'}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wider text-outline opacity-40 font-bold">Processed</span>
        <span class="text-xs font-semibold text-white truncate">${meta.created_at ? format(new Date(meta.created_at), 'MMM d, h:mm a') : 'N/A'}</span>
      </div>
    `;
    desc.textContent = meta.description || `Executed analytics notebook which parsed raw dimensions, calculated statistics, and yielded distilled insights.`;

    actions.innerHTML = `
      <button class="px-5 py-2.5 rounded-full bg-purple-500/15 border border-purple-500/30 hover:brightness-110 text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300 transition-all duration-300" id="drawer-view-analysis">
        Open Notebook
      </button>
    `;
    actions.querySelector('#drawer-view-analysis')?.addEventListener('click', () => {
      window.location.hash = '#analyses';
    });

  } else if (node.type === 'insight') {
    tag.classList.add('bg-rose-500/10', 'border-rose-500/20', 'text-rose-400');
    title.textContent = meta.content || node.label;

    grid.innerHTML = `
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wider text-outline opacity-40 font-bold">Verification</span>
        <span class="text-sm font-semibold text-primary">${meta.is_verified ? 'Verified Signal' : 'Unverified'}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wider text-outline opacity-40 font-bold">Context Source</span>
        <span class="text-sm font-semibold text-white truncate">${meta.source_label || 'Analysis Engine'}</span>
      </div>
    `;
    desc.textContent = `A distilled bullet-point signal generated by the Kowalski AI parsing engine, approved by data stewards and documented into system lineage pipelines.`;

  } else if (node.type === 'knowledge') {
    tag.classList.add('bg-emerald-500/10', 'border-emerald-500/20', 'text-emerald-400');
    title.textContent = node.label;

    grid.innerHTML = `
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wider text-outline opacity-40 font-bold">Page Origin</span>
        <span class="text-sm font-semibold text-white capitalize">${meta.source || 'Manual'}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wider text-outline opacity-40 font-bold">Last Synced</span>
        <span class="text-xs font-semibold text-white truncate">${meta.updated_at ? format(new Date(meta.updated_at), 'MMM d, h:mm a') : 'N/A'}</span>
      </div>
    `;
    desc.textContent = `A published workspace document / intelligence catalog wiki derived directly from distilled warehouse insights.`;

    actions.innerHTML = `
      <button class="px-5 py-2.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 hover:brightness-110 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-300 transition-all duration-300" id="drawer-view-knowledge">
        View Page
      </button>
    `;
    actions.querySelector('#drawer-view-knowledge')?.addEventListener('click', () => {
      window.location.hash = `#knowledge/${meta.id || ''}`;
    });
  }

  if (node.id !== focusedInsightId) {
    const focusBtn = document.createElement('button');
    focusBtn.className = 'px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 text-[10px] font-bold uppercase tracking-[0.15em] text-primary transition-all duration-300 flex items-center gap-1.5';
    focusBtn.id = 'drawer-focus-node';
    focusBtn.innerHTML = `<span class="material-symbols-outlined text-[12px]" data-icon="center_focus_strong">center_focus_strong</span> Focus`;
    focusBtn.addEventListener('click', () => {
      focusedInsightId = node.id;
      maxUpstreamCount = 5;
      maxDownstreamCount = 5;
      hydrateLineage(container);
    });
    actions.appendChild(focusBtn);
  }

  // Slide drawer up and reveal
  panel.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-12');
  panel.classList.add('opacity-100', 'translate-y-0');
}

function closeNodeDetailsDrawer() {
  const panel = document.querySelector('#node-details-panel') as HTMLElement;
  if (!panel) return;

  panel.classList.add('opacity-0', 'pointer-events-none', 'translate-y-12');
  panel.classList.remove('opacity-100', 'translate-y-0');
}
