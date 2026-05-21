/**
 * Shared DOM utilities — centralised abstractions for patterns
 * that repeat across multiple component interactions.ts files.
 */

// ─── Button Loading State ────────────────────────────────────────────────────

/**
 * Wraps an async action with button loading state.
 * Disables the button, swaps its HTML to `loadingHtml`, runs the action,
 * then restores the original HTML regardless of success/failure.
 */
export async function withButtonLoading<T>(
  btn: HTMLButtonElement,
  loadingHtml: string,
  action: () => Promise<T>
): Promise<T | undefined> {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = loadingHtml;
  try {
    return await action();
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// ─── Full-screen Modal (appended to body) ────────────────────────────────────

/**
 * Creates a full-screen backdrop modal, appends it to `document.body`,
 * and returns the outer element. The caller is responsible for setting
 * `modal.innerHTML` and binding events.
 *
 * @param innerHtml  - Inner HTML string for the modal content
 * @param zIndex     - Tailwind z-index number (default 200)
 */
export function createModal(innerHtml: string, zIndex = 200): HTMLElement {
  const modal = document.createElement('div');
  modal.className = `fixed inset-0 z-[${zIndex}] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-reveal`;
  modal.innerHTML = innerHtml;
  document.body.appendChild(modal);
  return modal;
}

/**
 * Animates a modal out then removes it from the DOM.
 * For modals created with `createModal()`.
 *
 * @param animated - When false, removes immediately (useful for tests)
 */
export function closeModal(modal: HTMLElement, animated = true) {
  if (!animated) {
    modal.remove();
    return;
  }
  modal.classList.add('animate-out', 'fade-out');
  modal.firstElementChild?.classList.add('animate-out', 'zoom-out', 'slide-out-to-bottom-12');
  setTimeout(() => modal.remove(), 500);
}

// ─── Inline Panel Modal (hidden inside the component DOM) ────────────────────

/**
 * Shows an inline modal/panel that uses opacity + translate animation.
 * This is distinct from the full-screen `createModal` — it is part of the
 * component's own DOM, initially rendered as `hidden opacity-0`.
 */
export function showInlineModal(modal: HTMLElement) {
  modal.classList.remove('hidden');
  // Use rAF so the browser registers the removal of 'hidden' before the
  // transition begins — avoids the "instant flash" issue with setTimeout(0).
  requestAnimationFrame(() => {
    modal.classList.remove('opacity-0');
    modal.querySelector('div')?.classList.remove('translate-y-4');
  });
}

/**
 * Hides an inline panel with a fade + slide animation, then adds `hidden`.
 */
export function hideInlineModal(modal: HTMLElement, delay = 300) {
  modal.classList.add('opacity-0');
  modal.querySelector('div')?.classList.add('translate-y-4');
  setTimeout(() => modal.classList.add('hidden'), delay);
}

// ─── Inline Edit Toggle ───────────────────────────────────────────────────────

export interface InlineEditOptions {
  /** The root element containing all the selectors below */
  container: Element;
  /** Selector for the static display span */
  textSelector: string;
  /** Selector for the editable input */
  inputSelector: string;
  /** Selector for the "edit" trigger button */
  editBtnSelector: string;
  /** Called with the new value when the user saves (blur / Enter) */
  onSave: (newValue: string) => Promise<void>;
}

/**
 * Binds the span ↔ input toggle pattern for inline field editing.
 * Enter / blur saves; Escape cancels.
 */
export function bindInlineEdit(opts: InlineEditOptions) {
  const text = opts.container.querySelector(opts.textSelector) as HTMLSpanElement;
  const input = opts.container.querySelector(opts.inputSelector) as HTMLInputElement;
  const editBtn = opts.container.querySelector(opts.editBtnSelector) as HTMLButtonElement;

  if (!text || !input || !editBtn) return;

  const startEditing = () => {
    text.classList.add('hidden');
    editBtn.closest('div')?.classList.add('hidden');
    input.classList.remove('hidden');
    input.focus();
  };

  const stopEditing = async (save: boolean) => {
    if (input.classList.contains('hidden')) return;
    input.classList.add('hidden');
    text.classList.remove('hidden');
    editBtn.closest('div')?.classList.remove('hidden');
    if (save) await opts.onSave(input.value.trim());
  };

  text.addEventListener('click', startEditing);
  editBtn.addEventListener('click', startEditing);
  input.addEventListener('blur', () => stopEditing(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') stopEditing(true);
    else if (e.key === 'Escape') stopEditing(false);
  });
}
