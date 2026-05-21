import { api } from '../../services/api';
import { store } from '../../store';
import { clearInsightsCache } from '../Insights';
import type { User, UserRole, UserGroup, Insight } from '../../types';
import { insightReviewCard } from './templates';

export async function renderReviewSection(container: HTMLElement) {
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

export async function renderUsersSection(container: HTMLElement) {
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
              <th class="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40"></th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <!-- Loaded via hydrateUsers -->
            <tr><td colspan="5" class="p-12 text-center opacity-20 animate-pulse">Synchronizing directory...</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;

  hydrateUsers(container);

  const btnCreate = container.querySelector('#btn-create-user');
  btnCreate?.addEventListener('click', () => showCreateUserModal());
}

export async function renderGroupsSection(container: HTMLElement) {
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

export async function hydrateQueue(container: HTMLElement) {
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

export async function hydrateUsers(container: HTMLElement) {
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
    tbody.innerHTML = `<tr><td colspan="5" class="p-12 text-center text-error opacity-60 text-sm">Error loading users directory.</td></tr>`;
  }
}

export async function hydrateGroups(container: HTMLElement) {
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
      <div class="p-8 glass-card rounded-[2.5rem] border-white/5 hover:border-secondary/30 transition-all group">
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
        
        ${group.members && group.members.length > 0 ? `
          <div class="flex items-center gap-2 mb-6">
            <div class="flex -space-x-2">
              ${group.members.slice(0, 4).map(m => `
                <div class="w-7 h-7 rounded-full bg-secondary/20 flex items-center justify-center border border-[#1C1C1E] text-[10px] font-bold text-secondary z-10" title="${m.name} (${m.role})">
                  ${m.name.charAt(0).toUpperCase()}
                </div>
              `).join('')}
              ${group.members.length > 4 ? `
                <div class="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center border border-[#1C1C1E] text-[9px] font-bold text-outline z-0">
                  +${group.members.length - 4}
                </div>
              ` : ''}
            </div>
            <span class="text-[10px] text-outline opacity-40 ml-2 font-bold">${group.members.length} Member${group.members.length === 1 ? '' : 's'}</span>
          </div>
        ` : `
          <div class="mb-6 flex items-center gap-2">
            <div class="w-7 h-7 rounded-full border border-dashed border-white/10 flex items-center justify-center">
              <span class="material-symbols-outlined text-[14px] text-outline opacity-30" data-icon="person_add">person_add</span>
            </div>
            <span class="text-[10px] text-outline opacity-40 font-bold">No members yet</span>
          </div>
        `}

        <div class="pt-6 border-t border-white/5 flex items-center justify-between">
          <button class="btn-edit-group text-[10px] uppercase tracking-widest font-bold text-outline hover:text-secondary opacity-0 group-hover:opacity-100 transition-all" data-group-id="${group.id}">Edit Details</button>
          <button class="btn-manage-members text-[10px] uppercase tracking-widest font-bold text-secondary opacity-0 group-hover:opacity-100 transition-all" data-group-id="${group.id}">Manage Members →</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.btn-edit-group').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-group-id');
        const group = groups.find(g => g.id === id);
        if (group) showCreateGroupModal(group);
      });
    });

    grid.querySelectorAll('.btn-manage-members').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-group-id');
        const group = groups.find(g => g.id === id);
        if (group) showManageGroupMembersModal(group);
      });
    });

  } catch {
    grid.innerHTML = `<p class="col-span-full p-12 text-center text-error opacity-60">Error loading groups.</p>`;
  }
}

export function showCreateUserModal(userToEdit?: User) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-reveal';
  const currentUser = store.getCurrentUser();
  modal.innerHTML = `
    <div class="w-full max-w-md p-10 glass-card rounded-[3rem] border-white/10 shadow-2xl space-y-8">
      <div class="flex items-center justify-between">
        <div class="space-y-2">
          <h2 class="text-2xl font-display-lg tracking-tight text-on-surface">
            ${userToEdit ? 'Edit User Details' : 'Provision New User'}
          </h2>
          <p class="text-xs text-outline opacity-60">
            ${userToEdit ? `Updating profile for ${userToEdit.email}` : 'This will trigger a signup process for the user.'}
          </p>
        </div>
        ${userToEdit && currentUser?.id !== userToEdit.id ? `
          <button type="button" id="btn-delete-user" class="p-3 rounded-xl bg-error/10 text-error hover:bg-error hover:text-white transition-all group/del">
            <span class="material-symbols-outlined text-sm" data-icon="delete">delete</span>
          </button>
        ` : ''}
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

  if (userToEdit && currentUser?.id !== userToEdit.id) {
    modal.querySelector('#btn-delete-user')?.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to remove user "${userToEdit.name}"? This action cannot be undone.`)) {
        try {
          await api.deleteUser(userToEdit.id);
          modal.remove();
          store.setGovernanceTab('users');
          hydrateUsers(document.body);
        } catch (err: any) {
          alert(err.message);
        }
      }
    });
  }

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
      hydrateUsers(document.body);
    } catch (err: any) {
      alert(err.message);
    }
  });
}

