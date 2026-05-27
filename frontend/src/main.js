import "./style.css";

// ================== API ベースURL設定 start ==================
const API_BASE = window.__API_BASE__
  || import.meta.env.VITE_API_BASE
  || (['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:3000'
    : 'https://soralog-backend.onrender.com');
const LOCATION_UPDATE_INTERVAL_MS  = 1 * 1000;
const LOCATION_POST_GUARD_MS = 800;
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0
};
const WATCH_POSITION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 10000
};
const LOCATION_POSITION_STALE_MS = 30 * 60 * 1000;
const LOCATION_REQUEST_RETRY_MS = 8 * 1000;
const LOCATION_ERROR_TOAST_COOLDOWN_MS = 30 * 1000;
const MAX_VISIBLE_TOASTS = 2;

// ================== API ベースURL設定 end ==================

const pages = document.querySelectorAll('main > section');
const navButtons = document.querySelectorAll('.nav-button');
const headerTitle = document.getElementById('header-title');
const footerNav = document.getElementById('footer-nav');
const toastRoot = document.getElementById('toast-root');
let currentPageId = null;
let pendingHomeStatusData = null;
let homeStatusRequestId = 0;
let rankingRequestId = 0;
let isLocationLoggingEnabled = false;
let lastUserSettings = null;
let lastLocationPostAt = 0;
let isLocationPostInFlight = false;
let lastKnownPosition = null;
let lastKnownPositionAt = 0;
let isGeolocationRequestInFlight = false;
let lastGeolocationRequestAt = 0;
let lastLocationErrorToastAt = 0;

function showToast(message, type = 'info') {
  if (!toastRoot || !message) return;

  const normalizedMessage = String(message).replace(/\s+/g, ' ').trim();
  if (!normalizedMessage) return;

  const existingDuplicate = Array.from(toastRoot.children).some(
    toast => toast.textContent === normalizedMessage
  );
  if (existingDuplicate) return;

  const visibleToasts = Array.from(toastRoot.children);
  while (visibleToasts.length >= MAX_VISIBLE_TOASTS) {
    visibleToasts.shift()?.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = normalizedMessage;
  toastRoot.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 220);
  }, 3600);
}

function notify(message, type = 'info') {
  showToast(String(message || ''), type);
}

function getCurrentPositionOnce(options = GEOLOCATION_OPTIONS) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function showLocationPermissionPrompt() {
  return new Promise((resolve) => {
    document.getElementById('location-permission-prompt')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'location-permission-prompt';
    overlay.className = 'location-permission-prompt';
    overlay.innerHTML = `
      <div class="location-permission-card" role="dialog" aria-modal="true" aria-labelledby="location-permission-title">
        <p class="eyebrow">First log</p>
        <h2 id="location-permission-title">位置情報を使って天気ログを始めますか？</h2>
        <p>許可すると現在地の天気を記録し、称号とランキングにすぐ反映できます。</p>
        <div class="location-permission-actions">
          <button type="button" class="main-btn" data-action="allow">位置情報を許可する</button>
          <button type="button" class="link-btn" data-action="later">あとで設定する</button>
        </div>
      </div>
    `;

    const close = (allowed) => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 180);
      resolve(allowed);
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(false);
    });
    overlay.querySelector('[data-action="allow"]')?.addEventListener('click', () => close(true));
    overlay.querySelector('[data-action="later"]')?.addEventListener('click', () => close(false));

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
  });
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch (_) {
    return {};
  }
}

function setFormSubmitting(form, isSubmitting, busyText = '送信中...') {
  if (!form) return;
  const submitButton = form.querySelector('button[type="submit"]');
  form.dataset.submitting = isSubmitting ? 'true' : 'false';
  form.querySelectorAll('button, input').forEach(element => {
    element.disabled = isSubmitting;
  });

  if (submitButton) {
    if (!submitButton.dataset.defaultText) {
      submitButton.dataset.defaultText = submitButton.textContent;
    }
    submitButton.textContent = isSubmitting ? busyText : submitButton.dataset.defaultText;
  }
}

function setActiveNavByPageId(pageId) {
  const pageName = pageId ? pageId.replace(/^page-/, '') : '';
  navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageName);
  });
  updateFooterIconStates();
}

function goToPage(pageId, options = {}) {
  showPage(pageId, options);
  setActiveNavByPageId(pageId);
}

let loadingPopupShownAt = 0;
let loadingPopupHideTimer = null;

function showLoadingPopup(message = '読み込み中...') {
  let popup = document.getElementById('loading-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'loading-popup';
    popup.innerHTML = '<div class="loading-popup-card"><div class="loading-spinner" aria-hidden="true"></div><p></p></div>';
    document.body.appendChild(popup);
  }

  const messageElement = popup.querySelector('p');
  if (messageElement) messageElement.textContent = message;
  if (loadingPopupHideTimer) {
    clearTimeout(loadingPopupHideTimer);
    loadingPopupHideTimer = null;
  }
  loadingPopupShownAt = Date.now();
  popup.classList.add('show');
}

function hideLoadingPopup(minVisibleMs = 650) {
  const popup = document.getElementById('loading-popup');
  if (!popup) return;
  const elapsed = Date.now() - loadingPopupShownAt;
  const remaining = Math.max(0, minVisibleMs - elapsed);
  if (loadingPopupHideTimer) {
    clearTimeout(loadingPopupHideTimer);
  }
  loadingPopupHideTimer = setTimeout(() => {
    popup.classList.remove('show');
    loadingPopupHideTimer = null;
  }, remaining);
}

// 位置情報追跡用の変数
let locationWatchId = null;
let locationUpdateIntervalId = null; // 定期更新用のID
let mapMarkersUpdateIntervalId = null; // マップマーカー定期更新用のID
let mapLocationWatchId = null;

// 選択された画像データを保存する変数（TDZ回避のため var）
let selectedImageData = null;

let leafletMap = null;
let userMarkers = [];
let currentLocationMarker = null;
let currentMapPosition = null;

const DEFAULT_MAP_CENTER = [36.2048, 138.2529];
const DEMO_STATUSES = ['太陽神', '晴れ男', '晴れ女', '凡人', '雨男', '雨女', '嵐を呼ぶ者'];
const DEMO_WEATHER_BY_STATUS = {
  '太陽神': 'sunny',
  '晴れ男': 'sunny',
  '晴れ女': 'sunny',
  '凡人': 'cloudy',
  '雨男': 'rainy',
  '雨女': 'rainy',
  '嵐を呼ぶ者': 'stormy'
};
const DEMO_SCORE_BY_STATUS = {
  '太陽神': [520, 820],
  '晴れ男': [120, 360],
  '晴れ女': [120, 360],
  '凡人': [-60, 80],
  '雨男': [-360, -120],
  '雨女': [-360, -120],
  '嵐を呼ぶ者': [-820, -520]
};
const DEMO_MAP_POINTS = [
  ['さくら', 43.0642, 141.3469], ['陽菜', 40.8244, 140.74], ['美咲', 38.2682, 140.8694],
  ['結衣', 37.9161, 139.0364], ['葵', 36.6513, 138.181], ['凛', 36.5613, 136.6562],
  ['七海', 35.6812, 139.7671], ['優花', 35.4437, 139.638], ['琴音', 35.1709, 136.8815],
  ['紗良', 34.9858, 135.7588], ['芽衣', 34.6937, 135.5023], ['莉子', 34.3853, 132.4553],
  ['花音', 33.5904, 130.4017], ['彩乃', 32.7898, 130.7417], ['真央', 31.5966, 130.5571],
  ['絵里', 26.2124, 127.6809], ['拓海', 43.7706, 142.365], ['悠斗', 39.7036, 141.1527],
  ['颯太', 36.3418, 140.4468], ['蓮', 35.8617, 139.6455], ['湊', 35.0116, 135.7681],
  ['大翔', 34.6851, 135.8048], ['直樹', 34.0658, 134.5593], ['翔', 33.8392, 132.7657],
  ['海斗', 33.2494, 130.2988], ['蒼', 32.7503, 129.8777], ['千尋', 35.0212, 135.7556],
  ['瑞希', 36.6953, 137.2113], ['杏奈', 35.5011, 134.2351], ['遥', 35.4681, 133.0484]
];
const DEMO_USERS = DEMO_MAP_POINTS.map(([username, latitude, longitude], index) => {
  const status = DEMO_STATUSES[Math.floor(Math.random() * DEMO_STATUSES.length)];
  const [minScore, maxScore] = DEMO_SCORE_BY_STATUS[status];
  return {
    id: `demo-${index + 1}`,
    username,
    latitude,
    longitude,
    status,
    weather: DEMO_WEATHER_BY_STATUS[status] || 'cloudy',
    score: Math.round(minScore + Math.random() * (maxScore - minScore)),
    recordedAt: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 4).toISOString(),
    isDemo: true
  };
});

// 画像名の天気表現に合わせてマーカー画像を対応付ける。
// yellow/sunny=晴れ、rainy=雨、snow=雪、kaze=荒天、nomal=通常/不明。
const MARKER_IMAGE_BY_WEATHER = {
  sunny: './img/map-very-yellow.png',
  cloudy: './img/pin-nomal.PNG',
  rainy: './img/pin-rainy.PNG',
  snowy: './img/map-snow.png',
  thunderstorm: './img/map-kaze.png',
  stormy: './img/map-kaze.png',
  unknown: './img/pin-nomal.PNG'
};

