import { ROUTES } from './constants.js';
import { clearSession, isAuthenticated, setUser, state } from './state.js';
import { getUserInfo } from '../api/authApi.js';
import { renderAuthPage } from '../features/auth/authPage.js';
import { mountAuthPage } from '../features/auth/authController.js';
import { renderHomePage } from '../features/home/homePage.js';
import { mountHomePage } from '../features/home/homeController.js';
import { renderMapPage } from '../features/map/mapPage.js';
import { mountMapPage } from '../features/map/mapController.js';
import { renderRankingPage } from '../features/ranking/rankingPage.js';
import { mountRankingPage } from '../features/ranking/rankingController.js';
import { renderSettingsPage } from '../features/settings/settingsPage.js';
import { mountSettingsPage } from '../features/settings/settingsController.js';
import { initToast, showToast } from '../ui/toast.js';

const routeConfig = {
  [ROUTES.auth]: {
    title: 'SoraLog',
    render: renderAuthPage,
    mount: mountAuthPage,
    public: true
  },
  [ROUTES.home]: {
    title: 'ホーム',
    render: renderHomePage,
    mount: mountHomePage
  },
  [ROUTES.map]: {
    title: 'マップ',
    render: renderMapPage,
    mount: mountMapPage
  },
  [ROUTES.ranking]: {
    title: 'ランキング',
    render: renderRankingPage,
    mount: mountRankingPage
  },
  [ROUTES.settings]: {
    title: '設定',
    render: renderSettingsPage,
    mount: mountSettingsPage
  }
};

const renderShell = (root) => {
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <button type="button" class="brand-button" data-route="home" aria-label="ホームへ">
          <span class="brand-mark" aria-hidden="true"></span>
          <span>SoraLog</span>
        </button>
        <div class="topbar-user" id="topbar-user">ログイン前</div>
      </header>

      <main id="app-view" tabindex="-1"></main>

      <nav class="bottom-nav" id="bottom-nav" aria-label="メインナビゲーション">
        <button type="button" data-route="home" aria-label="ホーム">
          <span class="nav-icon home-icon" aria-hidden="true"></span>
          <span>ホーム</span>
        </button>
        <button type="button" data-route="map" aria-label="マップ">
          <span class="nav-icon map-icon" aria-hidden="true"></span>
          <span>マップ</span>
        </button>
        <button type="button" data-route="ranking" aria-label="ランキング">
          <span class="nav-icon ranking-icon" aria-hidden="true"></span>
          <span>ランキング</span>
        </button>
        <button type="button" data-route="settings" aria-label="設定">
          <span class="nav-icon settings-icon" aria-hidden="true"></span>
          <span>設定</span>
        </button>
      </nav>
    </div>
    <div id="toast-root" class="toast-root" aria-live="polite" aria-atomic="true"></div>
  `;
};

const updateShellForRoute = (root, routeName) => {
  const nav = root.querySelector('#bottom-nav');
  const topbarUser = root.querySelector('#topbar-user');
  const isAuthRoute = routeName === ROUTES.auth;

  nav.classList.toggle('is-hidden', isAuthRoute);
  root.querySelector('.topbar').classList.toggle('auth-topbar', isAuthRoute);
  if (topbarUser) {
    topbarUser.textContent = state.user?.username || (isAuthRoute ? 'ログイン前' : '読み込み中');
  }

  root.querySelectorAll('[data-route]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.route === routeName);
  });
};

const setDocumentTitle = (routeName) => {
  const title = routeConfig[routeName]?.title || 'SoraLog';
  document.title = `${title} | SoraLog`;
};

export const initApp = async () => {
  const root = document.querySelector('#app');
  renderShell(root);
  initToast(root.querySelector('#toast-root'));

  const view = root.querySelector('#app-view');

  const navigate = async (routeName) => {
    const config = routeConfig[routeName] || routeConfig[ROUTES.home];
    const targetRoute = !config.public && !isAuthenticated() ? ROUTES.auth : routeName;
    const targetConfig = routeConfig[targetRoute];

    state.currentRoute = targetRoute;
    updateShellForRoute(root, targetRoute);
    setDocumentTitle(targetRoute);
    view.innerHTML = targetConfig.render();
    view.scrollTo({ top: 0 });
    view.focus({ preventScroll: true });
    await targetConfig.mount(view, { navigate });
  };

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-route]');
    if (!button) return;
    const route = button.dataset.route;
    if (route === ROUTES.home && !isAuthenticated()) {
      navigate(ROUTES.auth);
      return;
    }
    navigate(route);
  });

  if (isAuthenticated()) {
    try {
      const result = await getUserInfo();
      setUser(result.user || result);
      await navigate(ROUTES.home);
    } catch (_) {
      clearSession();
      showToast('ログインし直してください', 'warning');
      await navigate(ROUTES.auth);
    }
  } else {
    await navigate(ROUTES.auth);
  }
};
