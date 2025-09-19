import "./style.css";

// ================== API ベースURL設定 start ==================
const DEFAULT_PROD_API = 'https://soralog-backend.onrender.com';
const LOCAL_API = 'http://localhost:3000';
let API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || DEFAULT_PROD_API;

console.log('[API] Initial window.location:', typeof window !== 'undefined' ? window.location : 'no window');
console.log('[API] Initial window.location.host:', typeof window !== 'undefined' ? window.location.host : 'no window');

const isLocalHost = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.host);
console.log('[API] isLocalHost:', isLocalHost);

if (isLocalHost) {
  API_BASE = LOCAL_API;
  console.log('[API] Set to LOCAL_API because isLocalHost is true');
} else {
  console.log('[API] Keep DEFAULT_PROD_API because isLocalHost is false');
}

try {
  if (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) {
    API_BASE = import.meta.env.VITE_API_BASE;
    console.log('[API] Override with VITE_API_BASE:', API_BASE);
  }
} catch (_) { /* no-op */ }

console.log('[API] Final Base URL =', API_BASE);
// ================== API ベースURL設定 end ==================

const pages = document.querySelectorAll('main section');
const navButtons = document.querySelectorAll('.nav-button');
const headerTitle = document.getElementById('header-title');
const footerNav = document.getElementById('footer-nav');

// 位置情報追跡用の変数
let locationWatchId = null;
let locationUpdateIntervalId = null; // 定期更新用のID

// 選択された画像データを保存する変数（TDZ回避のため var）
let selectedImageData = null;

let leafletMap = null;
let userMarkers = [];

// 天気に応じたマーカーの色を定義（TDZ回避のため var）
let weatherColors = {
  'sunny': '#FFD700',      // 金色
  'cloudy': '#87CEEB',     // スカイブルー
  'rainy': '#4169E1',      // ロイヤルブルー
  'snowy': '#FFFFFF',      // 白
  'thunderstorm': '#8A2BE2', // ブルーバイオレット
  'stormy': '#2F4F4F',     // ダークスレートグレー
  'unknown': '#808080'     // グレー
};

// 天気に応じた絵文字を定義（TDZ回避のため var）
let weatherEmojis = {
  'sunny': '☀️',
  'cloudy': '☁️',
  'rainy': '🌧️',
  'snowy': '❄️',
  'thunderstorm': '⚡',
  'stormy': '🌪️',
  'unknown': '❓'
};

function showPage(pageId) {
  pages.forEach(page => page.classList.add('hidden'));

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.remove('hidden');
  }

  // ログイン・新規登録画面ではフッターを非表示
  if (pageId === 'page-login' || pageId === 'page-register') {
    footerNav.classList.add('hidden');
    showHeaderImage(null);
  } else {
    footerNav.classList.remove('hidden');
  }

  // ヘッダー画像の切り替え
  if (pageId === 'page-home') showHeaderImage('home');
  else if (pageId === 'page-map') showHeaderImage('map');
  else if (pageId === 'page-ranking') showHeaderImage('ranking');
  else if (pageId === 'page-setting') {
    showHeaderImage('setting');
    // 設定ページが表示されたら初期化関数を呼び出し
    initializeSettingsPage();
    // 設定ページが表示されたらユーザー情報を更新
    updateUserInfo();
  }
  else showHeaderImage(null);

  // ヘッダータイトルの更新
  const titles = {
    'page-login': 'ログイン',
    'page-register': '新規登録',
    'page-home': 'ホーム',
    'page-map': 'マップ',
    'page-ranking': 'ランキング',
    'page-setting': '設定'
  };
  headerTitle.textContent = titles[pageId] || 'Hare/Ame';

  // #appにクラスを付け替える
  const app = document.getElementById('app');
  if (pageId === 'page-home' || pageId === 'page-map' || pageId === 'page-ranking' || pageId === 'page-setting') {
    app.classList.add('bg-sky');
  } else {
    app.classList.remove('bg-sky');
  }
}

const headerImgContainer = document.getElementById('header-img-container');
const headerImg = document.getElementById('header-img');