const MARKER_IMAGE_BY_STATUS = {
  '太陽神': './img/map-very-yellow.png',
  '晴れ男': './img/pin-sunny.PNG',
  '晴れ女': './img/pin-sunny.PNG',
  '凡人': './img/pin-nomal.PNG',
  '雨男': './img/pin-rainy.PNG',
  '雨女': './img/pin-rainy.PNG',
  '嵐を呼ぶ者': './img/map-kaze.png',
  unknown: './img/pin-nomal.PNG'
};

// フッターのアイコンsrcを期待どおりに補正する（存在しない場合はスキップ）
function ensureFooterIconPaths() {
  const expected = {
    home: './img/home.png',
    map: './img/map.png',
    ranking: './img/ranking.png',
    settings: './img/setting.png'
  };
  document.querySelectorAll('#footer-nav .nav-button').forEach(btn => {
    const page = btn.getAttribute('data-page');
    const img = btn.querySelector('img.icon');
    if (!img) return;
    const should = expected[page];
    if (!should) return;
    const current = img.getAttribute('src');
    if (current !== should) {
      img.setAttribute('src', should);
    }
  });
}

// フッターアイコンのアクティブ状態を更新する関数
function updateFooterIconStates() {
  const iconPaths = {
    home: {
      normal: './img/home.png',
      active: './img/home-yellow.png'
    },
    map: {
      normal: './img/map.png',
      active: './img/map-yellow.png'
    },
    ranking: {
      normal: './img/ranking.png',
      active: './img/ranking-yellow.png'
    },
    settings: {
      normal: './img/setting.png',
      active: './img/setting-yellow.png'
    }
  };

  document.querySelectorAll('#footer-nav .nav-button').forEach(btn => {
    const page = btn.getAttribute('data-page');
    const img = btn.querySelector('img.icon');
    if (!img || !iconPaths[page]) return;

    const isActive = btn.classList.contains('active');
    const newSrc = isActive ? iconPaths[page].active : iconPaths[page].normal;

    if (img.getAttribute('src') !== newSrc) {
      img.setAttribute('src', newSrc);
    }
  });
}

// 既存の loadUserInfo を呼ぶ薄いラッパー（後方互換）
function updateUserInfo() {
  if (typeof loadUserInfo === 'function') {
    loadUserInfo();
  }
}

function showPage(pageId, { force = false } = {}) {
  if (!force && currentPageId === pageId) {
    const mainElement = document.querySelector('main');
    if (mainElement) mainElement.scrollTop = 0;
    setActiveNavByPageId(pageId);
    return;
  }

  pages.forEach(page => page.classList.add('hidden'));

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.remove('hidden');
  }
  currentPageId = pageId;

  const mainElement = document.querySelector('main');
  if (mainElement) mainElement.scrollTop = 0;

  // ログイン・新規登録画面ではフッターを非表示
  if (pageId === 'page-login' || pageId === 'page-register') {
    footerNav.classList.add('hidden');
    showHeaderImage(null);
  } else {
    footerNav.classList.remove('hidden');
    // フッターが表示されるタイミングでアイコンのsrcを再設定し、エラーハンドリングを設定
    setTimeout(() => {
      ensureFooterIconPaths();
      updateFooterIconStates(); // アクティブ状態に応じたアイコン更新
      setupFooterIconErrorHandling();
    }, 100);
  }

  // ヘッダー画像の切り替え
  if (pageId === 'page-home') {
    showHeaderImage('home');
    updateHomePageStatus();
  }
  else if (pageId === 'page-map') {
    showHeaderImage('map');
    // マップページが表示されたら地図を初期化し、マーカー更新を開始
    setTimeout(initializeMap, 100);
  }
  else if (pageId === 'page-ranking') {
    showHeaderImage('ranking');
    // ランキングページが表示されたらデータを更新
    updateRankingPage();
  }
  else if (pageId === 'page-settings') {
    showHeaderImage('settings');
    initializeSettingsPage();
  }
  else showHeaderImage(null);

  if (pageId !== 'page-map') {
    stopMapLocationTracking();
  }

  // ヘッダータイトルの更新
  const titles = {
    'page-login': 'ログイン',
    'page-register': '新規登録',
    'page-home': 'ホーム',
    'page-map': 'マップ',
    'page-ranking': 'ランキング',
    'page-settings': '設定'
  };
  headerTitle.textContent = titles[pageId] || 'Hare/Ame';

  // #appにクラスを付け替える
  const app = document.getElementById('app');
  if (pageId === 'page-home' || pageId === 'page-map' || pageId === 'page-ranking' || pageId === 'page-settings') {
    app.classList.add('bg-sky');
  } else {
    app.classList.remove('bg-sky');
  }
}

const headerImgContainer = document.getElementById('header-img-container');
const headerImg = document.getElementById('header-img');

function showHeaderImage(type) {
  const images = {
    home: './img/header-home.png',
    map: './img/header-map.png',
    ranking: './img/header-ranking.png',
    settings: './img/header-setting.png',
  };

  if (type && images[type]) {
    // 画像読み込み前に現在のsrcをクリア
    headerImg.src = '';
    headerImg.onerror = function () {
      console.error(`ヘッダー画像の読み込みに失敗しました: ${images[type]}`);
      // 画像読み込み失敗時はタイトルを表示
      headerImgContainer.style.display = 'none';
      headerTitle.style.display = 'block';
      headerTitle.textContent = getPageTitle(type);
    };
    headerImg.src = images[type];
    headerImgContainer.style.display = 'block';
    headerTitle.style.display = 'none';
  } else {
    headerImgContainer.style.display = 'none';
    headerTitle.style.display = 'block';
  }
}

// ページタイプからタイトルを取得するヘルパー関数
function getPageTitle(type) {
  const titles = {
    home: 'ホーム',
    map: 'マップ',
    ranking: 'ランキング',
    settings: '設定'
  };
  return titles[type] || 'Hare/Ame';
}

// フッターアイコンの読み込みエラーを処理する関数
function setupFooterIconErrorHandling() {
  const footerIcons = document.querySelectorAll('#footer-nav .icon');

  footerIcons.forEach(icon => {
    // 既にイベントハンドラーが設定されている場合はスキップ
    if (icon.hasAttribute('data-error-handler-set')) {
      return;
    }

    // 既存のイベントリスナーをクリア
    icon.onerror = null;
    icon.onload = null;

    icon.onerror = function () {
      console.error(`フッターアイコンの読み込みに失敗しました: ${this.src}`);
      // 画像読み込み失敗時はアイコンを非表示にしてテキストのみ表示
      this.style.display = 'none';
      const button = this.parentElement;
      if (button) {
        const span = button.querySelector('span');
        if (span) {
          span.style.fontSize = '14px';
          span.style.fontWeight = 'bold';
          span.style.color = '#333'; // テキストを目立たせる
        }
        // ボタンのスタイルも調整
        button.style.flexDirection = 'column';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.padding = '8px';
      }
    };

    icon.onload = function () {
      // 正常に読み込まれた場合は表示を確実に有効化
      this.style.display = 'block';
      const button = this.parentElement;
      if (button) {
        const span = button.querySelector('span');
        if (span) {
          span.style.fontSize = ''; // デフォルトに戻す
          span.style.fontWeight = '';
          span.style.color = '';
        }
        // ボタンのスタイルもデフォルトに戻す
        button.style.flexDirection = '';
        button.style.alignItems = '';
        button.style.justifyContent = '';
        button.style.padding = '';
      }
    };

    // 画像の読み込み状態を強制的に確認
    if (icon.complete) {
      if (icon.naturalHeight === 0) {
        // 画像が壊れている場合
        icon.onerror();
      } else {
        // 正常に読み込まれている場合
      }
    }

    // エラーハンドラー設定完了フラグを設定
    icon.setAttribute('data-error-handler-set', 'true');
  });
}

// (startLocationTracking, stopLocationTracking, registerForm logic... is unchanged)

async function requestLoginToken(email, password) {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  const data = await readJsonSafe(response);
  return response.ok ? data.token : null;
}

async function completeLogin(token) {
  if (!token) return false;

  localStorage.setItem('token', token);
  footerNav.classList.remove('hidden');
  goToPage('page-home', { force: true });
  return true;
}

function handleRegisterConflict(data, email) {
  if (data.field === 'email') {
    notify(data.message || 'このメールアドレスは登録済みです。ログインしてください', 'warning');
    const loginEmailInput = document.getElementById('login-email');
    if (loginEmailInput) loginEmailInput.value = email;
    goToPage('page-login');
    return;
  }

  notify(data.message || '登録内容が既に使われています。別の内容で試してください', 'warning');
}

function describeLocationError(error) {
  if (error?.code === error.PERMISSION_DENIED) {
    return 'ブラウザ側で位置情報が拒否されました。アドレスバーの設定から許可してください。';
  }
  if (error?.code === error.POSITION_UNAVAILABLE) {
    return '位置情報を取得できませんでした。GPSやネットワーク設定を確認してください。';
  }
  if (error?.code === error.TIMEOUT) {
    return '位置情報の取得がタイムアウトしました。もう一度お試しください。';
  }
  return '位置情報を取得できませんでした。あとから設定でONにできます。';
}

