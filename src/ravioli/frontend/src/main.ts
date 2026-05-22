import './style.css';
import { store } from './store';
import { api } from './services/api';
import { renderSidebar, updateSidebarUI } from './components/Sidebar';
import { renderAnalysis, updateAnalysisUI } from './components/analysis/AnalysisShell';
import { renderInsights } from './components/analysis/Insights';
import { renderCreateAnalysis } from './components/analysis/CreateAnalysis';
import { renderKnowledge } from './components/Knowledge';
import { renderData } from './components/Data';
import { renderSettings } from './components/Settings';
import { renderGovernance } from './components/Governance';
import { renderAuth } from './components/Auth';

const app = document.querySelector<HTMLDivElement>('#app')!;

// --- State tracking for selective updates ---
let lastView = '';
let lastActiveId = '';
let lastUserId = '';
let lastInitializing = true;
let pollInterval: any;
let currentPollId: string | null = null;

function updateUI() {
  const currentView = store.getCurrentView();
  const activeId = store.getActiveAnalysisId() || '';
  const currentUser = store.getCurrentUser();
  const isInitializing = store.getInitializing();

  // 1. Initializing state
  if (isInitializing) {
    if (lastInitializing) {
      app.innerHTML = '<div class="flex items-center justify-center w-full h-screen bg-[#0F1117] text-white">Initializing Ravioli...</div>';
      lastInitializing = false;
    }
    return;
  }

  // 2. Auth state
  if (!currentUser) {
    if (lastView !== 'auth') {
      app.innerHTML = '';
      app.appendChild(renderAuth());
      lastView = 'auth';
      lastUserId = '';
    }
    return;
  }

  // 3. Authenticated Shell
  let shell = document.getElementById('main-shell');
  if (!shell) {
    app.innerHTML = '';
    shell = document.createElement('div');
    shell.id = 'main-shell';
    shell.className = 'flex w-full h-screen overflow-hidden relative';
    
    const sidebarContainer = document.createElement('div');
    sidebarContainer.id = 'sidebar-container';
    shell.appendChild(sidebarContainer);
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'content-container';
    contentContainer.className = 'flex-1 relative overflow-hidden h-full';
    shell.appendChild(contentContainer);
    
    app.appendChild(shell);
  }

  // Global Floating Action Button (FAB)
  let fab = document.getElementById('global-fab');
  if (!fab && shell) {
    fab = document.createElement('button');
    fab.id = 'global-fab';
    fab.className = 'fixed bottom-8 right-8 w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/30 border border-primary/20 hover:scale-110 active:scale-95 transition-all duration-300 z-50 group hover:shadow-primary/50 cursor-pointer';
    fab.innerHTML = `
      <span class="material-symbols-outlined text-3xl font-bold group-hover:rotate-90 transition-transform duration-300" data-icon="add">add</span>
      <!-- Soft aura ring -->
      <span class="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping opacity-0 group-hover:opacity-100 duration-1000"></span>
    `;
    fab.addEventListener('click', () => {
      // Clear active analysis so that create-analysis doesn't auto-redirect to notebook
      store.setActiveAnalysisId(undefined);
      store.setCurrentView('create-analysis');
    });
    shell.appendChild(fab);
  }

  // Toggle FAB visibility depending on current view and active analysis
  if (fab) {
    if (currentView === 'create-analysis' || activeId || currentView === 'auth') {
      fab.classList.add('hidden');
    } else {
      fab.classList.remove('hidden');
    }
  }

  // Update Sidebar if user changed or analyses changed
  const sidebarContainer = document.getElementById('sidebar-container')!;
  let sidebarAside = document.getElementById('sidebar-aside');
  if (!sidebarAside) {
    sidebarAside = renderSidebar();
    sidebarContainer.appendChild(sidebarAside);
  } else {
    updateSidebarUI(sidebarAside);
  }

  // Update Content area only if view or active analysis changed
  const contentContainer = document.getElementById('content-container')!;
  if (currentView !== lastView || activeId !== lastActiveId || currentUser.id !== lastUserId) {
    contentContainer.innerHTML = '';
    
    let content: HTMLElement;
    if (currentView === 'create-analysis') {
      content = renderCreateAnalysis();
    } else if (currentView === 'knowledge') {
      content = renderKnowledge();
    } else if (currentView === 'data') {
      content = renderData();
    } else if (currentView === 'settings') {
      content = renderSettings();
    } else if (currentView === 'governance') {
      content = renderGovernance();
    } else if (currentView === 'insights' && !activeId) {
      content = renderInsights();
    } else {
      content = renderAnalysis();
    }
    
    contentContainer.appendChild(content);
    
    lastView = currentView;
    lastActiveId = activeId;
    lastUserId = currentUser.id;
  } else {
    // Same view. If it's the dashboard, update logs/status granularly.
    const analysisView = contentContainer.querySelector('#analysis-view') as HTMLElement;
    if (analysisView && currentView === 'dashboard') {
      updateAnalysisUI(analysisView);
    }
  }
}

