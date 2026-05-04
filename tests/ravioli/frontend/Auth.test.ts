import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderAuth } from '../../../src/ravioli/frontend/src/components/Auth';
import { api } from '../../../src/ravioli/frontend/src/services/api';
import { store } from '../../../src/ravioli/frontend/src/store';

vi.mock('../../../src/ravioli/frontend/src/services/api', () => ({
  api: {
    login: vi.fn(),
    signup: vi.fn(),
  }
}));

describe('Auth Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Login mode by default', () => {
    const el = renderAuth();
    expect(el.innerHTML).toContain('Welcome Back');
    expect(el.innerHTML).toContain('Sign In');
    expect(el.querySelector('#name')).toBeNull(); // No name field in login
  });

  it('should switch to Signup mode when toggle is clicked', () => {
    const el = renderAuth();
    const toggle = el.querySelector('#auth-toggle') as HTMLButtonElement;
    toggle.click();
    
    expect(el.innerHTML).toContain('Create Account');
    expect(el.innerHTML).toContain('Get Started');
    expect(el.querySelector('#name')).not.toBeNull(); // Name field present in signup
  });

  it('should call api.login on form submission in login mode', async () => {
    (api.login as any).mockResolvedValue({ id: 'u1', name: 'User', email: 'u@test.com', role: 'Viewer', status: 'active' });
    
    const el = renderAuth();
    const emailInput = el.querySelector('#email') as HTMLInputElement;
    const passInput = el.querySelector('#password') as HTMLInputElement;
    const form = el.querySelector('#auth-form') as HTMLFormElement;

    emailInput.value = 'u@test.com';
    passInput.value = 'pass123';
    
    form.dispatchEvent(new Event('submit'));
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(api.login).toHaveBeenCalledWith({ email: 'u@test.com', password: 'pass123' });
    expect(store.getCurrentUser()?.email).toBe('u@test.com');
  });

  it('should show error message on login failure', async () => {
    (api.login as any).mockRejectedValue(new Error('Invalid credentials'));
    
    const el = renderAuth();
    const form = el.querySelector('#auth-form') as HTMLFormElement;
    const errorEl = el.querySelector('#auth-error') as HTMLElement;

    form.dispatchEvent(new Event('submit'));
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(errorEl.classList.contains('hidden')).toBe(false);
    expect(errorEl.textContent).toBe('Invalid credentials');
  });
});
