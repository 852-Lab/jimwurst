import { api } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import type { Insight, User, UserRole, UserGroup } from '../types';
import { clearInsightsCache } from './Insights';
import { store } from '../store';

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
          store.setGovernanceTab(tab);
          // activeTab will be updated on next render via store notify
        }
      });
    });
  };

  updateUI();
  return container;
}

// --- Section Renderers ---

async function renderReviewSection(container: HTMLElement) {
  container.innerHTML = `
    <section class="space-y-8 animate-reveal">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center border border-tertiary/20">
            <span class="material-symbols-outlined text-tertiary" data-icon="pending_actions">pending_actions</span>
          </div>
          <div>
            <h2 class="text-xl font-headline-sm text-on-surface uppercase tracking-[0.15em]">Pending Verification</h2>
            <p class="text-[10px] uppercase tracking-[0.2em] text-outline opacity-40 font-medium">Verify AI-generated insights before they reach the main feed</p>
          </div>
        </div>
        <span id="queue-badge" class="px-3 py-1 rounded-full bg-tertiary/10 text-tertiary text-[10px] font-bold uppercase tracking-widest hidden">0</span>
      </div>

      <div id="review-queue" class="grid grid-cols-1 gap-4 max-w-4xl">
        <div class="h-32 rounded-3xl bg-surface-container-low animate-pulse"></div>
        <div class="h-32 rounded-3xl bg-surface-container-low animate-pulse"></div>
      </div>
    </section>
  `;
  
  hydrateQueue(container);
}