// Initial Load
async function init() {
  try {
    // Fetch current user
    try {
      const user = await api.getMe();
      if (user) {
        store.setCurrentUser(user);
        if (store.getCurrentView() === 'auth') {
          store.setCurrentView('insights');
        }
      } else {
        store.setCurrentView('auth');
      }
    } catch (err) {
      console.error('Failed to fetch current user', err);
      store.setCurrentView('auth');
    } finally {
      store.setInitializing(false);
    }

    if (store.getCurrentUser()) {
      // Fetch initial data
      const [analyses, sources, pages] = await Promise.all([
        api.listAnalyses().catch(() => []),
        api.listFiles().catch(() => []),
        api.listKnowledgePages().catch(() => [])
      ]);
      store.setAnalyses(analyses);
      store.setDataSources(sources);
      store.setKnowledgePages(pages);
    }
  } catch (err) {
    console.error('Initialization failed', err);
  }
}

// --- Global ingestion progress poller ---
let ingestionPollInterval: ReturnType<typeof setInterval> | null = null;

function startIngestionPollingIfNeeded() {
  const hasPending = store.getDataSources().some(f => f.status === 'pending');
  if (hasPending && !ingestionPollInterval) {
    ingestionPollInterval = setInterval(async () => {
      try {
        const sources = await api.listFiles();
        const currentSources = store.getDataSources();
        // Only update if something changed
        if (JSON.stringify(sources) !== JSON.stringify(currentSources)) {
          store.setDataSources(sources);
        }
        if (!sources.some(f => f.status === 'pending')) {
          clearInterval(ingestionPollInterval!);
          ingestionPollInterval = null;
        }
      } catch (err) {
        console.error('Ingestion poll failed', err);
      }
    }, 3000);
  }
}

// Subscription
let lastSessionUserId = '';

store.subscribe(async () => {
  const activeId = store.getActiveAnalysisId();
  const currentUser = store.getCurrentUser();

  // Load user data dynamically on successful login
  if (currentUser && currentUser.id !== lastSessionUserId) {
    lastSessionUserId = currentUser.id;
    try {
      const [analyses, sources, pages] = await Promise.all([
        api.listAnalyses().catch(() => []),
        api.listFiles().catch(() => []),
        api.listKnowledgePages().catch(() => [])
      ]);
      store.setAnalyses(analyses);
      store.setDataSources(sources);
      store.setKnowledgePages(pages);
    } catch (err) {
      console.error('Failed to fetch user session data', err);
    }
  } else if (!currentUser) {
    lastSessionUserId = '';
  }

  // Handle polling intervals separately from UI rendering to avoid clearing them unnecessarily
  if (activeId && activeId !== currentPollId) {
    if (pollInterval) clearInterval(pollInterval);
    currentPollId = activeId;
    
    const fetchLogs = async () => {
      try {
        const logs = await api.listLogs(activeId);
        if (JSON.stringify(logs) !== JSON.stringify(store.getLogs())) {
          store.setLogs(logs);
        }
      } catch (err) {
        console.error('Failed to fetch logs', err);
      }
    };
    
    fetchLogs();
    pollInterval = setInterval(fetchLogs, 3000);
  } else if (!activeId && currentPollId) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = null;
    currentPollId = null;
  }

  updateUI();
  startIngestionPollingIfNeeded();
});

init();
updateUI();