function showHeaderImage(type) {
  const images = {
    home: '/img/header-home.png',
    map: '/img/header-map.png',
    ranking: '/img/header-ranking.png',
    setting: '/img/header-setting.png',
  };

  if (type && images[type]) {
    headerImg.src = images[type];
    headerImgContainer.style.display = 'block';
    headerTitle.style.display = 'none';
    console.log(`ヘッダー画像を${type}に変更しました:`, images[type]);
  } else {
    headerImgContainer.style.display = 'none';
    headerTitle.style.display = 'block';
    console.log('ヘッダー画像を非表示にして、タイトルを表示しました');
  }
}

// (startLocationTracking, stopLocationTracking, registerForm logic... is unchanged)

const registerForm = document.getElementById('register-form');
registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  console.log('=== FRONTEND REGISTER ATTEMPT ===');
  console.log('Register form submitted at:', new Date().toISOString());

  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const genderElement = document.querySelector('input[name="gender"]:checked');

  console.log('Form data:', {
    username,
    email,
    passwordLength: password.length,
    gender: genderElement ? genderElement.value : 'not selected'
  });

  // クライアントサイドのバリデーション
  if (username.length < 3 || username.length > 50) {
    console.log('Frontend validation failed: Invalid username length');
    alert('ユーザー名は3文字以上50文字以下で入力してください');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log('Frontend validation failed: Invalid email format');
    alert('有効なメールアドレスを入力してください');
    return;
  }

  if (password.length < 6) {
    console.log('Frontend validation failed: Password too short');
    alert('パスワードは6文字以上で入力してください');
    return;
  }

  // 性別が選択されているかチェック
  if (!genderElement) {
    console.log('Frontend validation failed: Gender not selected');
    alert('性別を選択してください');
    return;
  }
  const gender = genderElement.value;

  console.log('Sending register request to:', `${API_BASE}/register`);

  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, gender }),
    });

    console.log('Register response received - Status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('Register response data:', data);

    if (response.ok) {
      console.log('Registration successful');
      alert(data.message);
      showPage('page-login');
    } else {
      console.log('Registration failed with status:', response.status);
      alert(`エラー: ${data.message}`);
    }
  } catch (error) {
    console.error('=== FRONTEND REGISTER ERROR ===');
    console.error('Network error during registration:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    alert('サーバーとの通信に失敗しました。ネットワーク接続を確認してください。');
  }
});

async function checkLoginStatus() {
  const token = localStorage.getItem('token');

  if (!token) {
    console.log('No token found in localStorage. Redirecting to login page.');
    footerNav.classList.add('hidden');
    showPage('page-login');
    return;
  }

  console.log('Token found in localStorage:', token);

  try {
    const response = await fetch(`${API_BASE}/status`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}` // 修正
      }
    });

    console.log('Response from /status endpoint:', response);

    if (response.ok) {
      console.log('Session restored successfully.');
      footerNav.classList.remove('hidden');
      showPage('page-home');
      startPeriodicLocationUpdate(); // 定期更新を開始

      // セッション復元時もユーザーの設定を確認してから位置情報追跡を開始
      loadUserSettings().then(settings => {
        if (settings && settings.location_enabled) {
          checkLocationPermission().then(permissionState => {
            if (permissionState === 'granted') {
              startLocationTracking();
            } else {
              console.log('位置情報パーミッションが許可されていないため、追跡を開始できません');
            }
          });
        } else {
          console.log('位置情報許可設定がOFFのため、追跡を開始しません');
        }
      }).catch(error => {
        console.error('設定取得エラー:', error);
      });

      updateHomePageStatus();
      document.querySelector('.nav-button[data-page="home"]').classList.add('active');
    } else {
      console.log('Invalid session token. Response status:', response.status);
      localStorage.removeItem('token');
      footerNav.classList.add('hidden');
      showPage('page-login');
    }

  } catch (error) {
    console.error('Failed to verify token. Error:', error); // 修正
    footerNav.classList.add('hidden');
    showPage('page-login');
  }
}


async function updateHomePageStatus() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const response = await fetch(`${API_BASE}/status`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();

      const statusTextElement = document.getElementById('status-text');
      const statusImageElement = document.getElementById('status-image');

      // バックエンドから受け取った称号を表示
      statusTextElement.textContent = `${data.status}です`;

      // 称号に応じた画像と絵文字のマップ
      const statusVisuals = {
        '太陽神': '☀️', '晴れ男': '😊', '凡人': '😐', '雨男': '☔', '嵐を呼ぶ者': '⚡️', 'デフォルト': '🤔'
      };
      const emoji = statusVisuals[data.status] || statusVisuals['デフォルト'];
      statusImageElement.src = `https://placehold.jp/150x150.png?text=${encodeURIComponent(emoji)}`;
    }
  } catch (error) {
    console.error('ステータスの取得に失敗:', error);
  }
}

