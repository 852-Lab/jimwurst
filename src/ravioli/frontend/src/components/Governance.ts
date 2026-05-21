import { store } from '../store';
import { renderReviewSection, renderUsersSection, renderGroupsSection } from './governance/interactions';

export function renderGovernance() {
  const container = document.createElement('main');
  container.className = 'flex-1 ml-64 overflow-y-auto bg-background h-screen flex flex-col custom-scrollbar';

  const user = store.getCurrentUser();
  const isAdmin = user?.role === 'Admin';
  const isSteward = user?.role === 'Steward';
  const canReview = isAdmin || isSteward;

  // Initial tab selection from store or default
  let activeTab = store.getGovernanceTab() || (canReview ? 'review' : 'users');
  
  // Ensure the stored tab is actually visible to this user
  if (activeTab === 'review' && !canReview) activeTab = 'users';

  const renderTabs = () => {
    const tabs: { id: string, label: string, icon: string, hidden?: boolean }[] = [
      { id: 'review', label: 'Insights Review', icon: 'pending_actions', hidden: !canReview },
      { id: 'users', label: 'Users', icon: 'person' },
      { id: 'groups', label: 'Groups', icon: 'group' },
    ];

    return tabs.filter(t => !t.hidden).map(t => `
      <button class="gov-tab-btn pb-4 text-[10px] uppercase tracking-[0.2em] font-bold transition-all flex items-center gap-2 ${activeTab === t.id ? 'text-primary border-b-2 border-primary active' : 'text-outline hover:text-white opacity-50'}" data-tab="${t.id}">
        <span class="material-symbols-outlined text-sm" data-icon="${t.icon}">${t.icon}</span>
        ${t.label}
      </button>
    `).join('');
  };

  const updateUI = () => {
    container.innerHTML = `
      <!-- Page Header -->
      <header class="px-12 pt-12 pb-8 shrink-0 animate-reveal">
        <div class="space-y-2">
          <p class="text-[10px] uppercase tracking-[0.3em] text-primary-fixed-dim opacity-60 font-label-sm">Administrative Control</p>
          <h1 class="font-display-lg text-4xl text-on-surface tracking-tight">Governance</h1>
          <p class="text-sm text-on-surface-variant font-body-md opacity-60">Manage platform integrity, access controls, and data verification.</p>
        </div>
        <div class="mt-8 h-px bg-gradient-to-r from-primary/20 via-outline-variant/20 to-transparent"></div>
      </header>

      <div class="flex-1 px-12 pb-16 space-y-12">
        
        <!-- Horizontal Tabs -->
        <div class="flex items-center gap-8 border-b border-white/5 pb-1">
          ${renderTabs()}
        </div>

        <!-- Tab Content Area -->
        <div id="gov-content" class="animate-reveal stagger-1">
          <!-- Sections will be injected here -->
        </div>
      </div>
    `;

    const contentArea = container.querySelector('#gov-content') as HTMLDivElement;
    
    if (activeTab === 'review') {
      renderReviewSection(contentArea);
    } else if (activeTab === 'users') {
      renderUsersSection(contentArea);
    } else if (activeTab === 'groups') {
      renderGroupsSection(contentArea);
    }

    container.querySelectorAll('.gov-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) {
          activeTab = tab;
          store.setGovernanceTab(tab);
          updateUI();
        }
      });
    });
  };

  updateUI();
  return container;
}
