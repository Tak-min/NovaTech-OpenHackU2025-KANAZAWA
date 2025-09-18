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
  else if (pageId === 'page-setting') showHeaderImage('setting');
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
let locationIntervalId = null;

function startLocationTracking() {
  if (locationIntervalId) return;
  console.log('位置情報の追跡を開始します...');
  locationIntervalId = setInterval(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      stopLocationTracking();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log(`位置情報を取得しました: Lat ${latitude}, Lon ${longitude}`);
        try {
          await fetch(`${API_BASE}/log-location`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ latitude, longitude })
          });
        } catch (error) {
          console.error('通信エラー:', error);
        }
      },
      (error) => {
        console.error('位置情報の取得に失敗:', error.message);
      }
    );
  }, 60000);
}

function stopLocationTracking() {
  if (locationIntervalId) {
    clearInterval(locationIntervalId);
    locationIntervalId = null;
    console.log('位置情報の追跡を停止しました。');
  }
}

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
      startLocationTracking();
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

      // ログイン成功時にフッターを表示し、ホームへ遷移
      footerNav.classList.remove('hidden');
      showPage('page-home');
      startLocationTracking();
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

// 初期表示時にフッターを非表示にし、ログインページを表示
footerNav.classList.add('hidden');
showPage('page-login');

//ここからはランキング機能
async function updateRankingPage() {
  const rankingList = document.getElementById('ranking-list');
  rankingList.innerHTML = '<li>ランキングを読み込んでいます...</li>'

  try {
    const response = await fetch(`${API_BASE}/ranking`);
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


// 地図関連の変数
let map = null;
let userMarkers = [];

// 天気に応じたマーカーの色を定義
const weatherColors = {
  'sunny': '#FFD700',      // 金色
  'cloudy': '#87CEEB',     // スカイブルー
  'rainy': '#4169E1',      // ロイヤルブルー
  'snowy': '#FFFFFF',      // 白
  'thunderstorm': '#8A2BE2', // ブルーバイオレット
  'stormy': '#2F4F4F',     // ダークスレートグレー
  'unknown': '#808080'     // グレー
};

// 天気に応じた絵文字を定義
const weatherEmojis = {
  'sunny': '☀️',
  'cloudy': '☁️',
  'rainy': '🌧️',
  'snowy': '❄️',
  'thunderstorm': '⚡',
  'stormy': '🌪️',
  'unknown': '❓'
};

// ユーザーの位置情報を取得してマーカーを表示
async function loadUserMarkers() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('認証トークンがありません');
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

    // 既存のマーカーをクリア
    userMarkers.forEach(marker => map.removeLayer(marker));
    userMarkers = [];

    // 各ユーザーのマーカーを追加
    data.users.forEach(user => {
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
        className: 'custom-div-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      // マーカーを作成
      const marker = L.marker([user.latitude, user.longitude], {
        icon: customIcon
      }).addTo(map);

      // ポップアップを追加
      const recordedDate = new Date(user.recordedAt).toLocaleString('ja-JP');
      marker.bindPopup(`
        <div style="text-align: center;">
          <strong>${user.username}</strong><br>
          天気: ${emoji} ${user.weather}<br>
          記録日時: ${recordedDate}
        </div>
      `);

      userMarkers.push(marker);
    });

    console.log(`${data.users.length}人のユーザーマーカーを追加しました`);

  } catch (error) {
    console.error('ユーザー位置情報の取得に失敗しました:', error);
  }
}

