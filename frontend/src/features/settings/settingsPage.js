import { renderPageHeader } from '../../ui/components.js';

export const renderSettingsPage = () => `
  <section class="settings-page">
    ${renderPageHeader({
      eyebrow: 'Settings',
      title: '設定とプライバシー',
      text: '現在地は大切な情報です。保存することと、地図に表示することを分けて管理できます。'
    })}

    <div id="settings-alert" class="state-message" role="status">設定を読み込んでいます...</div>

    <form id="settings-form" class="settings-form">
      <section class="settings-section">
        <h2>位置情報</h2>
        <label class="toggle-row">
          <div>
            <span>天気ログを保存</span>
            <p>ONのとき、記録ボタンを押した現在地と天気を保存して診断に使います。</p>
          </div>
          <input id="location-logging-enabled" name="location_logging_enabled" type="checkbox">
        </label>
        <label class="toggle-row">
          <div>
            <span>地図に表示</span>
            <p>ONのとき、最新ログがおおまかな位置で他のユーザーの地図に表示されます。</p>
          </div>
          <input id="location-visibility-enabled" name="location_visibility_enabled" type="checkbox">
        </label>
        <p id="browser-permission" class="privacy-note">ブラウザの位置情報許可を確認中です。</p>
      </section>

      <section class="settings-section">
        <h2>プロフィール</h2>
        <div class="profile-summary">
          <div class="profile-avatar" aria-hidden="true">S</div>
          <div>
            <strong id="settings-username">読み込み中</strong>
            <span id="settings-email">--</span>
          </div>
        </div>
        <label class="text-field">
          <span>自己紹介</span>
          <textarea id="introduction-text" name="introduction_text" maxlength="280" rows="4" placeholder="今日の空みたいな気分を書いてみる"></textarea>
        </label>
      </section>

      <section class="settings-section">
        <h2>通知</h2>
        <label class="toggle-row">
          <div>
            <span>通知を受け取る</span>
            <p>今後のリマインダー機能用の設定です。</p>
          </div>
          <input id="notification-enabled" name="notification_enabled" type="checkbox">
        </label>
      </section>

      <div class="settings-actions">
        <button type="submit" class="primary-action">設定を保存</button>
        <button id="logout-button" type="button" class="secondary-action">ログアウト</button>
      </div>
    </form>
  </section>
`;