export function showCreateGroupModal(groupToEdit?: UserGroup) {
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
          hydrateGroups(document.body);
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
      hydrateGroups(document.body);
    } catch (err: any) {
      alert(err.message);
    }
  });
}

export async function showManageGroupMembersModal(group: UserGroup) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-reveal';
  
  // Show loading state initially
  modal.innerHTML = `
    <div class="w-full max-w-lg p-10 glass-card rounded-[3rem] border-white/10 shadow-2xl space-y-8 flex items-center justify-center h-64">
      <div class="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const [allUsers, members] = await Promise.all([
      api.listUsers(),
      api.listGroupMembers(group.id)
    ]);
    
    const nonMembers = allUsers.filter(u => !members.find(m => m.id === u.id));

    const renderContent = () => `
      <div class="w-full max-w-lg p-10 glass-card rounded-[3rem] border-white/10 shadow-2xl space-y-8" id="manage-members-content">
        <div class="flex items-center justify-between">
          <div class="space-y-2">
            <h2 class="text-2xl font-display-lg tracking-tight text-on-surface">Manage Members</h2>
            <p class="text-xs text-outline opacity-60">Assign or remove users from ${group.name}</p>
          </div>
          <button type="button" id="btn-close-members" class="p-3 rounded-xl hover:bg-white/5 text-outline hover:text-white transition-all">
            <span class="material-symbols-outlined text-sm" data-icon="close">close</span>
          </button>
        </div>

        <div class="space-y-4">
          <h3 class="text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40 ml-4">Current Members</h3>
          <div class="max-h-48 overflow-y-auto pr-2 custom-scrollbar space-y-2">
            ${members.length === 0 ? '<p class="text-sm text-outline opacity-40 p-4 text-center">No members assigned yet.</p>' : ''}
            ${members.map(m => `
              <div class="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    ${m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p class="text-sm font-bold text-on-surface">${m.name}</p>
                    <p class="text-[10px] text-outline opacity-60">${m.role}</p>
                  </div>
                </div>
                <button class="btn-remove-member p-2 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-all" data-user-id="${m.id}">
                  <span class="material-symbols-outlined text-sm" data-icon="person_remove">person_remove</span>
                </button>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="space-y-4 pt-4 border-t border-white/5">
          <h3 class="text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40 ml-4">Add Member</h3>
          <div class="flex gap-2">
            <select id="new-member-select" class="flex-1 px-6 py-4 rounded-2xl bg-white/5 border border-white/5 focus:border-secondary/50 outline-none text-on-surface appearance-none text-sm">
              <option value="" disabled selected>Select a user to add...</option>
              ${nonMembers.map(u => `<option value="${u.id}">${u.name} (${u.role})</option>`).join('')}
            </select>
            <button id="btn-add-member" class="px-6 rounded-2xl bg-secondary text-on-secondary text-[10px] uppercase tracking-[0.2em] font-bold shadow-lg shadow-secondary/20 hover:scale-105 transition-all disabled:opacity-50 disabled:pointer-events-none">
              Add
            </button>
          </div>
        </div>
      </div>
    `;

    modal.innerHTML = renderContent();

    const bindEvents = () => {
      modal.querySelector('#btn-close-members')?.addEventListener('click', () => {
        modal.remove();
        hydrateGroups(document.body);
      });
      
      modal.querySelectorAll('.btn-remove-member').forEach(btn => {
        btn.addEventListener('click', async () => {
          const userId = btn.getAttribute('data-user-id');
          if (!userId) return;
          try {
            await api.removeGroupMember(group.id, userId);
            const userIndex = members.findIndex(m => m.id === userId);
            if (userIndex > -1) {
              nonMembers.push(members[userIndex]);
              members.splice(userIndex, 1);
              modal.innerHTML = renderContent();
              bindEvents();
            }
          } catch (err: any) {
            alert(err.message);
          }
        });
      });

      modal.querySelector('#btn-add-member')?.addEventListener('click', async () => {
        const select = modal.querySelector('#new-member-select') as HTMLSelectElement;
        const userId = select.value;
        if (!userId) return;
        try {
          await api.addGroupMember(group.id, userId);
          const userIndex = nonMembers.findIndex(u => u.id === userId);
          if (userIndex > -1) {
            members.push(nonMembers[userIndex]);
            nonMembers.splice(userIndex, 1);
            modal.innerHTML = renderContent();
            bindEvents();
          }
        } catch (err: any) {
          alert(err.message);
        }
      });
    };

    bindEvents();
  } catch (err: any) {
    modal.innerHTML = `
      <div class="w-full max-w-lg p-10 glass-card rounded-[3rem] border-white/10 shadow-2xl text-center space-y-4">
        <p class="text-error">Failed to load members.</p>
        <button class="px-6 py-3 rounded-2xl bg-white/5 border border-white/5 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-white/10 transition-all" onclick="this.closest('.fixed').remove()">Close</button>
      </div>
    `;
  }
}