function rememberPosition(position) {
  if (!position?.coords) return null;

  const latitude = Number(position.coords.latitude);
  const longitude = Number(position.coords.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  lastKnownPosition = {
    latitude,
    longitude,
    accuracy: Number(position.coords.accuracy || 0),
    timestamp: position.timestamp || Date.now()
  };
  lastKnownPositionAt = Date.now();
  syncCurrentMapPositionFromKnown();
  return lastKnownPosition;
}

function hasRecentKnownPosition() {
  return Boolean(lastKnownPosition && Date.now() - lastKnownPositionAt <= LOCATION_POSITION_STALE_MS);
}

function notifyLocationError(message, type = 'warning') {
  const now = Date.now();
  if (now - lastLocationErrorToastAt < LOCATION_ERROR_TOAST_COOLDOWN_MS) return;
  lastLocationErrorToastAt = now;
  notify(message, type);
}

function disableLocationLoggingFromPermissionError() {
  isLocationLoggingEnabled = false;
  lastLocationPostAt = 0;
  lastKnownPosition = null;
  lastKnownPositionAt = 0;
  stopPeriodicLocationUpdate();
  stopLocationTracking();

  const locationSwitch = document.getElementById('location-switch');
  if (locationSwitch) {
    locationSwitch.checked = false;
    saveUserSettings();
  }
  updateLocationSwitch();
}

function handleGeolocationFailure(error, { notifyErrors = false } = {}) {
  if (error?.code === error.PERMISSION_DENIED) {
    disableLocationLoggingFromPermissionError();
    notifyLocationError(describeLocationError(error), 'warning');
    return;
  }

  if (notifyErrors && !hasRecentKnownPosition()) {
    notifyLocationError(describeLocationError(error), 'warning');
  }
}

async function requestPositionForLogging({ notifyErrors = false, force = false } = {}) {
  if (!navigator.geolocation) {
    if (notifyErrors) notifyLocationError('このブラウザは位置情報に対応していません。', 'warning');
    return null;
  }

  const now = Date.now();
  if (isGeolocationRequestInFlight) return null;
  if (!force && now - lastGeolocationRequestAt < LOCATION_REQUEST_RETRY_MS) return null;

  isGeolocationRequestInFlight = true;
  lastGeolocationRequestAt = now;

  try {
    const position = await getCurrentPositionOnce(GEOLOCATION_OPTIONS);
    return rememberPosition(position);
  } catch (error) {
    handleGeolocationFailure(error, { notifyErrors });
    return null;
  } finally {
    isGeolocationRequestInFlight = false;
  }
}

async function promptAndEnableLocationLogging() {
  const shouldEnable = await showLocationPermissionPrompt();
  if (!shouldEnable) {
    notify('位置情報ログはあとから設定でONにできます', 'info');
    return;
  }

  try {
    const position = await getCurrentPositionOnce();
    const rememberedPosition = rememberPosition(position);
    const locationSwitch = document.getElementById('location-switch');
    if (locationSwitch) locationSwitch.checked = true;

    const saved = await saveUserSettings({
      notifyOnSuccess: false,
      successMessage: '位置情報ログをONにしました'
    });

    if (!saved) {
      if (locationSwitch) locationSwitch.checked = false;
      notify('位置情報設定の保存に失敗しました', 'error');
      return;
    }

    isLocationLoggingEnabled = true;
    lastLocationPostAt = 0;
    if (rememberedPosition) {
      await postLocationToServer(rememberedPosition.latitude, rememberedPosition.longitude, {
        source: '登録直後の位置情報',
        notifyErrors: true
      });
    }
    startLocationTracking();
    startPeriodicLocationUpdate({ runImmediately: false });
    updateLocationSwitch();
    notify('位置情報ログを開始しました', 'success');
  } catch (error) {
    notify(describeLocationError(error), 'warning');
  }
}

const registerForm = document.getElementById('register-form');
registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (registerForm.dataset.submitting === 'true') return;

  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim().toLowerCase();
  const password = document.getElementById('register-password').value;
  const genderElement = document.querySelector('input[name="gender"]:checked');


  // クライアントサイドのバリデーション
  if (username.length < 3 || username.length > 50) {
    notify('ユーザー名は3文字以上50文字以下で入力してください', 'warning');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    notify('有効なメールアドレスを入力してください', 'warning');
    return;
  }

  if (password.length < 6) {
    notify('パスワードは6文字以上で入力してください', 'warning');
    return;
  }

  // 性別が選択されているかチェック
  if (!genderElement) {
    notify('性別を選択してください', 'warning');
    return;
  }
  const gender = genderElement.value;


  setFormSubmitting(registerForm, true, '登録中...');
  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, gender }),
    });


    const data = await readJsonSafe(response);

    if (data.registered === false || data.code === 'EMAIL_ALREADY_EXISTS' || data.code === 'USERNAME_UNAVAILABLE') {
      handleRegisterConflict(data, email);
    } else if (response.ok) {
      const token = data.token || await requestLoginToken(email, password);
      const loggedIn = await completeLogin(token);
      notify(data.user?.username && data.user.username !== username
        ? `登録しました。表示名は ${data.user.username} です。`
        : data.message || '登録しました。', 'success');
      registerForm.reset();
      if (loggedIn) {
        promptAndEnableLocationLogging();
      } else {
        goToPage('page-login');
      }
    } else if (response.status === 409) {
      handleRegisterConflict(data, email);
    } else {
      notify(data.message || '登録に失敗しました', 'error');
    }
  } catch (error) {
    console.error('=== FRONTEND REGISTER ERROR ===');
    console.error('Network error during registration:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    notify('サーバーとの通信に失敗しました。ネットワーク接続を確認してください。', 'error');
  } finally {
    setFormSubmitting(registerForm, false);
  }
});