const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  console.log('=== FRONTEND LOGIN ATTEMPT ===');
  console.log('Login form submitted at:', new Date().toISOString());
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  // クライアントサイドのバリデーション
  if (!email || !password) {
    console.log('Frontend validation failed: Missing email or password');
    alert('メールアドレスとパスワードを入力してください');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log('Frontend validation failed: Invalid email format');
    alert('有効なメールアドレスを入力してください');
    return;
  }

  console.log('Email:', email, 'Password length:', password.length);
  console.log('Sending request to:', `${API_BASE}/login`);

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include', // 認証情報を含める
    });

    console.log('Response received - Status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('Response data:', data);

    if (response.ok) {
      console.log('Login successful, storing token');
      alert(data.message);
      localStorage.setItem('token', data.token);
      startPeriodicLocationUpdate(); // 定期更新を開始

      // ログイン成功時にフッターを表示し、ホームへ遷移
      footerNav.classList.remove('hidden');
      showPage('page-home');

      // ユーザーの設定を確認してから位置情報追跡を開始
      loadUserSettings().then(settings => {
        if (settings && settings.location_enabled) {
          checkLocationPermission().then(permissionState => {
            if (permissionState === 'granted') {
              startLocationTracking();
            } else {
              console.log('位置情報パーミッションが許可されていないため、追跡を開始できません');
            }
          });
        } else {
          console.log('位置情報許可設定がOFFのため、追跡を開始しません');
        }
      }).catch(error => {
        console.error('設定取得エラー:', error);
      });

      updateHomePageStatus();

      // ナビボタンのアクティブ状態をリセット
      navButtons.forEach(btn => btn.classList.remove('active'));
      document.querySelector('.nav-button[data-page="home"]').classList.add('active');
    } else {
      console.log('Login failed with status:', response.status);
      alert(`エラー: ${data.message}`);
    }
  } catch (error) {
    console.error('=== FRONTEND LOGIN ERROR ===');
    console.error('Network error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    alert('サーバーとの通信に失敗しました。ネットワーク接続を確認してください。');
  }
});

navButtons.forEach(button => {
  button.addEventListener('click', () => {
    const pageId = `page-${button.dataset.page}`;
    showPage(pageId);
    navButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    if (button.dataset.page === "home") {
      updateHomePageStatus();
    } else if (button.dataset.page === "map") {
      setTimeout(initializeMap, 100);
    } else if (button.dataset.page === "ranking") {
      updateRankingPage();
    } else if (button.dataset.page === "setting") {
      console.log('設定ページが表示されました');
    }
  });
});

document.getElementById('show-register-button').addEventListener('click', () => showPage('page-register'));
document.getElementById('show-login-button').addEventListener('click', () => showPage('page-login'));

// ログアウト処理
document.getElementById('logout-button').addEventListener('click', () => {
  console.log('Logout button clicked');
  localStorage.removeItem('token');
  stopPeriodicLocationUpdate(); // 定期更新を停止
  stopLocationTracking(); // 位置情報追跡を停止
  showPage('page-login');
  alert('ログアウトしました');
});

