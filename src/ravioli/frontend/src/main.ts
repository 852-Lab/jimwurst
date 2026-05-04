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

// Cache for views with internal state that must survive store updates
let cachedViewEl: { view: string; el: HTMLElement } | null = null;

function updateUI() {
  app.innerHTML = '';

  const shell = document.createElement('div');
  shell.className = 'flex w-full h-screen overflow-hidden relative';

  const currentView = store.getCurrentView();
  const activeId = store.getActiveAnalysisId();
  const currentUser = store.getCurrentUser();
  const isInitializing = store.getInitializing();

  // Show nothing or a loading state while initializing
  if (isInitializing) {
    app.innerHTML = '<div class="flex items-center justify-center w-full h-screen bg-[#0F1117] text-white">Initializing Ravioli...</div>';
    return;
  }

  if (!currentUser && currentView !== 'auth') {
    store.setCurrentView('auth');
    return;
  }

  if (currentView === 'auth') {
    cachedViewEl = null;
    app.appendChild(renderAuth());
    return;
  }

  shell.appendChild(renderSidebar());

  // Views with internal state get cached so store updates don't reset them
  const STATEFUL_VIEWS = ['settings', 'data', 'knowledge', 'governance'];

  let viewEl: HTMLElement;
  if (STATEFUL_VIEWS.includes(currentView) && cachedViewEl?.view === currentView) {
    viewEl = cachedViewEl.el;
  } else {
    if (currentView === 'create-analysis') {
      viewEl = renderCreateAnalysis();
    } else if (currentView === 'knowledge') {
      viewEl = renderKnowledge();
    } else if (currentView === 'data') {
      viewEl = renderData();
    } else if (currentView === 'settings') {
      viewEl = renderSettings();
    } else if (currentView === 'governance') {
      viewEl = renderGovernance();
    } else if (currentView === 'insights' && !activeId) {
      viewEl = renderInsights();
    } else {
      viewEl = renderNotebook();
    }

    if (STATEFUL_VIEWS.includes(currentView)) {
      cachedViewEl = { view: currentView, el: viewEl };
    } else {
      cachedViewEl = null;
    }
  }

  shell.appendChild(viewEl);
  app.appendChild(shell);
}

// Initial Load
async function init() {
  try {
    // Fetch current user
    try {
      const user = await api.getMe();
      if (user) {
        store.setCurrentUser(user);
        // If we found a user and were on the auth screen, move to insights
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
      // Fetch analyses
      try {
        const analyses = await api.listAnalyses();
        store.setAnalyses(analyses);
      } catch (err) {
        console.error('Failed to fetch analyses', err);
      }

      // Fetch data sources
      try {
        const sources = await api.listFiles();
        store.setDataSources(sources);
      } catch (err) {
        console.error('Failed to fetch data sources', err);
      }

      // Fetch knowledge pages
      try {
        const pages = await api.listKnowledgePages();
        store.setKnowledgePages(pages);
      } catch (err) {
        console.error('Failed to fetch knowledge pages', err);
      }
    }
  } catch (err) {
    console.error('Initialization failed', err);
  }
}

// --- Global ingestion progress poller ---
// Survives UI re-renders (unlike intervals defined inside renderData).
// Polls every 3s while any file is 'pending', updating the store directly.
let ingestionPollInterval: ReturnType<typeof setInterval> | null = null;

function startIngestionPollingIfNeeded() {
  const hasPending = store.getDataSources().some(f => f.status === 'pending');
  if (hasPending && !ingestionPollInterval) {
    ingestionPollInterval = setInterval(async () => {
      try {
        const sources = await api.listFiles();
        store.setDataSources(sources);
        // Stop polling once nothing is pending anymore
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

// Polling for logs
let pollInterval: any;
store.subscribe(() => {
  const activeId = store.getActiveAnalysisId();
  const currentUser = store.getCurrentUser();
  
  // Clear previous interval
  if (pollInterval) clearInterval(pollInterval);
  
  // If we just logged in but have no data, fetch it
  if (currentUser && store.getAnalyses().length === 0) {
    const fetchData = async () => {
      try {
        const [analyses, sources, pages] = await Promise.all([
          api.listAnalyses(),
          api.listFiles(),
          api.listKnowledgePages()
        ]);
        store.setAnalyses(analyses);
        store.setDataSources(sources);
        store.setKnowledgePages(pages);
      } catch (err) {
        console.error('Failed to fetch initial data after login', err);
      }
    };
    fetchData();
  }

  if (activeId) {
    const fetchLogs = async () => {
      try {
        const logs = await api.listLogs(activeId);
        // Only update if logs changed to avoid unnecessary re-renders
        if (JSON.stringify(logs) !== JSON.stringify(store.getLogs())) {
          store.setLogs(logs);
        }
      } catch (err) {
        console.error('Failed to fetch logs', err);
      }
    };
    
    fetchLogs();
    pollInterval = setInterval(fetchLogs, 3000);
  }

  updateUI();

  // Kick off ingestion progress polling if any file is pending
  startIngestionPollingIfNeeded();
});

init();
updateUI();