async function checkLoginStatus() {
  const token = localStorage.getItem('token');

  if (!token) {
    footerNav.classList.add('hidden');
    isLocationLoggingEnabled = false;
    lastLocationPostAt = 0;
    lastKnownPosition = null;
    lastKnownPositionAt = 0;
    stopPeriodicLocationUpdate();
    stopLocationTracking();
    goToPage('page-login');
    return;
  }


  try {
    const response = await fetch(`${API_BASE}/status`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}` // 修正
      }
    });


    if (response.ok) {
      pendingHomeStatusData = await readJsonSafe(response);
      footerNav.classList.remove('hidden');
      goToPage('page-home');
      refreshLocationLoggingFromSettings({ notifyErrors: false });
    } else {
      localStorage.removeItem('token');
      footerNav.classList.add('hidden');
      isLocationLoggingEnabled = false;
      lastLocationPostAt = 0;
      lastKnownPosition = null;
      lastKnownPositionAt = 0;
      stopPeriodicLocationUpdate();
      stopLocationTracking();
      goToPage('page-login');
    }

  } catch (error) {
    console.error('Failed to verify token. Error:', error); // 修正
    footerNav.classList.add('hidden');
    isLocationLoggingEnabled = false;
    lastLocationPostAt = 0;
    lastKnownPosition = null;
    lastKnownPositionAt = 0;
    stopPeriodicLocationUpdate();
    stopLocationTracking();
    goToPage('page-login');
  }
}

async function getUserGender() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE}/user/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const userData = await response.json();
      return userData.gender; // 'male' or 'female'
    } else {
      console.error('genderの取得に失敗しました');
      return null;
    }
  } catch (error) {
    console.error('genderの取得エラー:', error);
    return null;
  }
}


function setElementText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function setHomeState(message = '', type = 'info') {
  const stateElement = document.getElementById('home-state-message');
  if (!stateElement) return;
  stateElement.textContent = message;
  stateElement.dataset.state = type;
  stateElement.classList.toggle('hidden', !message);
}

function resetWeatherGauge() {
  setElementText('weather-gauge-value', '--');
  const weatherGaugeFill = document.getElementById('weather-gauge-fill');
  const weatherGaugeZero = document.getElementById('weather-gauge-zero');
  if (weatherGaugeFill) {
    weatherGaugeFill.style.width = '0px';
    weatherGaugeFill.style.left = '50%';
    weatherGaugeFill.style.right = 'auto';
  }
  if (weatherGaugeZero) {
    weatherGaugeZero.style.left = '50%';
  }
}

function renderHomeLoading() {
  setHomeState('最新の天気ログを読み込んでいます...', 'info');
  setElementText('status-text', '判定中...');
  setElementText('status-reason', '天気ログを集計中です');
  setElementText('missed-train-counter', '電車に乗り遅れた回数: --回');
  setElementText('weather-total-records', '--');
  setElementText('weather-positive-rate', '--');
  setElementText('weather-negative-rate', '--');
  resetWeatherGauge();
}

function renderHomeError(message) {
  setHomeState(message || 'ホーム情報を取得できませんでした', 'error');
  setElementText('status-text', '取得失敗');
  setElementText('status-reason', '通信状態を確認して、もう一度開き直してください。');
  setElementText('missed-train-counter', '電車に乗り遅れた回数: --回');
  setElementText('weather-total-records', '--');
  setElementText('weather-positive-rate', '--');
  setElementText('weather-negative-rate', '--');
  resetWeatherGauge();
}

function getStatusImagePath(score, gender) {
  if (score < 0) {
    return gender === 'female' ? './img/ame_f.png' : './img/ame_m.png';
  }
  return gender === 'female' ? './img/hare_f.png' : './img/hare_m.png';
}

async function renderHomeStatus(data) {
  const statusTextElement = document.getElementById('status-text');
  const statusImageElement = document.getElementById('status-image');
  const statusReasonElement = document.getElementById('status-reason');

  if (!statusTextElement || !statusImageElement) return;

  const score = Number(data.score || 0);
  const stats = data.stats || {};
  const totalRecords = Number(stats.totalRecords || 0);
  const positiveRate = Number(stats.positiveRate || 0);
  const negativeRate = Number(stats.negativeRate || 0);

  setHomeState('', 'info');
  statusTextElement.textContent = `${data.status || '凡人'}`;
  if (statusReasonElement) {
    statusReasonElement.textContent = data.statusReason || '天気ログを集計中です';
  }

  const gender = await getUserGender();
  statusImageElement.src = getStatusImagePath(score, gender);
  statusImageElement.alt = `${data.status || '天気ジンクス'}の判定イラスト`;

  setElementText('missed-train-counter', `電車に乗り遅れた回数: ${Number(data.missedTrainCount || 0)}回`);
  setElementText('weather-total-records', `${totalRecords}件`);
  setElementText('weather-positive-rate', `${positiveRate}%`);
  setElementText('weather-negative-rate', `${negativeRate}%`);
  updateWeatherGaugeFromScore(score);
}

async function updateHomePageStatus() {
  const token = localStorage.getItem('token');
  if (!token) {
    return;
  }

  const requestId = ++homeStatusRequestId;
  renderHomeLoading();

  try {
    let data = pendingHomeStatusData;
    pendingHomeStatusData = null;

    if (!data) {
      const response = await fetch(`${API_BASE}/status`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });


      if (!response.ok) {
        const errorData = await readJsonSafe(response);
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      data = await readJsonSafe(response);
    }

    if (requestId !== homeStatusRequestId) return;
    await renderHomeStatus(data);
  } catch (error) {
    console.error('updateHomePageStatus: エラー発生', error);
    if (requestId === homeStatusRequestId) {
      renderHomeError('ホーム情報の取得に失敗しました');
      notify('ホーム情報の取得に失敗しました', 'error');
    }
  }
}

// totalScore を元に #weather-gauge-fill と #weather-gauge-value を更新するヘルパー
function updateWeatherGaugeFromScore(totalScore) {
  const weatherGaugeValue = document.getElementById('weather-gauge-value');
  const weatherGaugeBar = document.getElementById('weather-gauge-bar');
  const weatherGaugeFill = document.getElementById('weather-gauge-fill');
  const weatherGaugeZero = document.getElementById('weather-gauge-zero');

  if (!weatherGaugeValue || !weatherGaugeBar || !weatherGaugeFill || !weatherGaugeZero) {
    return;
  }

  // 表示用の値は整数で表示
  weatherGaugeValue.textContent = Math.round(totalScore);

  const maxAbs = 1000; // 見た目上の最大スコア
  const barWidth = weatherGaugeBar.clientWidth || 200;

  // 値を -maxAbs .. +maxAbs の範囲にクランプ
  const clamped = Math.max(-maxAbs, Math.min(maxAbs, totalScore));
  let fillWidth = Math.abs(clamped) / maxAbs * (barWidth / 2);
  fillWidth = Math.min(fillWidth, barWidth / 2);

  weatherGaugeFill.style.width = fillWidth + 'px';
  // 色は既存の getGaugeColor を利用（値を 0..2*maxAbs に変換）
  weatherGaugeFill.style.background = getGaugeColor(clamped + maxAbs, 0, maxAbs * 2);
  weatherGaugeZero.style.left = (barWidth / 2 - 1) + 'px';

  if (clamped >= 0) {
    weatherGaugeFill.style.left = (barWidth / 2) + 'px';
    weatherGaugeFill.style.right = 'auto';
    weatherGaugeFill.classList.remove('left');
    weatherGaugeFill.classList.add('right');
  } else {
    weatherGaugeFill.style.left = 'auto';
    weatherGaugeFill.style.right = (barWidth / 2) + 'px';
    weatherGaugeFill.classList.remove('right');
    weatherGaugeFill.classList.add('left');
  }
}

function getGaugeColor(value, min, max) {
  const ratio = (value - min) / (max - min);
  let r, g, b;

  if (ratio <= 0.5) {
    r = Math.round(33 + (76 - 33) * (ratio / 0.5));
    g = Math.round(150 + (175 - 150) * (ratio / 0.5));
    b = Math.round(243 + (80 - 243) * (ratio / 0.5));
  } else {
    r = Math.round(76 + (229 - 76) * ((ratio - 0.5) / 0.5));
    g = Math.round(175 + (57 - 175) * ((ratio - 0.5) / 0.5));
    b = Math.round(80 + (53 - 80) * ((ratio - 0.5) / 0.5));
  }

  return `rgb(${r},${g},${b})`;
}

const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (loginForm.dataset.submitting === 'true') return;
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  // クライアントサイドのバリデーション
  if (!email || !password) {
    notify('メールアドレスとパスワードを入力してください', 'warning');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    notify('有効なメールアドレスを入力してください', 'warning');
    return;
  }


  setFormSubmitting(loginForm, true, 'ログイン中...');
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include', // 認証情報を含める
    });


    const data = await readJsonSafe(response);

    if (response.ok) {
      notify(data.message || 'ログインしました', 'success');
      localStorage.setItem('token', data.token);

      // ログイン成功時にフッターを表示し、ホームへ遷移
      footerNav.classList.remove('hidden');
      goToPage('page-home', { force: true });
      refreshLocationLoggingFromSettings({ notifyErrors: true });
    } else {
      notify(data.message || 'ログインに失敗しました', 'error');
    }
  } catch (error) {
    console.error('=== FRONTEND LOGIN ERROR ===');
    console.error('Network error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    notify('サーバーとの通信に失敗しました。ネットワーク接続を確認してください。', 'error');
  } finally {
    setFormSubmitting(loginForm, false);
  }
});

navButtons.forEach(button => {
  button.addEventListener('click', () => {
    const pageId = `page-${button.dataset.page}`;
    goToPage(pageId);
  });
});

document.getElementById('show-register-button').addEventListener('click', () => goToPage('page-register'));
document.getElementById('show-login-button').addEventListener('click', () => goToPage('page-login'));

document.getElementById('home-map-button')?.addEventListener('click', () => goToPage('page-map'));
document.getElementById('home-ranking-button')?.addEventListener('click', () => goToPage('page-ranking'));
document.getElementById('account-change-button')?.addEventListener('click', () => {
  notify('メールアドレスとパスワードの変更は準備中です', 'info');
});

// ログアウト処理
const logoutBtn = document.getElementById('logout-button');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    isLocationLoggingEnabled = false;
    lastLocationPostAt = 0;
    lastKnownPosition = null;
    lastKnownPositionAt = 0;
    stopPeriodicLocationUpdate(); // 定期更新を停止
    stopLocationTracking(); // 位置情報追跡を停止
    stopMapMarkersUpdate(); // マップマーカー更新を停止
    goToPage('page-login', { force: true });
    notify('ログアウトしました', 'success');
  });
}

async function postLocationToServer(latitude, longitude, { source = '位置情報送信', notifyErrors = false } = {}) {
  const token = localStorage.getItem('token');
  if (!token) {
    stopPeriodicLocationUpdate();
    stopLocationTracking();
    return { ok: false, skipped: true, reason: 'missing_token' };
  }

  if (!isLocationLoggingEnabled) {
    return { ok: false, skipped: true, reason: 'disabled' };
  }

  const normalizedLatitude = Number(latitude);
  const normalizedLongitude = Number(longitude);
  if (
    !Number.isFinite(normalizedLatitude) ||
    !Number.isFinite(normalizedLongitude) ||
    normalizedLatitude < -90 ||
    normalizedLatitude > 90 ||
    normalizedLongitude < -180 ||
    normalizedLongitude > 180
  ) {
    console.error(`${source}スキップ: 緯度経度が不正です`, { latitude, longitude });
    if (notifyErrors) notifyLocationError('取得した位置情報の値が不正です', 'error');
    return { ok: false, skipped: true, reason: 'invalid_coordinates' };
  }

  const now = Date.now();
  if (isLocationPostInFlight) {
    return { ok: false, skipped: true, reason: 'in_flight' };
  }

  if (lastLocationPostAt && now - lastLocationPostAt < LOCATION_POST_GUARD_MS) {
    return { ok: false, skipped: true, reason: 'client_interval' };
  }

  isLocationPostInFlight = true;

  try {
    const response = await fetch(`${API_BASE}/log-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        latitude: normalizedLatitude,
        longitude: normalizedLongitude
      })
    });
    const data = await readJsonSafe(response);

    if (response.ok) {
      lastLocationPostAt = Date.now();
      return { ok: true, data };
    }

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('token');
      isLocationLoggingEnabled = false;
      lastLocationPostAt = 0;
      stopPeriodicLocationUpdate();
      stopLocationTracking();
      goToPage('page-login', { force: true });
      notify('ログイン期限が切れました。もう一度ログインしてください。', 'warning');
    }

    throw new Error(data.message || '位置情報送信に失敗しました');
  } catch (error) {
    console.error(`${source}: 送信エラー`, error);
    if (notifyErrors) notifyLocationError('位置情報ログの送信に失敗しました', 'error');
    return { ok: false, error };
  } finally {
    isLocationPostInFlight = false;
  }
}

