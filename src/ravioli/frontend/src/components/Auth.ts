import { store } from '../store';
import { api } from '../services/api';

export function renderAuth() {
  const container = document.createElement('div');
  container.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-hidden';
  
  // Background decorative elements
  const bg = document.createElement('div');
  bg.className = 'absolute inset-0 overflow-hidden pointer-events-none';
  bg.innerHTML = `
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-tertiary/10 blur-[150px] rounded-full animate-pulse" style="animation-delay: 2s"></div>
    <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
  `;
  container.appendChild(bg);

  const card = document.createElement('div');
  card.className = 'relative w-full max-w-md p-10 glass-card rounded-[3rem] border-white/5 shadow-2xl animate-reveal stagger-1';
  
  let mode: 'login' | 'signup' = 'login';

  const updateForm = () => {
    card.innerHTML = `
      <div class="text-center space-y-3 mb-10">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 mb-4">
          <span class="material-symbols-outlined text-3xl text-primary" data-icon="rocket_launch">rocket_launch</span>
        </div>
        <h1 class="text-3xl font-display-lg tracking-tight text-on-surface">
          ${mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p class="text-sm text-outline opacity-60 font-body-md">
          ${mode === 'login' ? 'Please enter your work credentials to continue' : 'Join Ravioli AI and start analyzing your data'}
        </p>
      </div>

      <form id="auth-form" class="space-y-6">
        ${mode === 'signup' ? `
          <div class="space-y-2">
            <label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40 ml-4">Full Name</label>
            <input type="text" id="name" required class="w-full px-6 py-4 rounded-2xl bg-surface-container-high border border-white/5 focus:border-primary/50 focus:bg-surface-container-highest transition-all outline-none text-on-surface" placeholder="John Doe">
          </div>
        ` : ''}
        
        <div class="space-y-2">
          <label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40 ml-4">Work Email</label>
          <input type="email" id="email" required class="w-full px-6 py-4 rounded-2xl bg-surface-container-high border border-white/5 focus:border-primary/50 focus:bg-surface-container-highest transition-all outline-none text-on-surface" placeholder="name@aipassione.com">
        </div>

        <div class="space-y-2">
          <label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-outline opacity-40 ml-4">Password</label>
          <input type="password" id="password" required class="w-full px-6 py-4 rounded-2xl bg-surface-container-high border border-white/5 focus:border-primary/50 focus:bg-surface-container-highest transition-all outline-none text-on-surface" placeholder="••••••••">
        </div>

        <div id="auth-error" class="hidden text-xs text-error/80 bg-error/10 p-4 rounded-xl border border-error/20 text-center animate-shake"></div>

        <button type="submit" id="auth-submit" class="w-full py-5 rounded-2xl bg-primary text-on-primary font-bold text-[11px] uppercase tracking-[0.3em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-wait">
          ${mode === 'login' ? 'Sign In' : 'Get Started'}
        </button>
      </form>

      <div class="mt-10 text-center">
        <p class="text-xs text-outline opacity-40">
          ${mode === 'login' ? "Don't have an account?" : "Already have an account?"}
          <button id="auth-toggle" class="ml-1 text-primary font-bold hover:underline">
            ${mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    `;

    const form = card.querySelector('#auth-form') as HTMLFormElement;
    const toggle = card.querySelector('#auth-toggle');
    const errorEl = card.querySelector('#auth-error') as HTMLDivElement;
    const submitBtn = card.querySelector('#auth-submit') as HTMLButtonElement;

    toggle?.addEventListener('click', () => {
      mode = mode === 'login' ? 'signup' : 'login';
      updateForm();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.classList.add('hidden');
      submitBtn.disabled = true;

      const email = (card.querySelector('#email') as HTMLInputElement).value;
      const password = (card.querySelector('#password') as HTMLInputElement).value;
      
      try {
        let user;
        if (mode === 'login') {
          user = await api.login({ email, password });
        } else {
          const name = (card.querySelector('#name') as HTMLInputElement).value;
          user = await api.signup({ name, email, password });
        }
        store.setCurrentUser(user);
        store.setCurrentView('insights');
      } catch (err: any) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
      }
    });
  };

  updateForm();
  container.appendChild(card);
  return container;
}