// 5分ごとに位置情報を送信する関数
function sendLocation() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('定期更新スキップ: トークンがありません');
    stopPeriodicLocationUpdate(); // トークンがなければ停止
    return;
  }

  console.log('定期更新: 位置情報を取得・送信します');
  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    try {
      const response = await fetch(`${API_BASE}/log-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ latitude, longitude })
      });
      const data = await response.json();
      if (response.ok) {
        console.log('定期更新成功:', data);
        // ホーム画面にいる場合、ステータスを更新
        if (document.getElementById('page-home').classList.contains('hidden') === false) {
          updateHomePageStatus();
        }
      } else {
        console.error('定期更新エラー:', data.message);
      }
    } catch (error) {
      console.error('定期更新中に通信エラー:', error);
    }
  }, (error) => {
    console.error('定期更新中の位置情報取得エラー:', error.message);
  });
}

// 定期的な位置情報更新を開始する関数
function startPeriodicLocationUpdate() {
  // 既に実行中の場合は何もしない
  if (locationUpdateIntervalId) {
    console.log('定期更新は既に開始されています');
    return;
  }
  console.log('5分ごとの定期更新を開始します');
  // まず一度すぐに実行
  sendLocation();
  // その後、5分ごとに実行
  locationUpdateIntervalId = setInterval(sendLocation, 5 * 60 * 1000); // 5分 = 300,000ミリ秒
}

// 定期的な位置情報更新を停止する関数
function stopPeriodicLocationUpdate() {
  if (locationUpdateIntervalId) {
    console.log('定期更新を停止します');
    clearInterval(locationUpdateIntervalId);
    locationUpdateIntervalId = null;
  }
}

// 初期表示時にフッターを非表示にし、ログインページを表示
footerNav.classList.add('hidden');
showPage('page-login');

//ここからはランキング機能
async function updateRankingPage() {
  const rankingList = document.getElementById('ranking-list');
  rankingList.innerHTML = '<li>ランキングを読み込んでいます...</li>';
  const token = localStorage.getItem('token');
  if (!token) {
    rankingList.innerHTML = '<li>ログインが必要です</li>';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/ranking`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new Error('network response was not ok');
    }
    const rankingData = await response.json();
    rankingList.innerHTML = "";

    if (rankingData.length === 0) {
      rankingList.innerHTML = "<li>まだ誰もランクインしていません</li>";
      return;
    }

    rankingData.forEach((user, index) => {
      const listItem = document.createElement('li');
      listItem.textContent = `${index + 1}位: ${user.username} (スコア: ${Number(user.score).toFixed(1)})`;
      rankingList.appendChild(listItem);
    });
  } catch (error) {
    console.error('ランキングの取得に失敗:', error);
    rankingList.innerHTML = "<li>ランキングの取得に失敗しました</li>";
  }
}

//ここからは地図機能

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★【重要】変数の宣言を、関数定義の前に移動します
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// 地図関連の変数（TDZ回避のため function-scope）