// 定期的に位置情報を送信する関数
async function sendLocation() {
  const token = localStorage.getItem('token');
  if (!token) {
    stopPeriodicLocationUpdate(); // トークンがなければ停止
    stopLocationTracking();
    lastKnownPosition = null;
    lastKnownPositionAt = 0;
    return;
  }

  if (!isLocationLoggingEnabled) {
    stopPeriodicLocationUpdate();
    lastKnownPosition = null;
    lastKnownPositionAt = 0;
    return;
  }

  if (!navigator.geolocation) {
    notify('このブラウザは位置情報に対応していません。', 'warning');
    stopPeriodicLocationUpdate();
    lastKnownPosition = null;
    lastKnownPositionAt = 0;
    return;
  }

  if (!hasRecentKnownPosition()) {
    const position = await requestPositionForLogging({ notifyErrors: true });
    if (!position) return;
    await postLocationToServer(position.latitude, position.longitude, {
      source: '定期更新',
      notifyErrors: true
    });
    return;
  }

  await postLocationToServer(lastKnownPosition.latitude, lastKnownPosition.longitude, {
    source: '定期更新',
    notifyErrors: true
  });
}

// 定期的な位置情報更新を開始する関数
function startPeriodicLocationUpdate({ runImmediately = true } = {}) {
  if (!isLocationLoggingEnabled) {
    return;
  }
  // 既に実行中の場合は何もしない
  if (locationUpdateIntervalId) {
    return;
  }
  if (runImmediately) sendLocation();
  locationUpdateIntervalId = setInterval(sendLocation, LOCATION_UPDATE_INTERVAL_MS);
}

// 定期的な位置情報更新を停止する関数
function stopPeriodicLocationUpdate() {
  if (locationUpdateIntervalId) {
    clearInterval(locationUpdateIntervalId);
    locationUpdateIntervalId = null;
  }
}

async function refreshLocationLoggingFromSettings({ settings = null, notifyErrors = false } = {}) {
  const loadedSettings = settings || await loadUserSettings();

  if (!loadedSettings) {
    isLocationLoggingEnabled = false;
    lastLocationPostAt = 0;
    lastKnownPosition = null;
    lastKnownPositionAt = 0;
    stopPeriodicLocationUpdate();
    stopLocationTracking();
    if (notifyErrors) notify('位置情報設定を確認できませんでした', 'error');
    return null;
  }

  lastUserSettings = loadedSettings;
  isLocationLoggingEnabled = Boolean(loadedSettings.location_enabled);

  if (!isLocationLoggingEnabled) {
    lastLocationPostAt = 0;
    lastKnownPosition = null;
    lastKnownPositionAt = 0;
    stopPeriodicLocationUpdate();
    stopLocationTracking();
    return loadedSettings;
  }

  const permissionState = await checkLocationPermission();

  if (permissionState === 'denied') {
    lastKnownPosition = null;
    lastKnownPositionAt = 0;
    stopPeriodicLocationUpdate();
    stopLocationTracking();
    if (notifyErrors) {
      notify('ブラウザ設定で位置情報の許可をONにしてください。', 'warning');
    }
    return loadedSettings;
  }

  if (permissionState === 'granted') {
    startLocationTracking();
    startPeriodicLocationUpdate({ runImmediately: false });
  } else {
    stopLocationTracking();
    startPeriodicLocationUpdate();
  }

  return loadedSettings;
}

// 初期表示時にフッターを非表示にし、ログインページを表示
footerNav.classList.add('hidden');
showPage('page-login');

//ここからはランキング機能
// 現在のランキングタイプを管理する変数
let currentRankingType = 'weather';

// ランキングタブの初期化
function initializeRankingTabs() {
  const rankingTabs = document.querySelectorAll('.ranking-tab');

  rankingTabs.forEach(tab => {
    tab.addEventListener('click', function () {
      const rankingType = this.getAttribute('data-mode') || 'weather';
      if (this.classList.contains('active') && rankingType === currentRankingType) {
        return;
      }

      // 全てのタブからactiveクラスを削除
      rankingTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-pressed', 'false');
      });

      // クリックされたタブにactiveクラスを追加
      this.classList.add('active');
      this.setAttribute('aria-pressed', 'true');


      // ランキングデータを更新
      updateRankingPage(rankingType);
    });
  });
}

async function updateRankingPage(type = currentRankingType) {
  const token = localStorage.getItem('token');
  const summaryElement = document.getElementById('ranking-summary');
  if (!token) {
    renderRankingState(document.getElementById('ranking-table-body'), 'ログインするとランキングを確認できます');
    if (summaryElement) summaryElement.textContent = 'ログインが必要です';
    return;
  }

  // 現在のランキングタイプを更新
  currentRankingType = type;

  const scoreHeader = document.getElementById('ranking-score-header');
  const tbody = document.getElementById('ranking-table-body');

  // ランキングタイプに応じてヘッダーテキストを変更
  const headerTexts = {
    'weather': '天気スコア',
    'missed': '電車乗り遅れ回数',
    'delay': '電車遅延率(%)'
  };

  if (scoreHeader) scoreHeader.textContent = headerTexts[type] || '天気スコア';
  renderRankingState(tbody, 'ランキングを読み込んでいます...');
  if (summaryElement) {
    summaryElement.textContent = 'ランキングを読み込んでいます...';
    summaryElement.dataset.state = 'info';
  }
  showLoadingPopup('ランキングを読み込んでいます...');
  const requestId = ++rankingRequestId;

  try {
    const response = await fetch(`${API_BASE}/ranking?type=${type}&limit=50`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rankingResponse = await readJsonSafe(response);
    if (requestId !== rankingRequestId) return;

    // 新しいAPIレスポンス形式に対応
    if (!rankingResponse.rankings || !Array.isArray(rankingResponse.rankings)) {
      throw new Error('Unexpected ranking response shape');
    }

    const rankings = rankingResponse.rankings;

    if (tbody) {
      tbody.innerHTML = '';
      rankings.forEach((user) => {
        const tr = document.createElement('tr');

        // スコア表示の形式を調整
        let scoreDisplay;
        if (type === 'weather') {
          scoreDisplay = Number(user.score ?? 0).toFixed(1);
        } else if (type === 'missed') {
          scoreDisplay = Math.floor(user.score ?? 0).toString();
        } else if (type === 'delay') {
          scoreDisplay = Number(user.score ?? 0).toFixed(2) + '%';
        } else {
          scoreDisplay = Number(user.score ?? 0).toFixed(1);
        }

        const rankCell = document.createElement('td');
        const nameCell = document.createElement('td');
        const scoreCell = document.createElement('td');
        rankCell.textContent = user.rank;
        nameCell.textContent = `${user.username}${user.isCurrentUser ? ' (あなた)' : ''}`;
        scoreCell.textContent = scoreDisplay;
        tr.append(rankCell, nameCell, scoreCell);

        // 自分のランキングを強調表示
        if (user.isCurrentUser) {
          tr.classList.add('ranking-current-user');
        }

        tbody.appendChild(tr);
      });

      if (rankings.length === 0) {
        renderRankingState(tbody, 'まだランキングデータがありません');
      }
    }

    if (summaryElement) {
      const currentRank = rankings.find(user => user.isCurrentUser) || rankingResponse.currentUserRank;
      const currentRankText = currentRank ? `あなたは${currentRank.rank}位です。` : 'あなたの順位はまだありません。';
      summaryElement.textContent = `参加者${rankingResponse.totalUsers || rankings.length}人中。${currentRankText}`;
      summaryElement.dataset.state = rankings.length > 0 ? 'success' : 'warning';
    }
  } catch (error) {
    console.error('ランキング取得エラー:', error);
    if (requestId !== rankingRequestId) return;
    renderRankingState(tbody, 'ランキングの取得に失敗しました', true);
    if (summaryElement) {
      summaryElement.textContent = 'ランキングの取得に失敗しました。';
      summaryElement.dataset.state = 'error';
    }
    notify('ランキングの取得に失敗しました', 'error');
  } finally {
    if (requestId === rankingRequestId) hideLoadingPopup();
  }
}

function renderRankingState(tbody, message, isError = false) {
  if (!tbody) return;

  tbody.innerHTML = '';
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 3;
  cell.className = isError ? 'table-state error' : 'table-state';
  cell.textContent = message;
  row.appendChild(cell);
  tbody.appendChild(row);
}

//ここからは地図機能

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★【重要】変数の宣言を、関数定義の前に移動します
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// 地図関連の変数（TDZ回避のため function-scope）


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setMapLocationStatus(message, type = 'info') {
  const statusElement = document.getElementById('map-location-status');
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.dataset.state = type;
}

function setMapDataStatus(message, type = 'info') {
  const statusElement = document.getElementById('map-data-status');
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.dataset.state = type;
}

function normalizeWeatherKey(weather) {
  return String(weather || 'unknown').trim().toLowerCase() || 'unknown';
}

function getUserMarkerImagePath(user) {
  const weather = normalizeWeatherKey(user.weather);
  return MARKER_IMAGE_BY_WEATHER[weather]
    || MARKER_IMAGE_BY_STATUS[user.status || 'unknown']
    || MARKER_IMAGE_BY_WEATHER.unknown;
}

function createUserMarkerIcon(user) {
  const iconSize = user.isCurrentUser ? [52, 52] : [46, 46];
  return L.icon({
    iconUrl: getUserMarkerImagePath(user),
    className: user.isCurrentUser ? 'soralog-weather-marker current-user' : 'soralog-weather-marker',
    iconSize,
    iconAnchor: [iconSize[0] / 2, iconSize[1] - 3],
    popupAnchor: [0, -iconSize[1] + 6]
  });
}

function createCurrentLocationIcon() {
  return L.divIcon({
    className: 'soralog-marker-host',
    html: '<div class="soralog-marker my-location" data-marker-type="current-location" title="現在地" aria-label="現在地"><span>私</span></div>',
    iconSize: [42, 50],
    iconAnchor: [21, 46],
    popupAnchor: [0, -40]
  });
}

function upsertCurrentLocationMarker({ centerMap = false } = {}) {
  if (!leafletMap || !currentMapPosition) return;

  const latLng = [currentMapPosition.latitude, currentMapPosition.longitude];
  if (currentLocationMarker) {
    currentLocationMarker.setLatLng(latLng);
  } else {
    currentLocationMarker = L.marker(latLng, { icon: createCurrentLocationIcon(), zIndexOffset: 1000 })
      .addTo(leafletMap)
      .bindPopup('<b>現在地</b><br>地図の中心に使っています。設定をONにしたときだけ天気ログとして送信します。');
  }

  if (centerMap) {
    leafletMap.setView(latLng, Math.max(leafletMap.getZoom(), 12));
  }
}

function syncCurrentMapPositionFromKnown({ centerMap = false } = {}) {
  if (!lastKnownPosition) return null;

  currentMapPosition = {
    latitude: lastKnownPosition.latitude,
    longitude: lastKnownPosition.longitude,
    accuracy: lastKnownPosition.accuracy
  };

  if (leafletMap) {
    const accuracy = Math.round(currentMapPosition.accuracy || 0);
    setMapLocationStatus(`現在地を表示しています（精度 約${accuracy}m）`, 'success');
    upsertCurrentLocationMarker({ centerMap });
  }

  return currentMapPosition;
}

async function requestCurrentLocationForMap({ centerMap = false, silent = false } = {}) {
  if (!navigator.geolocation) {
    setMapLocationStatus('このブラウザは位置情報に対応していません。日本全体を表示しています。', 'warning');
    return null;
  }

  if (!silent) {
    setMapLocationStatus('現在地を確認しています...');
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        rememberPosition(position);
        syncCurrentMapPositionFromKnown({ centerMap });
        resolve(currentMapPosition);
      },
      (error) => {
        const fallbackMessage = error.code === error.PERMISSION_DENIED
          ? '位置情報が許可されていないため、日本全体を表示しています。'
          : '現在地を取得できなかったため、日本全体を表示しています。';
        setMapLocationStatus(fallbackMessage, 'warning');
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );
  });
}

