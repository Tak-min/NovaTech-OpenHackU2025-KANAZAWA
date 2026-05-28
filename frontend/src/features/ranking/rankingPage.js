import { renderPageHeader } from '../../ui/components.js';

export const renderRankingPage = () => `
  <section class="ranking-page">
    ${renderPageHeader({
      eyebrow: 'Ranking',
      title: '空ジンクスランキング',
      text: '天気ログから育ったスコアを並べています。晴れの日も雨の日も、記録した分だけ物語になります。'
    })}

    <div id="ranking-alert" class="state-message" role="status">ランキングを読み込んでいます...</div>

    <section class="ranking-panel">
      <div class="ranking-header-row">
        <span>順位</span>
        <span>ユーザー</span>
        <span>スコア</span>
      </div>
      <div id="ranking-list" class="ranking-list"></div>
    </section>
  </section>
`;