// 最低限の地図表示機能
function initializeMap() {
  console.log('initializeMap関数が呼ばれました');
  // 地図コンテナが存在するかチェック
  const mapContainer = document.getElementById('map');
  console.log('地図コンテナが見つかりました');

  // 地図コンテナのサイズを確認
  const containerRect = mapContainer.getBoundingClientRect();
  console.log('地図コンテナのサイズ:', containerRect.width, 'x', containerRect.height);

  // コンテナが表示されているかチェック
  const mapPage = document.getElementById('page-map');
  if (mapPage && mapPage.classList.contains('hidden')) {
    console.error('地図ページが隠れています');
    return;
  }

  // 既に初期化済みの場合はユーザーマーカーのみ更新
  if (map) {
    console.log('地図は既に初期化済みです - ユーザーマーカーを更新します');
    loadUserMarkers();
    return;
  }

  // Leafletライブラリが読み込まれているかチェック
  if (typeof L === 'undefined') {
    console.log('Leafletライブラリが読み込まれていません。500ms後に再試行します...');
    setTimeout(initializeMap, 500);
    return;
  }
  console.log('Leafletライブラリが利用可能です');

  try {
    map = L.map('map').setView([36.5777, 136.6483], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    console.log('タイルレイヤーを追加しました');

    // 地図コンテナの最終的なサイズを確認
    const finalRect = mapContainer.getBoundingClientRect();
    console.log('地図初期化後のコンテナサイズ:', finalRect.width, 'x', finalRect.height);

    console.log('地図の初期化が完了しました');

    // 地図のサイズを再計算
    setTimeout(() => {
      console.log('地図のサイズを再計算します');
      map.invalidateSize();

      // 再計算後のサイズも確認
      const afterInvalidateRect = mapContainer.getBoundingClientRect();
      console.log('サイズ再計算後のコンテナサイズ:', afterInvalidateRect.width, 'x', afterInvalidateRect.height);

      console.log('地図のサイズ再計算完了');

      // タイルの読み込み状況を確認
      console.log('地図のズームレベル:', map.getZoom());
      console.log('地図の中心座標:', map.getCenter());

      // ユーザーマーカーを読み込み
      loadUserMarkers();
    }, 200);

  } catch (error) {
    console.error('地図の初期化に失敗しました:', error);
  }
}

//アイコン機能

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

// 選択された画像データを保存する変数
let selectedImageData = null;

// ページ読み込み時に保存されたアイコンを復元
window.addEventListener('DOMContentLoaded', () => {
  loadSavedIcon();
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

// 画像プレビューを表示する関数
function displayImagePreview(imageSrc) {
  iconPreview.innerHTML = `<img src="${imageSrc}" alt="選択されたアイコン">`;
}

// 画像情報を表示する関数
function displayImageInfo(file) {
  // ファイル名
  fileName.textContent = file.name;

  // ファイルサイズ（MB、KB、Bに変換）
  const size = file.size;
  let sizeText = '';
  if (size > 1024 * 1024) {
    sizeText = (size / (1024 * 1024)).toFixed(2) + ' MB';
  } else if (size > 1024) {
    sizeText = (size / 1024).toFixed(2) + ' KB';
  } else {
    sizeText = size + ' B';
  }
  fileSize.textContent = sizeText;

  // 画像の寸法を取得
  const img = new Image();
  img.onload = function () {
    imageDimensions.textContent = `${this.width} × ${this.height} px`;
  };
  img.src = selectedImageData;

  // 画像情報を表示
  imageInfo.classList.add('show');
}

// 保存ボタンのクリック処理 (要素存在チェック)
if (saveBtn) saveBtn.addEventListener('click', function () {
  if (selectedImageData) {
    // localStorageに画像データを保存
    try {
      localStorage.setItem('userIcon', selectedImageData);

      // 保存完了のアニメーション
      saveBtn.textContent = '保存完了！';
      saveBtn.style.background = '#28a745';

      setTimeout(() => {
        saveBtn.textContent = '保存';
        saveBtn.style.background = '#28a745';
      }, 2000);

      console.log('アイコンが保存されました');
    } catch (error) {
      alert('保存に失敗しました。画像サイズが大きすぎる可能性があります。');
      console.error('保存エラー:', error);
    }
  }
});

// リセットボタンのクリック処理 (要素存在チェック)
if (resetBtn) resetBtn.addEventListener('click', function () {
  if (confirm('アイコンをリセットしますか？')) {
    // プレビューをリセット
    iconPreview.innerHTML = '<span class="icon-placeholder">アイコンを選択してください</span>';

    // ファイル入力をリセット
    iconInput.value = '';

    // 画像情報を非表示
    imageInfo.classList.remove('show');

    // 保存ボタンを無効化
    saveBtn.disabled = true;

    // 選択された画像データをクリア
    selectedImageData = null;

    // localStorageからアイコンを削除
    localStorage.removeItem('userIcon');

    console.log('アイコンがリセットされました');
  }
});

// 保存されたアイコンを読み込む関数
function loadSavedIcon() {
  const savedIcon = localStorage.getItem('userIcon');
  if (savedIcon) {
    selectedImageData = savedIcon;
    displayImagePreview(savedIcon);
    saveBtn.disabled = false;

    // 保存済みアイコンの情報を表示
    const img = new Image();
    img.onload = function () {
      fileName.textContent = '保存済みアイコン';
      fileSize.textContent = calculateBase64Size(savedIcon);
      imageDimensions.textContent = `${this.width} × ${this.height} px`;
      imageInfo.classList.add('show');
    };
    img.src = savedIcon;
  }
}

// Base64データのサイズを計算する関数
function calculateBase64Size(base64String) {
  // Base64のヘッダー部分を除去
  const base64Data = base64String.split(',')[1];
  // Base64の文字数から実際のバイト数を計算
  const bytes = Math.round(base64Data.length * 0.75);

  if (bytes > 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  } else if (bytes > 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  } else {
    return bytes + ' B';
  }
}

// ドラッグ&ドロップ機能
if (iconPreview) {
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

      // ファイルタイプのチェック
      if (!file.type.startsWith('image/')) {
        alert('画像ファイルをドロップしてください。');
        return;
      }

      // ファイルサイズのチェック
      if (file.size > 5 * 1024 * 1024) {
        alert('ファイルサイズは5MB以下にしてください。');
        return;
      }

      // FileReaderで読み込み
      const reader = new FileReader();
      reader.onload = function (event) {
        selectedImageData = event.target.result;
        displayImagePreview(selectedImageData);
        displayImageInfo(file);
        if (saveBtn) saveBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    }
  });

  // アイコンプレビューをクリックしてファイル選択を開く
  iconPreview.addEventListener('click', function () {
    if (iconInput) iconInput.click();
  });
}

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
