import "./style.css";

// const pages = document.quetySelectorAll("main section");
// const navButton = document.querySelectorAll('.nav-button');
// const headerTitle = document.getElementById('header-title');

// function showPage(pageId){
//   pages.forEach(page => {
//     page.classList.add('hidden');
//   });

//   const targetPage = document.getElementById(pageId);
//   if (targetPage) {
//     targetPage.classList.remove('hidden');
//   }

//   const titles = {
//     "page-login" : "ログイン",
//     "page-register" : "新規登録",
//     "page-home" : "ホーム",
//     "page-map" : "マップ",
//     "page-ranking" : "ランキング",
//   };
//   headerTitle.textContent = titles[pageId] || "Hare.Ame";
// }

// navButtons.forEach(button => {
//   button.addEventListener("click", () => {
//     const pageId = "page-${button.dataset.page}$";
//     showPage(pageId);

//     navButtons.forEach(btn => btn.classList.remove(text-yellow-500));
//     button.classList.add("text-yellow-500");
//   });
// });

// document.getElementById("show-register-button").addEventListener("click", () => showPage("page-register"));
// document.getElementById("show-login-button").addEventListener("click", () => showPage("page-login"));

// showPage("page-login");


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

// ナビゲーションボタンにクリックイベントを設定
navButtons.forEach(button => {
  button.addEventListener('click', () => {
    const pageId = `page-${button.dataset.page}`;
    showPage(pageId);

    // ボタンのアクティブ表示を切り替え
    navButtons.forEach(btn => btn.classList.remove('text-yellow-500'));
    button.classList.add('text-yellow-500');
  });
});

// 新規登録・ログインページ切り替えボタンの設定
document.getElementById('show-register-button').addEventListener('click', () => showPage('page-register'));
document.getElementById('show-login-button').addEventListener('click', () => showPage('page-login'));

// 初期表示ページを設定
showPage('page-login');