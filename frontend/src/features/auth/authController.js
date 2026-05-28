import * as authApi from '../../api/authApi.js';
import { setFormBusy, qs, qsa } from '../../ui/components.js';
import { showToast } from '../../ui/toast.js';
import { setToken, setUser } from '../../app/state.js';

const readForm = (form) => Object.fromEntries(new FormData(form).entries());

const showFormError = (root, selector, message) => {
  const error = qs(root, selector);
  if (error) error.textContent = message || '';
};

const validateAuthForm = (form) => {
  if (form.checkValidity()) return true;
  form.reportValidity();
  return false;
};

export const mountAuthPage = (root, { navigate }) => {
  const loginForm = qs(root, '#login-form');
  const registerForm = qs(root, '#register-form');
  const tabs = qsa(root, '[data-auth-mode]');

  const setMode = (mode) => {
    const isLogin = mode === 'login';
    loginForm.classList.toggle('is-hidden', !isLogin);
    registerForm.classList.toggle('is-hidden', isLogin);
    tabs.forEach((tab) => {
      const active = tab.dataset.authMode === mode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    showFormError(root, '#login-error', '');
    showFormError(root, '#register-error', '');
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.authMode));
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateAuthForm(loginForm)) return;

    const credentials = readForm(loginForm);
    setFormBusy(loginForm, true, 'ログイン中');
    showFormError(root, '#login-error', '');

    try {
      const result = await authApi.login(credentials);
      setToken(result.token);
      setUser(result.user);
      showToast('ログインしました', 'success');
      navigate('home');
    } catch (error) {
      showFormError(root, '#login-error', error.message);
    } finally {
      setFormBusy(loginForm, false);
    }
  });

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateAuthForm(registerForm)) return;

    const registration = readForm(registerForm);
    setFormBusy(registerForm, true, '作成中');
    showFormError(root, '#register-error', '');

    try {
      const result = await authApi.register(registration);
      setToken(result.token);
      setUser(result.user);
      showToast('SoraLogへようこそ', 'success');
      navigate('home');
    } catch (error) {
      showFormError(root, '#register-error', error.message);
    } finally {
      setFormBusy(registerForm, false);
    }
  });
};
