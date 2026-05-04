import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderGovernance } from '../../../src/ravioli/frontend/src/components/Governance';
import { api } from '../../../src/ravioli/frontend/src/services/api';
import { store } from '../../../src/ravioli/frontend/src/store';

vi.mock('../../../src/ravioli/frontend/src/services/api', () => ({
  api: {
    getReviewQueue: vi.fn(),
    listUsers: vi.fn(),
    listGroups: vi.fn(),
    createUser: vi.fn(),
    verifyInsight: vi.fn(),
    rejectInsight: vi.fn(),
  }
}));

describe('Governance Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getReviewQueue as any).mockResolvedValue([]);
    (api.listUsers as any).mockResolvedValue([]);
    (api.listGroups as any).mockResolvedValue([]);
  });

  it('should render Governance title', () => {
    const el = renderGovernance();
    expect(el.innerHTML).toContain('Governance');
  });

  describe('Role-based Subtab Visibility', () => {
    it('should show "Insights Review" for Admins', () => {
      store.setCurrentUser({ id: 'u1', name: 'Admin', email: 'a@test.com', role: 'Admin', status: 'active' });
      const el = renderGovernance();
      expect(el.innerHTML).toContain('Insights Review');
    });

    it('should show "Insights Review" for Stewards', () => {
      store.setCurrentUser({ id: 'u1', name: 'Steward', email: 's@test.com', role: 'Steward', status: 'active' });
      const el = renderGovernance();
      expect(el.innerHTML).toContain('Insights Review');
    });

    it('should NOT show "Insights Review" for Contributors', () => {
      store.setCurrentUser({ id: 'u1', name: 'Contributor', email: 'c@test.com', role: 'Contributor', status: 'active' });
      const el = renderGovernance();
      expect(el.innerHTML).not.toContain('Insights Review');
    });

    it('should NOT show "Insights Review" for Viewers', () => {
      store.setCurrentUser({ id: 'u1', name: 'Viewer', email: 'v@test.com', role: 'Viewer', status: 'active' });
      const el = renderGovernance();
      expect(el.innerHTML).not.toContain('Insights Review');
    });
  });

  describe('Subtab Content Loading', () => {
    it('should load users when switching to Users tab', async () => {
      store.setCurrentUser({ id: 'u1', name: 'Admin', email: 'a@test.com', role: 'Admin', status: 'active' });
      (api.listUsers as any).mockResolvedValue([{ id: 'u2', name: 'Jane Doe', email: 'jane@test.com', role: 'Viewer', status: 'active' }]);
      
      const el = renderGovernance();
      const usersBtn = el.querySelector('[data-tab="users"]') as HTMLButtonElement;
      usersBtn.click();
      
      // Wait for async hydration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(api.listUsers).toHaveBeenCalled();
      expect(el.innerHTML).toContain('Jane Doe');
      expect(el.innerHTML).toContain('jane@test.com');
    });

    it('should show "Add New User" button only for Admins', () => {
      // Admin case
      store.setCurrentUser({ id: 'u1', name: 'Admin', email: 'a@test.com', role: 'Admin', status: 'active' });
      let el = renderGovernance();
      (el.querySelector('[data-tab="users"]') as HTMLButtonElement).click();
      expect(el.querySelector('#btn-create-user')).not.toBeNull();

      // Steward case
      store.setCurrentUser({ id: 'u1', name: 'Steward', email: 's@test.com', role: 'Steward', status: 'active' });
      el = renderGovernance();
      (el.querySelector('[data-tab="users"]') as HTMLButtonElement).click();
      expect(el.querySelector('#btn-create-user')).toBeNull();
    });
  });
});