// ユーザーの位置情報を取得してマーカーを表示
async function loadUserMarkers() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('ユーザーマーカー読み込みスキップ: 認証トークンなし');
    return;
  }

  try {
    console.log('ユーザー位置情報を取得中...');
    const response = await fetch(`${API_BASE}/users-locations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('取得したユーザー位置情報:', data);

    // 期待するデータ形状の確認
    if (!data || !Array.isArray(data.users)) {
      console.warn('Unexpected response shape for /users-locations. Expected { users: [...] } but got:', data);
      return;
    }

    // 既存のマーカーをクリア（マップ未初期化時はスキップ）
    if (!Array.isArray(userMarkers)) {
      userMarkers = [];
    }
    if (!leafletMap) {
      console.warn('Leaflet map is not initialized yet. Skip clearing markers.');
    } else {
      userMarkers.forEach(marker => leafletMap.removeLayer(marker));
    }
    userMarkers = [];

    // 各ユーザーのマーカーを追加
    data.users.forEach(user => {
      if (!leafletMap) {
        return; // マップ未初期化ならスキップ
      }
      const color = weatherColors[user.weather] || weatherColors['unknown'];
      const emoji = weatherEmojis[user.weather] || weatherEmojis['unknown'];

      // カスタムマーカーアイコンを作成
      const customIcon = L.divIcon({
        html: `
          <div class="user-marker" style="
            background-color: ${color};
            border: 2px solid #333;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          ">
            ${emoji}
          </div>
        `,
        className: '', // Leafletのデフォルトクラスを無効化
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([user.latitude, user.longitude], { icon: customIcon })
        .addTo(leafletMap)
        .bindPopup(`<b>${user.username}</b><br>天気: ${user.weather}<br>記録日時: ${new Date(user.recordedAt).toLocaleString()}`);

      userMarkers.push(marker);
    });

    console.log(`${userMarkers.length}個のユーザーマーカーをマップに追加しました`);

  } catch (error) {
    console.error('ユーザーマーカーの読み込みに失敗しました:', error);
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
    console.log('Map already initialized. Invalidating size.');
    if (leafletMap) {
      leafletMap.invalidateSize(); // 表示を更新
    }
    loadUserMarkers(); // マーカーを再読み込み
    return;
  }

  console.log('Initializing map for the first time.');
  // 初回のみマップを初期化
  leafletMap = L.map(container).setView([35.681236, 139.767125], 13); // 初期中心を東京駅に設定

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(leafletMap);

  // ユーザーのマーカーを読み込む
  loadUserMarkers();
}

// アイコン機能

const iconInput = document.getElementById('iconInput');
const iconPreview = document.getElementById('iconPreview');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const imageInfo = document.getElementById('imageInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const imageDimensions = document.getElementById('imageDimensions');

// 要素存在チェック
if (!iconInput) console.warn('iconInput element not found');
if (!iconPreview) console.warn('iconPreview element not found');
if (!saveBtn) console.warn('saveBtn element not found');
if (!resetBtn) console.warn('resetBtn element not found');
if (!imageInfo) console.warn('imageInfo element not found');
if (!fileName) console.warn('fileName element not found');
if (!fileSize) console.warn('fileSize element not found');
if (!imageDimensions) console.warn('imageDimensions element not found');



// ページ読み込み時に保存されたアイコンを復元
window.addEventListener('DOMContentLoaded', () => {
  loadSavedIcon();

  // ページ読み込み時にログイン状態を確認し、位置情報追跡を開始
  const token = localStorage.getItem('token');
  if (token) {
    loadUserSettings().then(settings => {
      if (settings && settings.location_enabled) {
        checkLocationPermission().then(permissionState => {
          if (permissionState === 'granted') {
            startLocationTracking();
          } else {
            console.log('位置情報パーミッションが許可されていないため、追跡を開始できません');
          }
        });
      } else {
        console.log('位置情報許可設定がOFFのため、追跡を開始しません');
      }
    }).catch(error => {
      console.error('設定取得エラー:', error);
    });
  }
});

// ファイル選択時の処理
if (iconInput) iconInput.addEventListener('change', function (event) {
  const file = event.target.files[0];

  if (file) {
    // ファイルタイプのチェック
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }

    // ファイルサイズのチェック（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください。');
      return;
    }

    // FileReaderを使用して画像を読み込み
    const reader = new FileReader();

    reader.onload = function (e) {
      selectedImageData = e.target.result;
      displayImagePreview(selectedImageData);
      displayImageInfo(file);
      saveBtn.disabled = false;
    };

    reader.onerror = function () {
      alert('ファイルの読み込みに失敗しました。');
    };

    reader.readAsDataURL(file);
  }
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
  } catch (e) {
    console.warn('localStorageの容量が不足している可能性があります');
    return false;
  }
}

// 初期化時に容量チェック
checkLocalStorageSpace();

// 設定ページの初期化関数
function initializeSettingsPage() {
  console.log('設定ページを初期化します');

  // アイコン機能の要素を取得
  const iconInput = document.getElementById('iconInput');
  const iconPreview = document.getElementById('iconPreview');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const imageInfo = document.getElementById('imageInfo');

  // アイコン選択のイベントリスナー
  if (iconInput && !iconInput.hasAttribute('data-initialized')) {
    iconInput.setAttribute('data-initialized', 'true');
    iconInput.addEventListener('change', function (event) {
      const file = event.target.files[0];
      if (file) {
        // ファイルタイプのチェック
        if (!file.type.startsWith('image/')) {
          alert('画像ファイルを選択してください。');
          return;
        }
        // ファイルサイズのチェック（5MB以下）
        if (file.size > 5 * 1024 * 1024) {
          alert('ファイルサイズは5MB以下にしてください。');
          return;
        }
        // ファイル読み込み処理
        const reader = new FileReader();
        reader.onload = function (e) {
          selectedImageData = e.target.result;
          displayImagePreview(selectedImageData);
          displayImageInfo(file);
          if (saveBtn) saveBtn.disabled = false;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // 保存ボタンのイベントリスナー
  if (saveBtn && !saveBtn.hasAttribute('data-initialized')) {
    saveBtn.setAttribute('data-initialized', 'true');
    saveBtn.addEventListener('click', async function () {
      if (selectedImageData) {
        await saveIconToServer(selectedImageData);
      }
    });
  }

  // リセットボタンのイベントリスナー
  if (resetBtn && !resetBtn.hasAttribute('data-initialized')) {
    resetBtn.setAttribute('data-initialized', 'true');
    resetBtn.addEventListener('click', function () {
      if (confirm('アイコンをリセットしますか？')) {
        if (iconPreview) {
          iconPreview.innerHTML = '<span class="icon-placeholder">アイコンを選択してください</span>';
        }
        if (iconInput) iconInput.value = '';
        if (imageInfo) imageInfo.classList.remove('show');
        if (saveBtn) saveBtn.disabled = true;
        selectedImageData = null;
        // サーバーからも削除（オプション）
        console.log('アイコンがリセットされました');
      }
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
          alert('画像ファイルをドロップしてください。');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          alert('ファイルサイズは5MB以下にしてください。');
          return;
        }
        const reader = new FileReader();
        reader.onload = function (event) {
          selectedImageData = e.target.result;
          displayImagePreview(selectedImageData);
          displayImageInfo(file);
          if (saveBtn) saveBtn.disabled = false;
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

  // 位置情報のパーミッション状態を確認
  updateLocationSwitch();
}

// ユーザー情報をAPIから取得して表示する関数
async function loadUserInfo() {
  const token = localStorage.getItem('token');
  if (!token) {
    // トークンがない場合はログインページにリダイレクト
    showPage('login');
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
      const userData = await response.json();

      if (userIdElement) {
        userIdElement.textContent = `ID：${userData.id}`;
      }
      if (userNameElement) {
        userNameElement.textContent = `ユーザ名：${userData.username}`;
      }

      console.log('ユーザー情報を取得しました:', userData);
    } else if (response.status === 401) {
      // 認証エラーの場合はログアウト
      console.error('認証エラー: トークンが無効です');
      localStorage.removeItem('token');
      showPage('login');
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
  // 通知設定
  const notificationSwitch = document.getElementById('notification-switch');
  if (notificationSwitch) {
    // APIから設定を読み込み
    loadUserSettings().then(settings => {
      if (settings) {
        notificationSwitch.checked = settings.notification_enabled;
      }
    });

    notificationSwitch.addEventListener('change', function () {
      console.log('=== 通知設定変更イベント開始 ===');
      console.log('通知設定スイッチ変更:', this.checked);
      console.log('このスイッチのID:', this.id);

      // 念のため、位置情報追跡が開始されないことを確認
      console.log('通知設定変更: 位置情報追跡は開始しません');

      saveUserSettings();
      console.log('通知設定:', this.checked ? '有効' : '無効');
      console.log('=== 通知設定変更イベント終了 ===');
      // 注意: 通知設定の変更では位置情報追跡を開始しない
    });
  }

  // 位置情報許可設定
  const locationSwitch = document.getElementById('location-switch');
  if (locationSwitch) {
    // APIから設定を読み込み
    loadUserSettings().then(settings => {
      if (settings) {
        locationSwitch.checked = settings.location_enabled;
      }
    });

    locationSwitch.addEventListener('change', async function () {
      console.log('=== 位置情報許可設定変更イベント開始 ===');
      console.log('位置情報許可スイッチ変更:', this.checked);

      if (this.checked) {
        // 位置情報を有効にする場合、パーミッションを確認
        const permissionState = await checkLocationPermission();
        console.log('位置情報パーミッション状態:', permissionState);
        if (permissionState === 'denied') {
          alert('位置情報のパーミッションがブロックされています。\n' +
            'ブラウザの設定から位置情報のパーミッションを許可してください。');
          this.checked = false;
          console.log('位置情報許可設定をOFFに戻しました');
          return;
        }
      }

      saveUserSettings();
      console.log('位置情報許可設定:', this.checked ? '有効' : '無効');

      // 設定変更後に位置情報追跡状態を更新（パーミッションも考慮）
      if (this.checked) {
        console.log('位置情報許可がONになったため、追跡を開始します');
        // 位置情報許可がONになった場合、パーミッションを確認してから開始
        checkLocationPermission().then(permissionState => {
          console.log('追跡開始前のパーミッション確認:', permissionState);
          if (permissionState === 'granted') {
            console.log('パーミッションが許可されているため、位置情報追跡を開始します');
            startLocationTracking();
          } else {
            console.log('位置情報パーミッションが許可されていないため、追跡を開始できません');
          }
        });
      } else {
        console.log('位置情報許可がOFFになったため、追跡を停止します');
        // 位置情報許可がOFFになった場合、追跡を停止
        stopLocationTracking();
      }
      console.log('=== 位置情報許可設定変更イベント終了 ===');
    });
  }
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
      return await response.json();
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
async function saveUserSettings() {
  const token = localStorage.getItem('token');
  if (!token) return;

  const notificationSwitch = document.getElementById('notification-switch');
  const locationSwitch = document.getElementById('location-switch');
  const messageTextarea = document.getElementById('message');

  const settings = {
    notification_enabled: notificationSwitch ? notificationSwitch.checked : true,
    location_enabled: locationSwitch ? locationSwitch.checked : false,
    introduction_text: messageTextarea ? messageTextarea.value : ''
  };

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
      console.log('設定が保存されました');
    } else {
      console.error('設定の保存に失敗しました');
    }
  } catch (error) {
    console.error('設定の保存に失敗:', error);
  }
}

// 自己紹介機能の初期化
function initializeIntroduction() {
  const messageTextarea = document.getElementById('message');
  if (messageTextarea) {
    // APIから自己紹介を読み込み
    loadUserSettings().then(settings => {
      if (settings && settings.introduction_text) {
        messageTextarea.value = settings.introduction_text;
      }
    });

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
    alert('ログインが必要です');
    return;
  }

  try {
    // Base64データをCanvasで圧縮
    const compressedImageData = await compressImage(imageData);

    // 圧縮後のBase64データからファイルサイズを計算
    const base64Data = compressedImageData.split(',')[1];
    const fileSize = Math.round((base64Data.length * 3) / 4);

    console.log(`元のサイズ: ${Math.round((imageData.length * 3) / 4)} bytes`);
    console.log(`圧縮後のサイズ: ${fileSize} bytes`);

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
      const saveBtn = document.getElementById('saveBtn');
      if (saveBtn) {
        saveBtn.textContent = '保存完了！';
        saveBtn.style.background = '#28a745';
        setTimeout(() => {
          saveBtn.textContent = '保存';
          saveBtn.style.background = '';
        }, 2000);
      }
      console.log('アイコンが保存されました');
    } else {
      const errorData = await response.json();
      alert(`保存に失敗しました: ${errorData.message || '不明なエラー'}`);
    }
  } catch (error) {
    console.error('アイコン保存エラー:', error);
    alert('保存に失敗しました。ネットワークエラーが発生しました。');
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
    iconPreview.innerHTML = `<img src="${imageData}" alt="アイコンプレビュー" style="max-width: 100%; max-height: 100%; border-radius: 50%; object-fit: cover;">`;
  }
}

// 画像情報を表示する関数
function displayImageInfo(file) {
  const imageInfo = document.getElementById('imageInfo');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const imageDimensions = document.getElementById('imageDimensions');

  if (fileName) fileName.textContent = `ファイル名: ${file.name}`;
  if (fileSize) fileSize.textContent = `サイズ: ${(file.size / 1024).toFixed(1)} KB`;

  // 画像の寸法を取得
  const img = new Image();
  img.onload = function () {
    if (imageDimensions) {
      imageDimensions.textContent = `寸法: ${img.width} x ${img.height}`;
    }
  };
  img.src = URL.createObjectURL(file);

  if (imageInfo) imageInfo.classList.add('show');
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
        displayImagePreview(imageData);
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.disabled = false;
      };

      reader.readAsDataURL(blob);
      console.log('保存されたアイコンを読み込みました');
    } else if (response.status === 204 || response.status === 404) {
      // アイコンが存在しない場合（204 No Content / 404 Not Found）は静かに無視
      console.log('アイコンが未設定（No Content / Not Found）');
    } else {
      console.error('アイコンの取得に失敗しました');
    }
  } catch (error) {
    console.error('アイコンの取得に失敗:', error);
  }
}

// 位置情報追跡を開始する関数
function startLocationTracking() {
  if (navigator.geolocation) {
    // 既に追跡中の場合は停止してから再開
    if (locationWatchId !== null) {
      navigator.geolocation.clearWatch(locationWatchId);
      locationWatchId = null;
    }

    console.log('位置情報追跡を開始します...');
    locationWatchId = navigator.geolocation.watchPosition(
      function (position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        console.log('位置情報更新:', {
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
          accuracy: accuracy.toFixed(1) + 'm',
          timestamp: new Date(position.timestamp).toLocaleTimeString()
        });

        // 位置情報をサーバーに送信
        sendLocationToServer(latitude, longitude);
      },
      function (error) {
        console.error('位置情報取得エラー:', error);
        handleLocationError(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // 30秒に延長
        maximumAge: 300000 // 5分
      }
    );

    console.log('位置情報追跡リクエストを送信しました (Watch ID:', locationWatchId, ')');
  } else {
    alert('このブラウザは位置情報に対応していません。');
  }
}

// 位置情報エラーを処理する関数
function handleLocationError(error) {
  let message = '';
  let shouldRetry = false;

  switch (error.code) {
    case error.PERMISSION_DENIED:
      message = '位置情報のパーミッションが拒否されました。\n\n' +
        'パーミッションをリセットするには：\n' +
        '1. ブラウザのアドレスバーの左側にある🔒アイコンをクリック\n' +
        '2. 「位置情報」を「許可」に変更\n' +
        '3. ページをリロードしてください\n\n' +
        'または、ブラウザの設定から位置情報のパーミッションをリセットしてください。';
      break;
    case error.POSITION_UNAVAILABLE:
      message = '位置情報を取得できませんでした。\nGPSが有効になっているか確認してください。';
      shouldRetry = true;
      break;
    case error.TIMEOUT:
      message = '位置情報の取得がタイムアウトしました。\nネットワーク接続やGPS信号を確認してください。\n\n再度試行します...';
      shouldRetry = true;
      break;
    default:
      message = '位置情報の取得中に不明なエラーが発生しました。';
      shouldRetry = true;
      break;
  }

  console.log('位置情報エラー処理:', { code: error.code, message: error.message, shouldRetry });

  // タイムアウトや不明なエラーの場合は自動リトライ
  if (shouldRetry && locationWatchId !== null) {
    console.log('3秒後に位置情報取得を再試行します...');
    setTimeout(() => {
      console.log('位置情報取得を再試行します');
      // 現在の追跡を停止してから再開
      stopLocationTracking();
      setTimeout(() => startLocationTracking(), 1000);
    }, 3000);
  } else {
    alert(message);
  }
}

// 位置情報追跡を停止する関数
function stopLocationTracking() {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
    console.log('位置情報追跡を停止しました');
  } else {
    console.log('位置情報追跡は既に停止しています');
  }
}

// 位置情報をサーバーに送信する関数
function sendLocationToServer(latitude, longitude) {
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('位置情報送信スキップ: 認証トークンなし');
    return;
  }

  console.log('位置情報送信開始:', { latitude, longitude, endpoint: `${API_BASE}/log-location` });

  fetch(`${API_BASE}/log-location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      latitude: latitude,
      longitude: longitude
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('位置情報送信に失敗しました');
      }
      return response.json();
    })
    .then(data => {
      console.log('位置情報送信成功:', data);
    })
    .catch(error => {
      console.error('位置情報送信エラー:', error);
    });
}

