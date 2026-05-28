const MAX_TOASTS = 3;

let toastRoot;

export const initToast = (root) => {
  toastRoot = root;
};

export const showToast = (message, type = 'info') => {
  if (!toastRoot || !message) return;

  const normalized = String(message).replace(/\s+/g, ' ').trim();
  if (!normalized) return;

  while (toastRoot.children.length >= MAX_TOASTS) {
    toastRoot.firstElementChild?.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = normalized;
  toastRoot.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('is-visible'));
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 180);
  }, 3600);
};
