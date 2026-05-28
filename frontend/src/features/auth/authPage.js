export const renderAuthPage = () => `
  <section class="auth-screen" aria-labelledby="auth-title">
    <div class="auth-visual" aria-hidden="true">
      <div class="sun-disc"></div>
      <div class="cloud cloud-a"></div>
      <div class="cloud cloud-b"></div>
    </div>

    <div class="auth-card">
      <p class="eyebrow">Weather diary</p>
      <h1 id="auth-title">SoraLog</h1>
      <p class="auth-lead">今いる場所の天気を記録して、あなたの「晴れタイプ」「雨タイプ」を楽しく診断します。</p>

      <div class="segmented-control" role="tablist" aria-label="ログインと新規登録">
        <button type="button" class="segment is-active" data-auth-mode="login" role="tab" aria-selected="true">ログイン</button>
        <button type="button" class="segment" data-auth-mode="register" role="tab" aria-selected="false">新規登録</button>
      </div>

      <form id="login-form" class="auth-form" novalidate>
        <label>
          <span>メールアドレスまたはユーザー名</span>
          <input name="email" type="text" autocomplete="username" placeholder="sora@example.com" required>
        </label>
        <label>
          <span>パスワード</span>
          <input name="password" type="password" autocomplete="current-password" placeholder="6文字以上" required minlength="6">
        </label>
        <p id="login-error" class="form-error" role="alert"></p>
        <button type="submit" class="primary-action">ログイン</button>
      </form>

      <form id="register-form" class="auth-form is-hidden" novalidate>
        <label>
          <span>ユーザー名</span>
          <input name="username" type="text" autocomplete="username" placeholder="sora" required minlength="3" maxlength="50">
        </label>
        <label>
          <span>メールアドレス</span>
          <input name="email" type="email" autocomplete="email" placeholder="sora@example.com" required>
        </label>
        <label>
          <span>パスワード</span>
          <input name="password" type="password" autocomplete="new-password" placeholder="6文字以上" required minlength="6">
        </label>
        <fieldset class="label-choice">
          <legend>称号ラベル</legend>
          <label>
            <input type="radio" name="gender" value="unspecified" checked>
            <span>おまかせ</span>
          </label>
          <label>
            <input type="radio" name="gender" value="male">
            <span>晴れ男/雨男</span>
          </label>
          <label>
            <input type="radio" name="gender" value="female">
            <span>晴れ女/雨女</span>
          </label>
        </fieldset>
        <p id="register-error" class="form-error" role="alert"></p>
        <button type="submit" class="primary-action">アカウント作成</button>
      </form>
    </div>
  </section>
`;