async function renderUsersSection(container: HTMLElement) {
  const isAdmin = store.getCurrentUser()?.role === 'Admin';
  
  container.innerHTML = `
    <section class="space-y-8 animate-reveal">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <span class="material-symbols-outlined text-primary" data-icon="person">person</span>
          </div>
          <div>
            <h2 class="text-xl font-headline-sm text-on-surface uppercase tracking-[0.15em]">Platform Users</h2>
            <p class="text-[10px] uppercase tracking-[0.2em] text-outline opacity-40 font-medium">Manage access and roles for your teammates</p>
          </div>
        </div>
        ${isAdmin ? `
          <button id="btn-create-user" class="px-6 py-3 rounded-2xl bg-primary text-on-primary text-[11px] uppercase tracking-[0.2em] font-bold hover:scale-105 transition-all">
            Add New User
          </button>
        ` : ''}
      </div>

      <div class="glass-card rounded-[2.5rem] border-white/5 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-white/5 bg-white/5">
              <th class="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40">Name</th>
              <th class="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40">Email</th>
              <th class="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40">Role</th>
              <th class="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40">Status</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <!-- Loaded via hydrateUsers -->
            <tr><td colspan="4" class="p-12 text-center opacity-20 animate-pulse">Synchronizing directory...</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;

  hydrateUsers(container);

  const btnCreate = container.querySelector('#btn-create-user');
  btnCreate?.addEventListener('click', () => showCreateUserModal());
}

async function renderGroupsSection(container: HTMLElement) {
  container.innerHTML = `
    <section class="space-y-8 animate-reveal">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center border border-secondary/20">
            <span class="material-symbols-outlined text-secondary" data-icon="group">group</span>
          </div>
          <div>
            <h2 class="text-xl font-headline-sm text-on-surface uppercase tracking-[0.15em]">User Groups</h2>
            <p class="text-[10px] uppercase tracking-[0.2em] text-outline opacity-40 font-medium">Organize users into decentralized teams for collaboration</p>
          </div>
        </div>
        <button id="btn-create-group" class="px-6 py-3 rounded-2xl bg-surface-container-high text-on-surface border border-white/5 text-[11px] uppercase tracking-[0.2em] font-bold hover:bg-white/10 transition-all">
          New Group
        </button>
      </div>

      <div id="groups-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Loaded via hydrateGroups -->
        <div class="h-32 rounded-3xl bg-surface-container-low animate-pulse"></div>
        <div class="h-32 rounded-3xl bg-surface-container-low animate-pulse"></div>
        <div class="h-32 rounded-3xl bg-surface-container-low animate-pulse"></div>
      </div>
    </section>
  `;

  hydrateGroups(container);
  
  container.querySelector('#btn-create-group')?.addEventListener('click', () => {
    showCreateGroupModal();
  });
}

// --- Hydrators ---

async function hydrateQueue(container: HTMLElement) {
  const queueEl = container.querySelector('#review-queue');
  const badge = container.querySelector('#queue-badge');
  if (!queueEl) return;
  try {
    let queue = await api.getReviewQueue();

    const render = (items: Insight[]) => {
      if (badge) {
        if (items.length > 0) {
          badge.textContent = `${items.length} Pending`;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
      queueEl.innerHTML = items.length === 0
        ? `<div class="glass-card flex flex-col items-center gap-5 py-24 text-center rounded-[3rem] border-dashed border-white/10 group animate-reveal">
            <div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-700">
              <span class="material-symbols-outlined text-5xl text-outline opacity-20 group-hover:text-primary group-hover:opacity-100 transition-all" data-icon="verified_user">verified_user</span>
            </div>
            <div class="space-y-2">
              <p class="text-sm uppercase tracking-[0.4em] font-bold text-on-surface opacity-60">Integrity Check Complete</p>
              <p class="text-xs uppercase tracking-[0.1em] text-outline opacity-30 font-medium">There are no insights awaiting verification at this time.</p>
            </div>
          </div>`
        : items.map((i, index) => `<div class="opacity-0 animate-reveal" style="animation-delay: ${index * 0.08}s">${insightReviewCard(i)}</div>`).join('');

      // Bind verify / reject buttons
      queueEl.querySelectorAll('.btn-verify-insight').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          btn.setAttribute('disabled', 'true');
          try {
            await api.verifyInsight(id);
            queue = queue.filter(i => i.id !== id);
            clearInsightsCache(); 
            render(queue);
          } catch { btn.removeAttribute('disabled'); }
        });
      });

      queueEl.querySelectorAll('.btn-reject-insight').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          try {
            await api.rejectInsight(id);
            queue = queue.filter(i => i.id !== id);
            render(queue);
          } catch {}
        });
      });
    };

    render(queue);
  } catch {
    queueEl.innerHTML = `<p class="text-sm text-outline opacity-50 p-12 text-center glass-card rounded-3xl">Failed to synchronize with governance server.</p>`;
  }
}

async function hydrateUsers(container: HTMLElement) {
  const tbody = container.querySelector('#users-table-body');
  if (!tbody) return;
  const currentUser = store.getCurrentUser();
  const isAdmin = currentUser?.role === 'Admin';
  try {
    const users = await api.listUsers();
    tbody.innerHTML = users.map(user => `
      <tr class="group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
        <td class="px-8 py-5 text-sm font-bold text-on-surface">${user.name}</td>
        <td class="px-8 py-5 text-sm text-outline opacity-60">${user.email}</td>
        <td class="px-8 py-5">
          <span class="px-3 py-1 rounded-lg bg-surface-container-high border border-white/5 text-[10px] uppercase tracking-widest font-bold text-on-surface">
            ${user.role}
          </span>
        </td>
        <td class="px-8 py-5">
          <div class="flex items-center gap-2">
            <div class="w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-success shadow-[0_0_8px_rgba(var(--success-rgb),0.5)]' : 'bg-outline opacity-40'}"></div>
            <span class="text-[10px] uppercase tracking-widest font-bold ${user.status === 'active' ? 'text-success' : 'text-outline opacity-40'}">
              ${user.status}
            </span>
          </div>
        </td>
        <td class="px-8 py-5 text-right">
          ${isAdmin ? `
            <button class="btn-edit-user p-2 opacity-0 group-hover:opacity-100 hover:text-primary transition-all" data-id="${user.id}">
              <span class="material-symbols-outlined text-sm" data-icon="edit">edit</span>
            </button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    // Bind edit buttons
    tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const user = users.find(u => u.id === id);
        if (user) showCreateUserModal(user);
      });
    });
  } catch {
    tbody.innerHTML = `<tr><td colspan="4" class="p-12 text-center text-error opacity-60 text-sm">Error loading users directory.</td></tr>`;
  }
}

async function hydrateGroups(container: HTMLElement) {
  const grid = container.querySelector('#groups-grid');
  if (!grid) return;
  try {
    const groups = await api.listGroups();
    if (groups.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-24 text-center glass-card rounded-[3rem] border-dashed border-white/10 opacity-40">
          <p class="text-sm uppercase tracking-[0.2em] font-bold">No groups established</p>
        </div>
      `;
      return;
    }
    grid.innerHTML = groups.map(group => `
      <div class="p-8 glass-card rounded-[2.5rem] border-white/5 hover:border-secondary/30 transition-all cursor-pointer group group-card" data-group-id="${group.id}">
        <div class="flex items-center gap-4 mb-4">
          <div class="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center border border-secondary/20">
            <span class="material-symbols-outlined text-secondary" data-icon="hub">hub</span>
          </div>
          <div>
            <h3 class="font-headline-sm text-lg text-on-surface">${group.name}</h3>
            <p class="text-[10px] uppercase tracking-widest text-outline opacity-40 font-bold">Decentralized Team</p>
          </div>
        </div>
        <p class="text-sm text-outline opacity-60 line-clamp-2 mb-6 h-10 font-body-md">${group.description || 'No description provided.'}</p>
        <div class="pt-6 border-t border-white/5 flex items-center justify-between">
          <span class="text-[10px] uppercase tracking-widest font-bold text-secondary opacity-0 group-hover:opacity-100 transition-all">Edit Group Details →</span>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.group-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-group-id');
        const group = groups.find(g => g.id === id);
        if (group) showCreateGroupModal(group);
      });
    });
  } catch {
    grid.innerHTML = `<p class="col-span-full p-12 text-center text-error opacity-60">Error loading groups.</p>`;
  }
}

function showCreateUserModal(userToEdit?: User) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-reveal';
  modal.innerHTML = `
    <div class="w-full max-w-md p-10 glass-card rounded-[3rem] border-white/10 shadow-2xl space-y-8">
      <div class="space-y-2">
        <h2 class="text-2xl font-display-lg tracking-tight text-on-surface">
          ${userToEdit ? 'Edit User Details' : 'Provision New User'}
        </h2>
        <p class="text-xs text-outline opacity-60">
          ${userToEdit ? `Updating profile for ${userToEdit.email}` : 'This will trigger a signup process for the user.'}
        </p>
      </div>

      <form id="create-user-form" class="space-y-6">
        <div class="space-y-2">
          <label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40 ml-4">Full Name</label>
          <input type="text" id="new-name" required value="${userToEdit?.name || ''}" class="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/5 focus:border-primary/50 outline-none text-on-surface" placeholder="Jane Smith">
        </div>
        
        <div class="space-y-2 ${userToEdit ? 'opacity-50 pointer-events-none' : ''}">
          <label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40 ml-4">Work Email</label>
          <input type="email" id="new-email" required ${userToEdit ? 'readonly' : ''} value="${userToEdit?.email || ''}" class="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/5 focus:border-primary/50 outline-none text-on-surface" placeholder="jane@aipassione.com">
        </div>

        <div class="space-y-2">
          <label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40 ml-4">Platform Role</label>
          <select id="new-role" class="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/5 focus:border-primary/50 outline-none text-on-surface appearance-none">
            <option value="Admin" ${userToEdit?.role === 'Admin' ? 'selected' : ''}>Admin</option>
            <option value="Steward" ${userToEdit?.role === 'Steward' ? 'selected' : ''}>Steward</option>
            <option value="Contributor" ${userToEdit?.role === 'Contributor' ? 'selected' : ''}>Contributor</option>
            <option value="Viewer" ${userToEdit?.role === 'Viewer' || !userToEdit ? 'selected' : ''}>Viewer</option>
          </select>
        </div>

        ${userToEdit ? `
          <div class="space-y-2">
            <label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40 ml-4">Account Status</label>
            <select id="new-status" class="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/5 focus:border-primary/50 outline-none text-on-surface appearance-none">
              <option value="active" ${userToEdit.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="invited" ${userToEdit.status === 'invited' ? 'selected' : ''}>Invited</option>
            </select>
          </div>
        ` : ''}

        <div class="flex gap-4 pt-4">
          <button type="button" id="btn-cancel" class="flex-1 py-4 rounded-2xl border border-white/5 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-white/5 transition-all">Cancel</button>
          <button type="submit" class="flex-1 py-4 rounded-2xl bg-primary text-on-primary text-[10px] uppercase tracking-[0.2em] font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all">
            ${userToEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#btn-cancel')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (modal.querySelector('#new-name') as HTMLInputElement).value;
    const role = (modal.querySelector('#new-role') as HTMLSelectElement).value as UserRole;
    
    try {
      if (userToEdit) {
        const status = (modal.querySelector('#new-status') as HTMLSelectElement).value as any;
        await api.updateUser(userToEdit.id, { name, role, status });
      } else {
        const email = (modal.querySelector('#new-email') as HTMLInputElement).value;
        await api.createUser({ name, email, role });
      }
      modal.remove();
      // Store ensures re-render with 'users' tab active
      store.setGovernanceTab('users');
    } catch (err: any) {
      alert(err.message);
    }
  });
}

