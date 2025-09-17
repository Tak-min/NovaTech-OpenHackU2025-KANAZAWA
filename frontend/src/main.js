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
}

const headerImgContainer = document.getElementById('header-img-container');
const headerImg = document.getElementById('header-img');

function showHeaderImage(type) {
  const images = {
    home: '/img/header-home.png',
    map: '/img/header-map.png',
    ranking: '/img/header-ranking.png',
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
          await fetch('http://localhost:3000/log-location', {
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
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  try {
    const response = await fetch('http://localhost:3000/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await response.json();
    if (response.ok) {
      alert(data.message);
      showPage('page-login');
    } else {
      alert(`エラー: ${data.message}`);
    }
  } catch (error) {
    console.error('通信エラー:', error);
    alert('サーバーとの通信に失敗しました。');
  }
});


async function updateHomePageStatus() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const response = await fetch('http://localhost:3000/status', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      const statusTextElement = document.getElementById('status-text');
      const statusImageElement = document.getElementById('status-image');
      statusTextElement.textContent = `${data.status}です`;
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
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (response.ok) {
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
      alert(`エラー: ${data.message}`);
    }
  } catch (error) {
    console.error('通信エラー:', error);
    alert('サーバーとの通信に失敗しました。');
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
    }
  });
});

document.getElementById('show-register-button').addEventListener('click', () => showPage('page-register'));
document.getElementById('show-login-button').addEventListener('click', () => showPage('page-login'));

// 初期表示時にフッターを非表示にし、ログインページを表示
footerNav.classList.add('hidden');
showPage('page-login');

let map = null;
function initializeMap() {
  if (map || typeof L === 'undefined') return;
  const mapContainer = document.getElementById('map');
  const mapPage = document.getElementById('page-map');
  if (!mapContainer || (mapPage && mapPage.classList.contains('hidden'))) return;
  try {
    map = L.map('map').setView([36.5777, 136.6483], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    setTimeout(() => map.invalidateSize(), 200);
  } catch (error) {
    console.error('地図の初期化に失敗しました:', error);
  }
}