// テスト用の位置情報を追加する関数（開発用）
function addTestLocationData() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('テストデータ追加スキップ: 認証トークンなし');
    return;
  }

  // 金沢周辺のテスト位置情報
  const testLocations = [
    { latitude: 36.5777, longitude: 136.6483 }, // 金沢駅周辺
    { latitude: 36.5947, longitude: 136.6256 }, // 金沢21世紀美術館周辺
    { latitude: 36.5611, longitude: 136.6567 }  // 兼六園周辺
  ];

  testLocations.forEach((location, index) => {
    setTimeout(() => {
      console.log(`テスト位置情報送信 ${index + 1}:`, location);
      sendLocationToServer(location.latitude, location.longitude);
    }, index * 1000); // 1秒ごとに送信
  });
}

// グローバルスコープにテスト関数を公開（開発用）
window.addTestLocationData = addTestLocationData;

// テストボタンのイベントリスナーを設定
document.addEventListener('DOMContentLoaded', function () {
  const testBtn = document.getElementById('test-location-btn');
  if (testBtn) {
    testBtn.addEventListener('click', function () {
      console.log('テスト位置情報追加ボタンがクリックされました');
      addTestLocationData();
    });
  }
});
async function checkLocationPermission() {
  if (!navigator.permissions) {
    return 'unknown';
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state; // 'granted', 'denied', 'prompt'
  } catch (error) {
    console.error('パーミッション確認エラー:', error);
    return 'unknown';
  }
}

// 設定画面の位置情報スイッチ表示を、ブラウザのパーミッション状態に合わせて更新
function updateLocationSwitch() {
  const locationSwitch = document.getElementById('location-switch');
  if (!locationSwitch) return;

  checkLocationPermission()
    .then((state) => {
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
    .catch((err) => {
      console.warn('位置情報パーミッション状態の取得に失敗:', err);
    });
}

