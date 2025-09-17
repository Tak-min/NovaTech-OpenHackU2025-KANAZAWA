import "./style.css";

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
  else showHeaderImage(null);

  // ヘッダータイトルの更新
  const titles = {
    'page-login': 'ログイン',
    'page-register': '新規登録',
    'page-home': 'ホーム',
    'page-map': 'マップ',
    'page-ranking': 'ランキング',
  };
  headerTitle.textContent = titles[pageId] || 'Hare/Ame';

  // #appにクラスを付け替える
  const app = document.getElementById('app');
  if (pageId === 'page-home' || pageId === 'page-map' || pageId === 'page-ranking') {
    app.classList.add('bg-sky');
  } else {
    app.classList.remove('bg-sky');
  }
}

const headerImgContainer = document.getElementById('header-img-container');
const headerImg = document.getElementById('header-img');

function showHeaderImage(type) {
  const images = {
    home: 'frontend\img\header-home.png',
    map: 'frontend\img\header-map.png',
    ranking: 'frontend\img\header-ranking.png',
  };

  if (type && images[type]) {
    headerImg.src = images[type];
    headerImgContainer.style.display = 'block';
    headerTitle.style.display = 'none';
  } else {
    headerImgContainer.style.display = 'none';
    headerTitle.style.display = 'block';
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
          await fetch('https://soralog-backend.onrender.com/log-location', {
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

  console.log('Sending register request to:', 'https://soralog-backend.onrender.com/register');

  try {
    const response = await fetch('https://soralog-backend.onrender.com/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, gender}),
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
    const response = await fetch('https://soralog-backend.onrender.com/status', {
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
    const response = await fetch('https://soralog-backend.onrender.com/status', {
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
  console.log('Sending request to:', 'https://soralog-backend.onrender.com/login');

  try {
    const response = await fetch('https://soralog-backend.onrender.com/login', {
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
    const response = await fetch('https://soralog-backend.onrender.com/ranking');
    if (!response.ok) {
      throw new Error('network response was not ok');
    }
    const rankingData = await response.json();
    rankingList.innerHTML = "";

    if (rankingData.length === 0){
      rankingList.innerHTML = "<li>まだ誰もランクインしていません</li>";
      return;
    }

    rankingData.forEach((user, index) => {
      const listItem = document.createElement('li');
      listItem.textContent =`${index + 1}位: ${user.username} (スコア: ${Number(user.score).toFixed(1)})`;
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
    const response = await fetch('https://soralog-backend.onrender.com/users-locations', {
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