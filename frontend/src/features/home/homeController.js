import { getStatus } from '../../api/statusApi.js';
import { logLocation } from '../../api/locationApi.js';
import { getCurrentPosition } from '../../services/geolocationService.js';
import { DIAGNOSIS_META, WEATHER_META } from '../../app/constants.js';
import { formatDateTime, formatNumber, qs, setBusy, setText, weatherLabel } from '../../ui/components.js';
import { showToast } from '../../ui/toast.js';

let statusRequestId = 0;

const setAlert = (root, message, type = 'info') => {
  const alert = qs(root, '#home-alert');
  if (!alert) return;
  alert.textContent = message || '';
  alert.className = `state-message state-${type}${message ? '' : ' is-hidden'}`;
};

const updateScoreMeter = (root, score) => {
  const fill = qs(root, '#score-meter-fill');
  if (!fill) return;
  const clamped = Math.max(-20, Math.min(20, Number(score || 0)));
  const percent = ((clamped + 20) / 40) * 100;
  fill.style.width = `${percent}%`;
};

const renderStatus = (root, status) => {
  const meta = DIAGNOSIS_META[status.diagnosisTitle] || DIAGNOSIS_META['Weather Neutral'];
  setText(root, '#diagnosis-label', status.diagnosisLabel || '空模様ミックス');
  setText(root, '#diagnosis-title', status.diagnosisTitle || 'Weather Neutral');
  setText(root, '#diagnosis-reason', status.reason || '天気ログを記録すると診断理由が表示されます。');
  setText(root, '#score-value', formatNumber(status.score, 1));
  setText(root, '#total-records', formatNumber(status.totalRecords));
  setText(root, '#positive-rate', `${formatNumber(status.positiveWeatherRate, 1)}%`);
  setText(root, '#negative-rate', `${formatNumber(status.negativeWeatherRate, 1)}%`);

  const latestCategory = status.latestLog?.weatherCategory || 'unknown';
  setText(root, '#latest-weather', weatherLabel(latestCategory));
  setText(root, '#latest-log', status.latestLog
    ? `${formatDateTime(status.latestLog.recordedAt)} / ${weatherLabel(latestCategory)}`
    : 'まだ記録がありません');

  const image = qs(root, '#diagnosis-image');
  if (image) {
    image.src = meta.image || WEATHER_META[latestCategory]?.image || '/img/background-sky.png';
    image.alt = status.diagnosisLabel || '診断イメージ';
  }
  updateScoreMeter(root, status.score);
};

export const loadHomeStatus = async (root) => {
  const requestId = ++statusRequestId;
  setAlert(root, '診断を読み込んでいます...', 'info');

  try {
    const status = await getStatus();
    if (requestId !== statusRequestId) return;
    renderStatus(root, status);
    setAlert(root, '', 'info');
  } catch (error) {
    if (requestId !== statusRequestId) return;
    setAlert(root, error.message || '診断を読み込めませんでした。', 'error');
  }
};

export const mountHomePage = (root) => {
  const recordButton = qs(root, '#record-weather-button');

  loadHomeStatus(root);

  recordButton?.addEventListener('click', async () => {
    setBusy(recordButton, true, '位置を取得中');
    setAlert(root, 'ブラウザの位置情報許可を確認しています...', 'info');

    try {
      const position = await getCurrentPosition();
      setBusy(recordButton, true, '天気を記録中');
      setAlert(root, '現在地の天気を確認しています...', 'info');

      const result = await logLocation(position);
      if (result.status) {
        renderStatus(root, result.status);
      } else {
        await loadHomeStatus(root);
      }

      const category = result.weather?.weatherCategory || result.log?.weatherCategory || 'unknown';
      const delta = Number(result.scoreDelta || 0);
      const deltaText = delta > 0 ? `+${formatNumber(delta, 1)}` : formatNumber(delta, 1);
      const message = result.saved
        ? `${weatherLabel(category)}を記録しました。スコア ${deltaText}`
        : result.message || '今回は保存をスキップしました';
      setAlert(root, message, result.saved ? 'success' : 'warning');
      showToast(message, result.saved ? 'success' : 'info');
    } catch (error) {
      const message = error.message || '位置情報または天気の取得に失敗しました。';
      setAlert(root, message, 'error');
      showToast(message, 'error');
    } finally {
      setBusy(recordButton, false);
    }
  });
};
