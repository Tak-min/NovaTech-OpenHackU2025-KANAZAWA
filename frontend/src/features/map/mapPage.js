import { renderPageHeader } from '../../ui/components.js';

export const renderMapPage = () => `
  <section class="map-page">
    ${renderPageHeader({
      eyebrow: 'Sora map',
      title: 'みんなの空マップ',
      text: '地図には、位置表示をONにしたユーザーの最新ログだけが表示されます。他の人の位置は丸めて表示されます。'
    })}

    <div id="map-alert" class="state-message" role="status">公開中の天気ログを読み込んでいます...</div>

    <section class="map-panel">
      <div id="map-canvas" aria-label="ユーザーの天気ログマップ"></div>
    </section>
  </section>
`;
