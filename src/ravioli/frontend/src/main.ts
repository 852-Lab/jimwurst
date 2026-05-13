import './style.css';
import { store } from './store';
import { api } from './services/api';
import { renderSidebar } from './components/Sidebar';
import { renderNotebook } from './components/Notebook';
import { renderInsights } from './components/Insights';
import { renderCreateAnalysis } from './components/CreateAnalysis';
import { renderKnowledge } from './components/Knowledge';
import { renderData } from './components/Data';
import { renderSettings } from './components/Settings';
import { renderGovernance } from './components/Governance';
import { renderAuth } from './components/Auth';
import type { User } from './types';

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

  // Update Sidebar if user changed or analyses changed (Sidebar handles its own data fetching from store)
  const sidebarContainer = document.getElementById('sidebar-container')!;
  // For simplicity, we re-render sidebar if anything changed in store, 
  // but we should eventually make Sidebar smarter.
  // To avoid flicker, we can check if it needs a full replace.
  const newSidebar = renderSidebar();
  sidebarContainer.innerHTML = '';
  sidebarContainer.appendChild(newSidebar);

  // Update Content area only if view or active analysis changed
  if (currentView !== lastView || activeId !== lastActiveId || currentUser.id !== lastUserId) {
    const contentContainer = document.getElementById('content-container')!;
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
      content = renderNotebook();
    }
    
    contentContainer.appendChild(content);
    
    lastView = currentView;
    lastActiveId = activeId;
    lastUserId = currentUser.id;
  } else {
    // If we are in the Notebook (dashboard) and only logs changed, 
    // we should ideally update just the logs. 
    // For now, we'll let Notebook handle its own internal updates if we can,
    // or we'll skip re-rendering the whole Notebook if only logs changed.
    // NOTE: This prevents the flicker during polling!
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
store.subscribe(() => {
  const activeId = store.getActiveAnalysisId();
  const currentUser = store.getCurrentUser();

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