function startMapLocationTracking({ centerOnFirstUpdate = false } = {}) {
  if (!navigator.geolocation) {
    setMapLocationStatus('このブラウザは位置情報に対応していません。日本全体を表示しています。', 'warning');
    return;
  }

  if (mapLocationWatchId !== null) {
    if (centerOnFirstUpdate) syncCurrentMapPositionFromKnown({ centerMap: true });
    return;
  }

  let shouldCenter = centerOnFirstUpdate;
  mapLocationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      rememberPosition(position);
      syncCurrentMapPositionFromKnown({ centerMap: shouldCenter });
      shouldCenter = false;
    },
    (error) => {
      handleGeolocationFailure(error, { notifyErrors: false });
      if (!hasRecentKnownPosition()) {
        const fallbackMessage = error.code === error.PERMISSION_DENIED
          ? '位置情報が許可されていないため、日本全体を表示しています。'
          : '現在地を取得できなかったため、日本全体を表示しています。';
        setMapLocationStatus(fallbackMessage, 'warning');
      }
    },
    WATCH_POSITION_OPTIONS
  );
}

function stopMapLocationTracking() {
  if (mapLocationWatchId !== null) {
    navigator.geolocation.clearWatch(mapLocationWatchId);
    mapLocationWatchId = null;
  }
}

function formatRecordedAt(value) {
  if (!value) return '記録なし';
  const recordedAt = new Date(value);
  return Number.isNaN(recordedAt.getTime()) ? '記録なし' : recordedAt.toLocaleString();
}

function createUserPopup(user) {
  const status = user.status || 'unknown';
  const score = Number(user.score || 0);
  const recordedAt = formatRecordedAt(user.recordedAt);
  const introductionText = String(user.introductionText || '').trim();
  const introduction = !user.isDemo && introductionText
    ? `<br>ひとこと: ${escapeHtml(introductionText)}`
    : '';
  return `<b>${escapeHtml(user.username)}</b><br>称号: ${escapeHtml(status)}<br>スコア: ${escapeHtml(score)}<br>天気: ${escapeHtml(user.weather || 'unknown')}${introduction}<br>記録日時: ${escapeHtml(recordedAt)}`;
}

function getMapUsers(apiUsers = []) {
  const normalizedApiUsers = apiUsers
    .filter(user => Number.isFinite(Number(user.latitude)) && Number.isFinite(Number(user.longitude)))
    .map(user => ({
      ...user,
      latitude: Number(user.latitude),
      longitude: Number(user.longitude),
      isDemo: false
    }));

  return normalizedApiUsers.length > 0 ? normalizedApiUsers : DEMO_USERS;
}

