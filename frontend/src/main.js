import "./style.css";

// 全てのページ要素とナビゲーションボタンを取得
const pages = document.querySelectorAll('main section');
const navButtons = document.querySelectorAll('.nav-button');
const headerTitle = document.getElementById('header-title');

// ページを切り替える関数
function showPage(pageId) {
  // すべてのページを一旦隠す
  pages.forEach(page => {
    page.classList.add('hidden');
  });

  // 対象のページだけを表示
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.remove('hidden');
  }

  if (pageId === 'page-home') {
    showHeaderImage('home');
  } else if (pageId === 'page-map') {
    showHeaderImage('map');
  } else if (pageId === 'page-ranking') {
    showHeaderImage('ranking');
  } else {
    showHeaderImage(null);
  }

  // ヘッダーのタイトルを更新
  const titles = {
    'page-login': 'ログイン',
    'page-register': '新規登録',
    'page-home': 'ホーム',
    'page-map': 'マップ',
    'page-ranking': 'ランキング',
  };
  headerTitle.textContent = titles[pageId] || 'Hare/Ame';
}

// 画像切り替え用の要素取得
const headerImgContainer = document.getElementById('header-img-container');
const headerImg = document.getElementById('header-img');

// 画像切り替え関数
function showHeaderImage(type) {
  if (type === 'home') {
    headerImg.src = '/img/header-home.png';
    headerImg.alt = 'ホームヘッダー';
    headerImgContainer.style.display = 'block';
    headerTitle.style.display = 'none';
  } else if (type === 'map') {
    headerImg.src = '/img/header-map.png';
    headerImg.alt = 'マップヘッダー';
    headerImgContainer.style.display = 'block';
    headerTitle.style.display = 'none';
  } else if (type === 'ranking') {
    headerImg.src = '/img/header-ranking.png';
    headerImg.alt = 'ランキングヘッダー';
    headerImgContainer.style.display = 'block';
    headerTitle.style.display = 'none';
  } else {
    headerImgContainer.style.display = 'none';
    headerTitle.style.display = 'block';
  }
}

let locationIntervalId = null; // 位置情報送信を管理するためのID

// [新機能] 位置情報の追跡を開始する関数
function startLocationTracking() {
  // 既に実行中の場合は何もしない
  if (locationIntervalId) {
    return;
  }

  console.log('位置情報の追跡を開始します...');

  // 10秒ごとに処理を実行
  locationIntervalId = setInterval(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // トークンがなければ追跡を停止
      stopLocationTracking();
      return;
    }

    // ブラウザのGeolocation APIを使って現在地を取得
    navigator.geolocation.getCurrentPosition(
      // 成功時のコールバック
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log(`位置情報を取得しました: Lat ${latitude}, Lon ${longitude}`);

        try {
          const response = await fetch('http://localhost:3000/log-location', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // **重要**: 保存したトークンをヘッダーに付与
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ latitude, longitude })
          });
          
          const data = await response.json();
          if (response.ok) {
            console.log('サーバーに位置情報を記録しました:', data);
          } else {
            console.error('位置情報の記録に失敗:', data.message);
          }
        } catch (error) {
          console.error('通信エラー:', error);
        }
      },
      // 失敗時のコールバック
      (error) => {
        console.error('位置情報の取得に失敗:', error.message);
      }
    );
  }, 10000); // 3600000ミリ秒 = 1h
}

// [新機能] 位置情報の追跡を停止する関数
function stopLocationTracking() {
  if (locationIntervalId) {
    clearInterval(locationIntervalId);
    locationIntervalId = null;
    console.log('位置情報の追跡を停止しました。');
  }
}

// 登録フォームの要素を取得
const registerForm = document.getElementById('register-form');

// 登録フォームの送信イベントを監視
registerForm.addEventListener('submit', async (event) => {
  // フォームのデフォルトの送信動作をキャンセル
  event.preventDefault();

  // フォームから入力値を取得
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;

  // バックエンドAPIにデータを送信
  try {
    const response = await fetch('http://localhost:3000/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // 登録成功
      alert(data.message); // "ユーザー登録が成功しました"
      showPage('page-login'); // ログインページに切り替え
    } else {
      // 登録失敗 (メール重複など)
      alert(`エラー: ${data.message}`);
    }
  } catch (error) {
    console.error('通信エラー:', error);
    alert('サーバーとの通信に失敗しました。');
  }
});

// ホームページの表示を更新する関数
async function updateHomePageStatus() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const response = await fetch('http://localhost:3000/status', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      // HTML要素に判定結果を反映
      const statusTextElement = document.getElementById('status-text');
      const statusImageElement = document.getElementById('status-image');
      
      statusTextElement.textContent = `${data.status}です`;
      
      // 判定結果に応じて画像も切り替える
      if (data.status === '晴れ男') {
        statusImageElement.src = 'https://placehold.jp/150x150.png?text=☀️';
      } else if (data.status === '雨男') {
        statusImageElement.src = 'https://placehold.jp/150x150.png?text=☔';
      } else {
        statusImageElement.src = 'https://placehold.jp/150x150.png?text=😐';
      }
    }
  } catch (error) {
    console.error('ステータスの取得に失敗:', error);
  }
}


// ログインフォームの要素を取得
const loginForm = document.getElementById('login-form');

// ログインフォームの送信イベントを監視
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault(); // デフォルトの送信動作をキャンセル

  // フォームから入力値を取得
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // ログイン成功
      alert(data.message); // "ログインに成功しました"

      // **重要**: 認証トークンをブラウザに保存
      localStorage.setItem('token', data.token);

      // ホームページに切り替え
      showPage('page-home');
      startLocationTracking();
      updateHomePageStatus();
      // ナビゲーションボタンのアクティブ表示も更新
      document.querySelector('.nav-button[data-page="home"]').classList.add('text-yellow-500');
      document.querySelector('.nav-button[data-page="map"]').classList.remove('text-yellow-500');

    } else {
      // ログイン失敗
      alert(`エラー: ${data.message}`);
    }
  } catch (error) {
    console.error('通信エラー:', error);
    alert('サーバーとの通信に失敗しました。');
  }
});

// ナビゲーションボタンにクリックイベントを設定
navButtons.forEach(button => {
  button.addEventListener('click', () => {
    const pageId = `page-${button.dataset.page}`;
    showPage(pageId);

    // ボタンのアクティブ表示を切り替え
    navButtons.forEach(btn => btn.classList.remove('text-yellow-500'));
    button.classList.add('text-yellow-500');
    if(button.dataset.page ==- "home"){
      updateHomePageStatus();
    }
  });
});

// 新規登録・ログインページ切り替えボタンの設定
document.getElementById('show-register-button').addEventListener('click', () => showPage('page-register'));
document.getElementById('show-login-button').addEventListener('click', () => showPage('page-login'));

// 初期表示ページを設定
showPage('page-login');