function showCreateGroupModal(groupToEdit?: UserGroup) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-reveal';
  modal.innerHTML = `
    <div class="w-full max-w-md p-10 glass-card rounded-[3rem] border-white/10 shadow-2xl space-y-8">
      <div class="flex items-center justify-between">
        <div class="space-y-2">
          <h2 class="text-2xl font-display-lg tracking-tight text-on-surface">
            ${groupToEdit ? 'Edit Group' : 'Provision New Group'}
          </h2>
          <p class="text-xs text-outline opacity-60">
            ${groupToEdit ? 'Updating group details.' : 'Create a new decentralized team.'}
          </p>
        </div>
        ${groupToEdit ? `
          <button type="button" id="btn-delete-group" class="p-3 rounded-xl bg-error/10 text-error hover:bg-error hover:text-white transition-all group/del">
            <span class="material-symbols-outlined text-sm" data-icon="delete">delete</span>
          </button>
        ` : ''}
      </div>

      <form id="create-group-form" class="space-y-6">
        <div class="space-y-2">
          <label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40 ml-4">Group Name</label>
          <input type="text" id="new-group-name" required value="${groupToEdit?.name || ''}" class="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/5 focus:border-secondary/50 outline-none text-on-surface" placeholder="e.g. Analytics Team">
        </div>
        
        <div class="space-y-2">
          <label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40 ml-4">Description</label>
          <textarea id="new-group-desc" class="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/5 focus:border-secondary/50 outline-none text-on-surface resize-none h-24" placeholder="Brief description of the group's purpose...">${groupToEdit?.description || ''}</textarea>
        </div>

        <div class="flex gap-4 pt-4">
          <button type="button" id="btn-cancel-group" class="flex-1 py-4 rounded-2xl border border-white/5 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-white/5 transition-all">Cancel</button>
          <button type="submit" class="flex-1 py-4 rounded-2xl bg-secondary text-on-secondary text-[10px] uppercase tracking-[0.2em] font-bold shadow-lg shadow-secondary/20 hover:scale-105 transition-all">
            ${groupToEdit ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#btn-cancel-group')?.addEventListener('click', () => modal.remove());
  
  if (groupToEdit) {
    modal.querySelector('#btn-delete-group')?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
        try {
          await api.deleteGroup(groupToEdit.id);
          modal.remove();
          store.setGovernanceTab('groups');
        } catch (err: any) {
          alert(err.message);
        }
      }
    });
  }

  modal.querySelector('#create-group-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (modal.querySelector('#new-group-name') as HTMLInputElement).value;
    const description = (modal.querySelector('#new-group-desc') as HTMLTextAreaElement).value;
    
    try {
      if (groupToEdit) {
        await api.updateGroup(groupToEdit.id, { name, description });
      } else {
        await api.createGroup({ name, description });
      }
      modal.remove();
      store.setGovernanceTab('groups');
    } catch (err: any) {
      alert(err.message);
    }
  });
}

function insightReviewCard(insight: Insight) {
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