// ユーザーの位置情報を取得してマーカーを表示
async function loadUserMarkers() {
  const token = localStorage.getItem('token');
  if (!token) {
    return;
  }

  try {
    setMapDataStatus('公開ユーザーを読み込んでいます...', 'info');
    const response = await fetch(`${API_BASE}/users-locations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await readJsonSafe(response);

    // 既存のマーカーをクリア（マップ未初期化時はスキップ）
    if (!Array.isArray(userMarkers)) {
      userMarkers = [];
    }
    if (leafletMap) {
      userMarkers.forEach(marker => leafletMap.removeLayer(marker));
    }
    userMarkers = [];

    const apiUsers = data && Array.isArray(data.users) ? data.users : [];
    const mapUsers = getMapUsers(apiUsers);
    if (apiUsers.length > 0) {
      setMapDataStatus(`ユーザー${apiUsers.length}件を表示しています。`, 'success');
    } else {
      setMapDataStatus('地図データを表示しています。', 'warning');
    }

    // 各ユーザーのマーカーを追加
    mapUsers.forEach(user => {
      if (!leafletMap) {
        return; // マップ未初期化ならスキップ
      }

      const marker = L.marker([user.latitude, user.longitude], { icon: createUserMarkerIcon(user) })
        .addTo(leafletMap)
        .bindPopup(createUserPopup(user));

      userMarkers.push(marker);
    });

    upsertCurrentLocationMarker();

  } catch (error) {
    console.error('ユーザーマーカーの読み込みに失敗しました:', error);
    setMapDataStatus('ユーザー情報を取得できなかったため、地図データを表示しています。', 'warning');
    if (leafletMap) {
      userMarkers.forEach(marker => leafletMap.removeLayer(marker));
      userMarkers = [];
      getMapUsers([]).forEach(user => {
        const marker = L.marker([user.latitude, user.longitude], { icon: createUserMarkerIcon(user) })
          .addTo(leafletMap)
          .bindPopup(createUserPopup(user));
        userMarkers.push(marker);
      });
      upsertCurrentLocationMarker();
    }
  }
}



function initializeMap() {
  const container = document.getElementById('map'); // IDを 'map' に修正

  if (!container) {
    console.error('Map container (#map) not found');
    return;
  }

  // コンテナ自体が初期化済みか、またはmapインスタンスが存在するかチェック
  if (container._leaflet_id || (leafletMap && leafletMap.remove)) {
    if (leafletMap) {
      leafletMap.invalidateSize(); // 表示を更新
      if (lastKnownPosition) {
        syncCurrentMapPositionFromKnown({ centerMap: true });
      } else if (currentMapPosition) {
        upsertCurrentLocationMarker({ centerMap: true });
      } else {
        requestCurrentLocationForMap({ centerMap: true, silent: true });
      }
    }
    loadUserMarkers(); // マーカーを再読み込み
    startMapLocationTracking({ centerOnFirstUpdate: !lastKnownPosition && !currentMapPosition });
    startMapMarkersUpdate();
    return;
  }

  leafletMap = L.map(container).setView(DEFAULT_MAP_CENTER, 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(leafletMap);

  if (lastKnownPosition) {
    syncCurrentMapPositionFromKnown({ centerMap: true });
  } else {
    requestCurrentLocationForMap({ centerMap: true, silent: true });
  }
  loadUserMarkers();
  startMapLocationTracking({ centerOnFirstUpdate: !lastKnownPosition && !currentMapPosition });

  // マップマーカーの定期更新を開始
  startMapMarkersUpdate();
}

// マップマーカーの定期更新を開始する関数
function startMapMarkersUpdate() {
  // 既に実行中の場合は何もしない
  if (mapMarkersUpdateIntervalId) {
    return;
  }
  // 30秒ごとにマーカーを更新
  mapMarkersUpdateIntervalId = setInterval(() => {
    // マップページが表示されている場合のみ更新
    const mapPage = document.getElementById('page-map');
    if (mapPage && !mapPage.classList.contains('hidden')) {
      loadUserMarkers();
    }
  }, 30 * 1000); // 30秒 = 30,000ミリ秒
}

// マップマーカーの定期更新を停止する関数
function stopMapMarkersUpdate() {
  if (mapMarkersUpdateIntervalId) {
    clearInterval(mapMarkersUpdateIntervalId);
    mapMarkersUpdateIntervalId = null;
  }
}

// アイコン機能

const iconInput = document.getElementById('iconInput');
const iconPreview = document.getElementById('iconPreview');
const resetBtn = document.getElementById('resetBtn');

// ページ読み込み時に保存されたアイコンを復元
window.addEventListener('DOMContentLoaded', () => {
  loadSavedIcon();

  // フッターアイコンのエラーハンドリングを設定
  setupFooterIconErrorHandling();

  // ランキングタブの切り替え機能を初期化
  initializeRankingTabs();

  checkLoginStatus();
});

// エラーハンドリング
window.addEventListener('error', function (e) {
  console.error('エラーが発生しました:', e.error);
});

// localStorageの容量チェック
function checkLocalStorageSpace() {
  try {
    const testKey = 'storageTest';
    const testValue = new Array(1024 * 1024).join('a'); // 1MBのテストデータ
    localStorage.setItem(testKey, testValue);
    localStorage.removeItem(testKey);
    return true;
  } catch (_) {
    return false;
  }
}

// 初期化時に容量チェック
checkLocalStorageSpace();

// 設定ページの初期化関数
function initializeSettingsPage() {

  // アイコン機能の要素を取得
  const iconInput = document.getElementById('iconInput');
  const iconPreview = document.getElementById('iconPreview');
  const resetBtn = document.getElementById('resetBtn');
  const selectIconBtn = document.getElementById('selectIconBtn');

  if (selectIconBtn && !selectIconBtn.hasAttribute('data-initialized')) {
    selectIconBtn.setAttribute('data-initialized', 'true');
    selectIconBtn.addEventListener('click', function () {
      if (iconInput) iconInput.click();
    });
  }

  // アイコン選択のイベントリスナー
  if (iconInput && !iconInput.hasAttribute('data-initialized')) {
    iconInput.setAttribute('data-initialized', 'true');
    iconInput.addEventListener('change', function (event) {
      const file = event.target.files[0];
      if (file) {
        // ファイルタイプのチェック
        if (!file.type.startsWith('image/')) {
          notify('画像ファイルを選択してください。', 'warning');
          return;
        }
        // ファイルサイズのチェック（5MB以下）
        if (file.size > 5 * 1024 * 1024) {
          notify('ファイルサイズは5MB以下にしてください。', 'warning');
          return;
        }
        // ファイル読み込み処理
        const reader = new FileReader();
        reader.onload = function (e) {
          selectedImageData = e.target.result;
          displayImagePreview(selectedImageData);
          saveIconToServer(selectedImageData);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // リセットボタンのイベントリスナー
  if (resetBtn && !resetBtn.hasAttribute('data-initialized')) {
    resetBtn.setAttribute('data-initialized', 'true');
    resetBtn.addEventListener('click', function () {
      if (iconPreview) {
        iconPreview.innerHTML = '<span class="icon-placeholder">アイコンを選択してください</span>';
      }
      if (iconInput) iconInput.value = '';
      selectedImageData = null;
      notify('アイコン選択をリセットしました', 'success');
    });
  }

  // ドラッグ&ドロップ機能
  if (iconPreview && !iconPreview.hasAttribute('data-initialized')) {
    iconPreview.setAttribute('data-initialized', 'true');

    iconPreview.addEventListener('dragover', function (e) {
      e.preventDefault();
      iconPreview.style.borderColor = '#667eea';
      iconPreview.style.backgroundColor = '#f0f0ff';
    });

    iconPreview.addEventListener('dragleave', function (e) {
      e.preventDefault();
      iconPreview.style.borderColor = '#ddd';
      iconPreview.style.backgroundColor = '#f9f9f9';
    });

    iconPreview.addEventListener('drop', function (e) {
      e.preventDefault();
      iconPreview.style.borderColor = '#ddd';
      iconPreview.style.backgroundColor = '#f9f9f9';

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (!file.type.startsWith('image/')) {
          notify('画像ファイルをドロップしてください。', 'warning');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          notify('ファイルサイズは5MB以下にしてください。', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = function (event) {
          // ドラッグ&ドロップ時に誤って外側のイベント(e)を参照していたバグを修正
          // 正しくは FileReader の onload イベント(event)から result を取得する
          selectedImageData = event.target.result;
          displayImagePreview(selectedImageData);
          saveIconToServer(selectedImageData);
        };
        reader.readAsDataURL(file);
      }
    });

    // クリックでファイル選択
    iconPreview.addEventListener('click', function () {
      if (iconInput) iconInput.click();
    });
  }

  // ユーザー情報を取得して表示
  loadUserInfo();

  // 設定項目のスイッチ機能を初期化
  initializeSettingsSwitches();

  // 自己紹介機能の初期化
  initializeIntroduction();

  // 保存されたアイコンを読み込み
  loadSavedIcon();

  syncSettingsPageControls();
}

// ユーザー情報をAPIから取得して表示する関数
async function loadUserInfo() {
  const token = localStorage.getItem('token');
  if (!token) {
    // トークンがない場合はログインページにリダイレクト
    isLocationLoggingEnabled = false;
    lastLocationPostAt = 0;
    stopPeriodicLocationUpdate();
    stopLocationTracking();
    goToPage('page-login');
    return;
  }

  // 読み込み中を表示
  const userIdElement = document.querySelector('.introduce-number');
  const userNameElement = document.querySelector('.introduce-name');

  if (userIdElement) userIdElement.textContent = 'ID：読み込み中...';
  if (userNameElement) userNameElement.textContent = 'ユーザ名：読み込み中...';

  try {
    const response = await fetch(`${API_BASE}/user/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const userData = await readJsonSafe(response);

      if (userIdElement) {
        userIdElement.textContent = `ID：${userData.id}`;
      }
      if (userNameElement) {
        userNameElement.textContent = `ユーザ名：${userData.username}`;
      }

    } else if (response.status === 401) {
      // 認証エラーの場合はログアウト
      console.error('認証エラー: トークンが無効です');
      localStorage.removeItem('token');
      isLocationLoggingEnabled = false;
      lastLocationPostAt = 0;
      stopPeriodicLocationUpdate();
      stopLocationTracking();
      goToPage('page-login');
    } else {
      console.error('ユーザー情報の取得に失敗しました:', response.status);
      if (userIdElement) userIdElement.textContent = 'ID：取得失敗';
      if (userNameElement) userNameElement.textContent = 'ユーザ名：取得失敗';
    }
  } catch (error) {
    console.error('ユーザー情報の取得に失敗:', error);
    if (userIdElement) userIdElement.textContent = 'ID：ネットワークエラー';
    if (userNameElement) userNameElement.textContent = 'ユーザ名：ネットワークエラー';
  }
}

// 設定項目のスイッチ機能を初期化
function initializeSettingsSwitches() {
  const notificationSwitch = document.getElementById('notification-switch');
  if (notificationSwitch && !notificationSwitch.hasAttribute('data-initialized')) {
    notificationSwitch.setAttribute('data-initialized', 'true');
    notificationSwitch.addEventListener('change', async function () {
      const previousValue = !this.checked;
      this.disabled = true;
      const saved = await saveUserSettings({ notifyOnSuccess: true, successMessage: '通知設定を保存しました' });
      if (!saved) this.checked = previousValue;
      this.disabled = false;
    });
  }

  const locationSwitch = document.getElementById('location-switch');
  if (locationSwitch && !locationSwitch.hasAttribute('data-initialized')) {
    locationSwitch.setAttribute('data-initialized', 'true');
    locationSwitch.addEventListener('change', async function () {
      const previousValue = !this.checked;

      if (this.checked) {
        const permissionState = await checkLocationPermission();
        if (permissionState === 'denied') {
          notify('ブラウザ設定で位置情報の許可をONにしてください。', 'warning');
          this.checked = false;
          await updateLocationSwitch();
          return;
        }
      }

      this.disabled = true;
      const saved = await saveUserSettings({
        notifyOnSuccess: true,
        successMessage: this.checked ? '位置情報ログをONにしました' : '位置情報ログをOFFにしました'
      });

      if (!saved) {
        this.checked = previousValue;
      } else {
        await refreshLocationLoggingFromSettings({ settings: getSettingsFromControls(), notifyErrors: true });
      }
      this.disabled = false;
      await updateLocationSwitch();
    });
  }

  const locationPublicSwitch = document.getElementById('location-public-switch');
  if (locationPublicSwitch && !locationPublicSwitch.hasAttribute('data-initialized')) {
    locationPublicSwitch.setAttribute('data-initialized', 'true');
    locationPublicSwitch.addEventListener('change', async function () {
      const previousValue = !this.checked;
      this.disabled = true;
      const saved = await saveUserSettings({
        notifyOnSuccess: true,
        successMessage: this.checked ? '位置情報の地図公開をONにしました' : '位置情報の地図公開をOFFにしました'
      });
      if (!saved) this.checked = previousValue;
      this.disabled = false;
    });
  }
}

