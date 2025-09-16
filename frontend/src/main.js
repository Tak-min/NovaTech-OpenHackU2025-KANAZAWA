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
  }, 3600000); // 3600000ミリ秒 = 1h
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

// ホームページの表示を更新する関数 (改良版)
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
      
      const statusTextElement = document.getElementById('status-text');
      const statusImageElement = document.getElementById('status-image');
      
      // バックエンドから受け取った称号を表示
      statusTextElement.textContent = `${data.status}です`;
      
      // 称号に応じた画像と絵文字のマップ
      const statusVisuals = {
        '太陽神': '☀️',
        '晴れ男': '😊',
        '凡人': '😐',
        '雨男': '☔',
        '嵐を呼ぶ者': '⚡️',
        'デフォルト': '🤔'
      };

      // 称号に対応する絵文字を取得（なければデフォルト）
      const emoji = statusVisuals[data.status] || statusVisuals['デフォルト'];
      statusImageElement.src = `https://placehold.jp/150x150.png?text=${emoji}`;

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
    if (button.dataset.page === "home") {
      updateHomePageStatus();
    } else if (button.dataset.page === "map") {
      console.log('マップページが表示されました');
      // マップページが表示されたときに地図を初期化
      setTimeout(() => {
        console.log('地図初期化のタイマーが実行されました');
        initializeMap();
      }, 100);
    }
  });
});

// 新規登録・ログインページ切り替えボタンの設定
document.getElementById('show-register-button').addEventListener('click', () => showPage('page-register'));
document.getElementById('show-login-button').addEventListener('click', () => showPage('page-login'));

// 初期表示ページを設定
showPage('page-login');

// 地図関連の変数
let map = null;

// 最低限の地図表示機能
function initializeMap() {
  console.log('initializeMap関数が呼ばれました');

  // 地図コンテナが存在するかチェック
  const mapContainer = document.getElementById('map');
  if (!mapContainer) {
    console.error('地図コンテナが見つかりません');
    return;
  }
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

  // 地図コンテナを強制的に表示状態にする
  mapContainer.style.display = 'block';
  mapContainer.style.height = '350px';
  mapContainer.style.width = '100%';

  // 既に初期化済みの場合は何もしない
  if (map) {
    console.log('地図は既に初期化済みです');
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
    console.log('地図を初期化します...');

    // 地図を作成（金沢市を中心に設定）
    map = L.map('map').setView([36.5777, 136.6483], 13);
    console.log('地図オブジェクトを作成しました');

    // OpenStreetMapタイルを追加
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
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
    }, 200);

  } catch (error) {
    console.error('地図の初期化に失敗しました:', error);
  }
}