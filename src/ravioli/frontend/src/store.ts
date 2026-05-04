import type { Analysis, AnalysisLog, DataSource, KnowledgePage, User, UserGroup } from './types';

type Listener = () => void;

class Store {
  private analyses: Analysis[] = [];
  private activeAnalysisId?: string;
  private logs: AnalysisLog[] = [];
  private dataSources: DataSource[] = [];
  private knowledgePages: KnowledgePage[] = [];
  private currentUser: User | null = null;
  private users: User[] = [];
  private groups: UserGroup[] = [];
  private currentView: 'insights' | 'dashboard' | 'create-analysis' | 'knowledge' | 'data' | 'settings' | 'governance' | 'auth' = 'insights';
  private activeGovTab: string | null = null;
  private listeners: Listener[] = [];

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  setAnalyses(analyses: Analysis[]) {
    this.analyses = analyses;
    this.notify();
  }

  getAnalyses() { return this.analyses; }

  setActiveAnalysisId(id?: string) {
    this.activeAnalysisId = id;
    if (id) {
      this.currentView = 'dashboard';
    }
    this.notify();
  }

  refreshAnalysis(updated: import('./types').Analysis) {
    this.analyses = this.analyses.map(a => a.id === updated.id ? updated : a);
    this.notify();
  }

  getActiveAnalysisId() { return this.activeAnalysisId; }

  setCurrentView(view: 'insights' | 'dashboard' | 'create-analysis' | 'knowledge' | 'data' | 'settings' | 'governance' | 'auth') {
    this.currentView = view;
    if (view !== 'dashboard' && view !== 'auth') {
      this.activeAnalysisId = undefined;
    }
    this.notify();
  }

  getCurrentView() { return this.currentView; }

  setCurrentUser(user: User | null) {
    this.currentUser = user;
    this.notify();
  }

  getCurrentUser() { return this.currentUser; }

  setUsers(users: User[]) {
    this.users = users;
    this.notify();
  }

  getUsers() { return this.users; }

  setGroups(groups: UserGroup[]) {
    this.groups = groups;
    this.notify();
  }

  getGroups() { return this.groups; }

  setLogs(logs: AnalysisLog[]) {
    this.logs = logs;
    this.notify();
  }

  getLogs() { return this.logs; }

  setDataSources(sources: DataSource[]) {
    this.dataSources = sources;
    this.notify();
  }

  getDataSources() { return this.dataSources; }

  setKnowledgePages(pages: KnowledgePage[]) {
    this.knowledgePages = pages;
    this.notify();
  }

  getKnowledgePages() { return this.knowledgePages; }

  setGovernanceTab(tab: string) {
    this.activeGovTab = tab;
    // We don't necessarily need to notify here if we only want to persist it,
    // but usually it's better to keep it consistent.
    this.notify();
  }

  getGovernanceTab() { return this.activeGovTab; }
}

export const store = new Store();
