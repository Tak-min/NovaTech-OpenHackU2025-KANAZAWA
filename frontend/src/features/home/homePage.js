import { renderPageHeader } from '../../ui/components.js';

export const renderHomePage = () => `
  <section class="home-page">
    ${renderPageHeader({
      eyebrow: 'Today\'s sky',
      title: 'あなたの空模様',
      text: '位置情報の取得がONの間、現在地の天気を自動で記録してスコアと診断を更新します。'
    })}

    <div id="home-alert" class="state-message is-hidden" role="status"></div>

    <section class="diagnosis-card" aria-live="polite">
      <div>
        <p class="eyebrow">Diagnosis</p>
        <h2 id="diagnosis-label">読み込み中</h2>
        <p id="diagnosis-title" class="diagnosis-title">Weather Neutral</p>
        <p id="diagnosis-reason" class="diagnosis-reason">天気ログを読み込んでいます。</p>
      </div>
      <div class="diagnosis-art">
        <img id="diagnosis-image" src="/img/background-sky.png" alt="">
      </div>
    </section>

    <div class="score-grid">
      <article class="metric-card">
        <span>天気スコア</span>
        <strong id="score-value">--</strong>
        <div class="score-meter" aria-hidden="true">
          <div id="score-meter-fill"></div>
        </div>
      </article>
      <article class="metric-card">
        <span>ログ数</span>
        <strong id="total-records">--</strong>
        <small id="latest-log">まだ記録がありません</small>
      </article>
    </div>

    <section class="weather-breakdown">
      <article>
        <span>晴れ寄り</span>
        <strong id="positive-rate">--</strong>
      </article>
      <article>
        <span>雨寄り</span>
        <strong id="negative-rate">--</strong>
      </article>
      <article>
        <span>最新の天気</span>
        <strong id="latest-weather">--</strong>
      </article>
    </section>

    <section class="record-card">
      <div>
        <p class="eyebrow">Auto weather log</p>
        <h2>現在地の天気を自動記録</h2>
        <p>設定で位置情報の取得がONのときだけ、1秒ごとに現在地と天気を確認します。</p>
      </div>
      <p id="auto-location-status" class="auto-location-status" role="status">自動取得の設定を確認しています。</p>
    </section>
  </section>
`;
