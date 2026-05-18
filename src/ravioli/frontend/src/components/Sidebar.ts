import { store } from '../store';
import { api } from '../services/api';

export function renderSidebar() {
  const container = document.createElement('aside');
  container.id = 'sidebar-aside';
  container.className = 'fixed left-0 top-0 flex flex-col h-full py-8 w-64 bg-surface-container-low font-display-lg text-sm tracking-tight z-50';
  
  updateSidebarUI(container);
  return container;
}

export function updateSidebarUI(container: HTMLElement) {
  const analyses = store.getAnalyses() || [];
  const activeId = store.getActiveAnalysisId();
  const currentView = store.getCurrentView();
  const user = store.getCurrentUser();

  let analysesListHtml = '';
  if (analyses.length === 0) {
    analysesListHtml = '<li class="px-8 py-4 text-neutral-600 italic text-[10px] uppercase tracking-widest">No Analyses found</li>';
  } else {
    analysesListHtml = analyses.map(a => {
      const isQuick = a.analysis_metadata?.type === 'quick_insight';
      const icon = isQuick ? 'bolt' : 'terminal';
      const isActive = a.id === activeId;
      return `
        <li>
          <button class="nav-item w-full ${isActive ? 'active' : ''}" data-analysis-id="${a.id}">
            <span class="material-symbols-outlined ${isActive ? 'text-primary-fixed-dim' : ''}" data-icon="${icon}">${icon}</span>
            <span class="truncate">${a.title}</span>
          </button>
        </li>
      `;
    }).join('');
  }

  // To avoid flickering, we only update the innerHTML if the shell is empty or if we need a full refresh.
  // But since sidebar is relatively static except for the list and active states, 
  // we can be a bit more clever.
  
  const hasBrand = container.querySelector('#brand-header');
  if (!hasBrand) {
    container.innerHTML = `
      <!-- Brand Header -->
      <div class="px-8 mb-12 flex items-center justify-between">
        <div class="flex items-center gap-3 cursor-pointer" id="brand-header">
          <img src="/ravioli-logo.png" alt="Ravioli Logo" class="w-8 h-8 rounded-lg shadow-lg shadow-primary/20">
          <div class="flex flex-col">
            <div class="text-xl font-medium tracking-tight text-neutral-100">Ravioli</div>
            <div class="text-[9px] uppercase tracking-[0.2em] text-primary-fixed-dim opacity-70 -mt-0.5">AI Analytics Platform</div>
          </div>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="flex-1 space-y-2 overflow-y-auto" id="sidebar-nav">
        <section class="mb-8">
          <p class="text-[10px] uppercase tracking-[0.2em] text-outline px-8 mb-4 opacity-50 font-medium">Vibe Analytics</p>
          <div class="space-y-1" id="nav-links">
            <!-- Nav buttons here -->
          </div>
        </section>

        <section class="mt-4">
          <div class="flex items-center justify-between px-8 mb-4 border-t border-outline-variant/10 pt-8">
            <p class="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant opacity-80 font-bold">Historical Analyses</p>
            <button class="text-primary-fixed-dim hover:text-white transition-colors" id="btn-new-analysis">
              <span class="material-symbols-outlined text-sm" data-icon="add">add</span>
            </button>
          </div>
          <ul class="space-y-1 px-4" id="analysis-list">
            ${analysesListHtml}
          </ul>
        </section>
      </nav>

      <!-- User Context -->
      <div class="px-8 mt-auto group relative" id="user-context">
        <!-- User info here -->
      </div>
    `;
    
    // Initial Event Listeners
    container.querySelector('#brand-header')?.addEventListener('click', () => {
      store.setCurrentView('insights');
      store.setActiveAnalysisId(undefined);
    });
    
    container.querySelector('#btn-new-analysis')?.addEventListener('click', () => {
      store.setCurrentView('create-analysis');
    });
  }

  // Update Nav Links (Active States)
  const navLinksContainer = container.querySelector('#nav-links');
  if (navLinksContainer) {
    const navs = [
      { id: 'insights', icon: 'auto_awesome', label: 'Insights' },
      { id: 'knowledge', icon: 'local_library', label: 'Knowledge' },
      { id: 'data', icon: 'storage', label: 'Data' },
      { id: 'governance', icon: 'policy', label: 'Governance' },
      { id: 'settings', icon: 'settings', label: 'Settings' }
    ];
    
    navLinksContainer.innerHTML = navs.map(nav => {
      const isActive = currentView === nav.id || (nav.id === 'insights' && currentView === 'dashboard' && !activeId);
      return `
        <button class="nav-item ${isActive ? 'active' : ''} w-full" data-nav="${nav.id}">
          <span class="material-symbols-outlined ${isActive ? 'text-primary-fixed-dim' : ''}" data-icon="${nav.icon}">${nav.icon}</span>
          <span>${nav.label}</span>
        </button>
      `;
    }).join('');
    
    // Re-bind nav listeners
    navLinksContainer.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const nav = btn.getAttribute('data-nav') as any;
        if (nav) {
          store.setCurrentView(nav);
          store.setActiveAnalysisId(undefined);
        }
      });
    });
  }

  // Update Analysis List
  const analysisList = container.querySelector('#analysis-list');
  if (analysisList) {
    analysisList.innerHTML = analysesListHtml;
    // Re-bind analysis listeners
    analysisList.querySelectorAll('[data-analysis-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-analysis-id');
        if (id) {
          store.setActiveAnalysisId(id);
        }
      });
    });
  }

  // Update User Context
  const userContext = container.querySelector('#user-context');
  if (userContext) {
    userContext.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border border-primary/20">
          <span class="material-symbols-outlined text-primary text-sm" data-icon="person">person</span>
        </div>
        <div class="flex flex-col min-w-0">
          <span class="text-[9px] font-label-sm text-primary opacity-60 uppercase tracking-[0.2em] font-bold">${user?.role || 'Guest'}</span>
          <span class="text-[12px] font-medium text-neutral-100 truncate">${user?.name || 'Anonymous'}</span>
        </div>
        <button id="btn-logout" class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:text-error">
          <span class="material-symbols-outlined text-sm" data-icon="logout">logout</span>
        </button>
      </div>
    `;
    
    userContext.querySelector('#btn-logout')?.addEventListener('click', () => {
      api.logout();
      store.setCurrentUser(null);
      store.setCurrentView('auth');
    });
  }
}

