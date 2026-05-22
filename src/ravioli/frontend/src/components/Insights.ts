import { state, DAY_OPTIONS, clearInsightsCache } from './insights/state';
import { hydrate } from './insights/interactions';

export { clearInsightsCache };

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
          <button class="view-btn px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-500 ${state.activeView === 'feed' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-outline hover:text-white hover:bg-white/5'}" data-view="feed">
            Feed & Summary
          </button>
          <button class="view-btn px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-500 ${state.activeView === 'lineage' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-outline hover:text-white hover:bg-white/5'}" data-view="lineage">
            Lineage Map
          </button>
        </div>
      </div>
      <div class="h-px bg-gradient-to-r from-primary/20 via-outline-variant/20 to-transparent"></div>
    </header>

    <div class="flex-1 px-12 pb-16 relative">
      
      <!-- VIEW 1: Chronological Feed & AI Summary -->
      <div id="feed-view" class="${state.activeView === 'feed' ? 'space-y-16' : 'hidden'} animate-reveal">
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
                <button class="day-btn px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-500 ${d === state.activeDays ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-outline hover:text-white hover:bg-white/5'}" data-days="${d}">${d}d</button>
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
      <div id="lineage-view" class="${state.activeView === 'lineage' ? 'flex flex-col' : 'hidden'} h-full min-h-[600px] relative animate-reveal">
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
