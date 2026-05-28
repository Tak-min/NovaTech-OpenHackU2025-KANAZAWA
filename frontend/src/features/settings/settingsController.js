import { getSettings, updateSettings } from '../../api/userApi.js';
import { getUserInfo } from '../../api/authApi.js';
import { clearSession, setSettings, setUser, state } from '../../app/state.js';
import { getPermissionState } from '../../services/geolocationService.js';
import { qs, setFormBusy, setText } from '../../ui/components.js';
import { showToast } from '../../ui/toast.js';

const setAlert = (root, message, type = 'info') => {
  const alert = qs(root, '#settings-alert');
  if (!alert) return;
  alert.textContent = message;
  alert.className = `state-message state-${type}`;
};

const renderUser = (root, user) => {
  setText(root, '#settings-username', user?.username || 'SoraLog user');
  setText(root, '#settings-email', user?.email || '--');
  const avatar = qs(root, '.profile-avatar');
  if (avatar) avatar.textContent = (user?.username || 'S').slice(0, 1).toUpperCase();
};

const renderSettings = (root, settings) => {
  qs(root, '#location-logging-enabled').checked = Boolean(settings.location_logging_enabled);
  qs(root, '#location-visibility-enabled').checked = Boolean(settings.location_visibility_enabled);
  qs(root, '#notification-enabled').checked = Boolean(settings.notification_enabled);
  qs(root, '#introduction-text').value = settings.introduction_text || '';
};

const loadBrowserPermission = async (root) => {
  const permission = await getPermissionState();
  const label = {
    granted: 'ブラウザの位置情報は許可されています。',
    denied: 'ブラウザの位置情報は拒否されています。自動取得を使うにはブラウザ設定から許可してください。',
    prompt: 'ホーム画面の自動取得が始まるときに、ブラウザが位置情報の許可を確認します。',
    unknown: 'ブラウザの位置情報許可は、ホーム画面の自動取得時に確認されます。'
  }[permission] || 'ブラウザの位置情報許可は、ホーム画面の自動取得時に確認されます。';
  setText(root, '#browser-permission', label);
};

export const mountSettingsPage = async (root, { navigate }) => {
  const form = qs(root, '#settings-form');
  const logoutButton = qs(root, '#logout-button');

  loadBrowserPermission(root);
  setAlert(root, '設定を読み込んでいます...', 'info');

  try {
    const [userResult, settings] = await Promise.all([
      state.user ? Promise.resolve({ user: state.user }) : getUserInfo(),
      getSettings()
    ]);
    const user = userResult.user || userResult;
    setUser(user);
    setSettings(settings);
    renderUser(root, user);
    renderSettings(root, settings);
    setAlert(root, '設定を読み込みました。', 'success');
  } catch (error) {
    setAlert(root, error.message || '設定を読み込めませんでした。', 'error');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setFormBusy(form, true, '保存中');
    setAlert(root, '設定を保存しています...', 'info');

    const settings = {
      location_logging_enabled: qs(root, '#location-logging-enabled').checked,
      location_visibility_enabled: qs(root, '#location-visibility-enabled').checked,
      notification_enabled: qs(root, '#notification-enabled').checked,
      introduction_text: qs(root, '#introduction-text').value
    };

    try {
      const result = await updateSettings(settings);
      const saved = result.settings || result;
      setSettings(saved);
      renderSettings(root, saved);
      setAlert(root, '設定を保存しました。', 'success');
      showToast('設定を保存しました', 'success');
    } catch (error) {
      setAlert(root, error.message || '設定を保存できませんでした。', 'error');
    } finally {
      setFormBusy(form, false);
    }
  });

  logoutButton.addEventListener('click', () => {
    clearSession();
    showToast('ログアウトしました', 'info');
    navigate('auth');
  });
};