function getSettingsFromControls() {
  const notificationSwitch = document.getElementById('notification-switch');
  const locationSwitch = document.getElementById('location-switch');
  const locationPublicSwitch = document.getElementById('location-public-switch');
  const messageTextarea = document.getElementById('message');

  return {
    notification_enabled: notificationSwitch ? notificationSwitch.checked : true,
    location_enabled: locationSwitch ? locationSwitch.checked : false,
    location_public_enabled: locationPublicSwitch ? locationPublicSwitch.checked : true,
    introduction_text: messageTextarea ? messageTextarea.value : ''
  };
}

function applySettingsToControls(settings) {
  if (!settings) return;
  const notificationSwitch = document.getElementById('notification-switch');
  const locationSwitch = document.getElementById('location-switch');
  const locationPublicSwitch = document.getElementById('location-public-switch');
  const messageTextarea = document.getElementById('message');

  if (notificationSwitch) notificationSwitch.checked = Boolean(settings.notification_enabled);
  if (locationSwitch) locationSwitch.checked = Boolean(settings.location_enabled);
  if (locationPublicSwitch) locationPublicSwitch.checked = settings.location_public_enabled !== false;
  if (messageTextarea && document.activeElement !== messageTextarea) {
    messageTextarea.value = settings.introduction_text || '';
  }
}

async function syncSettingsPageControls() {
  const settings = await loadUserSettings();
  if (settings) {
    applySettingsToControls(settings);
  } else {
    notify('設定の取得に失敗しました', 'error');
  }
  await updateLocationSwitch();
  return settings;
}

// ユーザー設定をAPIから取得する関数
async function loadUserSettings() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE}/user/settings`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const settings = await readJsonSafe(response);
      lastUserSettings = settings;
      return settings;
    } else {
      console.error('設定の取得に失敗しました');
      return null;
    }
  } catch (error) {
    console.error('設定の取得に失敗:', error);
    return null;
  }
}

// ユーザー設定をAPIに保存する関数
function setSettingsSaveStatus(message = '', type = 'info') {
  const statusElement = document.getElementById('settings-save-status');
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.dataset.state = type;
}

async function saveUserSettings({ notifyOnSuccess = false, successMessage = '設定を保存しました' } = {}) {
  const token = localStorage.getItem('token');
  if (!token) return false;

  const settings = getSettingsFromControls();
  setSettingsSaveStatus('保存中...', 'info');

  try {
    const response = await fetch(`${API_BASE}/user/settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });

    if (response.ok) {
      lastUserSettings = settings;
      setSettingsSaveStatus(successMessage, 'success');
      if (notifyOnSuccess) notify(successMessage, 'success');
      return true;
    } else {
      console.error('設定の保存に失敗しました');
      const data = await readJsonSafe(response);
      const message = data.message || '設定の保存に失敗しました';
      setSettingsSaveStatus(message, 'error');
      notify(message, 'error');
      return false;
    }
  } catch (error) {
    console.error('設定の保存に失敗:', error);
    setSettingsSaveStatus('設定の保存に失敗しました', 'error');
    notify('設定の保存に失敗しました', 'error');
    return false;
  }
}

// 自己紹介機能の初期化
function initializeIntroduction() {
  const messageTextarea = document.getElementById('message');
  if (messageTextarea && !messageTextarea.hasAttribute('data-initialized')) {
    messageTextarea.setAttribute('data-initialized', 'true');

    // 入力時に自動保存（リアルタイム保存）
    messageTextarea.addEventListener('input', function () {
      // 自動保存を少し遅らせる（パフォーマンスのため）
      clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        saveUserSettings();
      }, 1000); // 1秒後に保存
    });
  }
}

// アイコンをサーバーに保存する関数
async function saveIconToServer(imageData) {
  const token = localStorage.getItem('token');
  if (!token) {
    notify('ログインが必要です', 'warning');
    return;
  }

  try {
    // Base64データをCanvasで圧縮
    const compressedImageData = await compressImage(imageData);

    // 圧縮後のBase64データからファイルサイズを計算
    const base64Data = compressedImageData.split(',')[1];
    const fileSize = Math.round((base64Data.length * 3) / 4);


    const response = await fetch(`${API_BASE}/user/icon`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        icon_data: base64Data,
        content_type: 'image/jpeg',
        file_size: fileSize
      })
    });

    if (response.ok) {
      notify('アイコンを保存しました', 'success');
    } else {
      const errorData = await response.json();
      notify(`保存に失敗しました: ${errorData.message || '不明なエラー'}`, 'error');
    }
  } catch (error) {
    console.error('アイコン保存エラー:', error);
    notify('保存に失敗しました。ネットワークエラーが発生しました。', 'error');
  }
}

// 画像を圧縮する関数
async function compressImage(imageData) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // 最大サイズを200x200に制限
      const maxSize = 200;
      let { width, height } = img;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // 画像をキャンバスに描画
      ctx.drawImage(img, 0, 0, width, height);

      // JPEG形式で圧縮（品質0.8）
      const compressedData = canvas.toDataURL('image/jpeg', 0.8);
      resolve(compressedData);
    };

    img.src = imageData;
  });
}

// 画像プレビューを表示する関数
function displayImagePreview(imageData) {
  const iconPreview = document.getElementById('iconPreview');
  if (iconPreview) {
    const image = document.createElement('img');
    image.src = imageData;
    image.alt = 'アイコンプレビュー';
    image.className = 'icon-preview-image';
    iconPreview.replaceChildren(image);
  }
}

// 保存されたアイコンをAPIから読み込む関数
async function loadSavedIcon() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/user/icon`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      // 画像データを取得
      const blob = await response.blob();
      const reader = new FileReader();

      reader.onload = function (e) {
        const imageData = e.target.result;
        // 読み込んだサーバ上のアイコンも現在の選択データとして扱う
        // これにより「保存」ボタンが反応しないケースを回避
        selectedImageData = imageData;
        displayImagePreview(imageData);
      };

      reader.readAsDataURL(blob);
    } else if (response.status === 204 || response.status === 404) {
      // アイコンが存在しない場合（204 No Content / 404 Not Found）は静かに無視
    } else {
      console.error('アイコンの取得に失敗しました');
    }
  } catch (error) {
    console.error('アイコンの取得に失敗:', error);
  }
}

// 位置情報追跡を開始する関数
function startLocationTracking() {
  if (!isLocationLoggingEnabled) {
    return;
  }
  if (navigator.geolocation) {
    // 既に追跡中の場合は停止してから再開
    if (locationWatchId !== null) {
      navigator.geolocation.clearWatch(locationWatchId);
      locationWatchId = null;
    }

    locationWatchId = navigator.geolocation.watchPosition(
      function (position) {
        const rememberedPosition = rememberPosition(position);
        if (!rememberedPosition) return;

        // 位置情報をサーバーに送信
        sendLocationToServer(rememberedPosition.latitude, rememberedPosition.longitude);
      },
      function (error) {
        handleLocationError(error);
      },
      WATCH_POSITION_OPTIONS
    );

  } else {
    notify('このブラウザは位置情報に対応していません。', 'warning');
  }
}

// 位置情報エラーを処理する関数
function handleLocationError(error) {
  handleGeolocationFailure(error, { notifyErrors: !hasRecentKnownPosition() });
}

// 位置情報追跡を停止する関数
function stopLocationTracking() {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
}

// 位置情報をサーバーに送信する関数
function sendLocationToServer(latitude, longitude) {
  postLocationToServer(latitude, longitude, { source: '位置情報追跡', notifyErrors: false });
}

async function checkLocationPermission() {
  if (!navigator.permissions) {
    return 'unknown';
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state; // 'granted', 'denied', 'prompt'
  } catch (_) {
    return 'unknown';
  }
}

// 位置情報設定のスイッチを更新する関数
async function updateLocationSwitch() {
  const locationSwitch = document.getElementById('location-switch');
  const permissionStateElement = document.getElementById('location-permission-state');
  if (!locationSwitch) return;

  checkLocationPermission()
    .then((state) => {
      if (permissionStateElement) {
        const labels = {
          granted: 'ブラウザの位置情報は許可されています。',
          prompt: 'ブラウザの位置情報は未選択です。ONにすると確認が表示されます。',
          denied: 'ブラウザ側で位置情報がブロックされています。',
          unknown: 'ブラウザの位置情報許可を確認できませんでした。'
        };
        permissionStateElement.textContent = labels[state] || labels.unknown;
        permissionStateElement.dataset.state = state === 'denied' ? 'error' : state === 'granted' ? 'success' : 'info';
      }
      if (state === 'denied') {
        // ブラウザ側でブロックされているので、ユーザー操作を無効化
        locationSwitch.checked = false;
        locationSwitch.disabled = true;
        locationSwitch.title = 'ブラウザの設定で位置情報がブロックされています。設定から許可してください。';
      } else {
        // 許可または未決定の場合は操作可能
        locationSwitch.disabled = false;
        locationSwitch.title = '';
      }
    })
    .catch(() => {
    });
}
