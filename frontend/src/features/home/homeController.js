import { getStatus } from '../../api/statusApi.js';
import { logLocation } from '../../api/locationApi.js';
import { getSettings } from '../../api/userApi.js';
import { setSettings, state } from '../../app/state.js';
import { getCurrentPosition, getPermissionState } from '../../services/geolocationService.js';
import { DIAGNOSIS_META, WEATHER_META } from '../../app/constants.js';
import { formatDateTime, formatNumber, qs, setText, weatherLabel } from '../../ui/components.js';

const AUTO_LOG_INTERVAL_MS = 1000;
let statusRequestId = 0;
let autoLogSessionId = 0;

const setAlert = (root, message, type = 'info') => {
  const alert = qs(root, '#home-alert');
  if (!alert) return;
  alert.textContent = message || '';
  alert.className = `state-message state-${type}${message ? '' : ' is-hidden'}`;
};

const setAutoLocationStatus = (root, message, type = 'info') => {
  const status = qs(root, '#auto-location-status');
  if (!status) return;
  status.textContent = message;
  status.className = `auto-location-status state-message state-${type}`;
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
  const sessionId = ++autoLogSessionId;
  let stopped = false;
  let intervalId = null;
  let inFlight = false;

  const stopAutoLogging = () => {
    stopped = true;
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };

  const loadLocationSettings = async () => {
    if (state.settings) return state.settings;
    const settings = await getSettings();
    setSettings(settings);
    return settings;
  };

  const recordCurrentWeather = async () => {
    if (stopped || inFlight || sessionId !== autoLogSessionId) return;
    inFlight = true;
    try {
      setAutoLocationStatus(root, '現在地と天気を自動取得しています...', 'info');
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 1000
      });
      if (stopped || sessionId !== autoLogSessionId) return;
      const result = await logLocation(position);
      if (stopped || sessionId !== autoLogSessionId) return;

      if (result.status) {
        renderStatus(root, result.status);
      } else {
        await loadHomeStatus(root);
      }

      const category = result.weather?.weatherCategory || result.log?.weatherCategory || 'unknown';
      const delta = Number(result.scoreDelta || 0);
      const deltaText = delta > 0 ? `+${formatNumber(delta, 1)}` : formatNumber(delta, 1);
      const recordedAt = result.log?.recordedAt ? formatDateTime(result.log.recordedAt) : '現在';

      if (result.saved) {
        setAlert(root, '', 'info');
        setAutoLocationStatus(
          root,
          `${recordedAt} / ${weatherLabel(category)}を記録しました。スコア ${deltaText}`,
          'success'
        );
      } else if (result.reason === 'location_logging_disabled') {
        const message = '設定で位置情報の取得がOFFになっているため、現在地と天気は自動取得されません。';
        setAlert(root, message, 'warning');
        setAutoLocationStatus(root, message, 'warning');
        stopAutoLogging();
      } else {
        setAutoLocationStatus(root, result.message || '自動取得は動作中です。次の保存タイミングを待っています。', 'info');
      }
    } catch (error) {
      const message = error.message || '位置情報または天気の取得に失敗しました。';
      const type = error.name === 'GeolocationError' ? 'warning' : 'error';
      setAlert(root, message, type);
      setAutoLocationStatus(root, message, type);
      if (error.code === 1 || error.code === 'UNSUPPORTED') {
        stopAutoLogging();
      }
    } finally {
      inFlight = false;
    }
  };

  const startAutoLogging = async () => {
    setAutoLocationStatus(root, '自動取得の設定を確認しています。', 'info');
    try {
      const settings = await loadLocationSettings();
      if (stopped || sessionId !== autoLogSessionId) return;

      if (!settings.location_logging_enabled) {
        const message = '設定で位置情報の取得がOFFになっているため、現在地と天気は自動取得されません。';
        setAlert(root, message, 'warning');
        setAutoLocationStatus(root, message, 'warning');
        return;
      }

      const permission = await getPermissionState();
      if (stopped || sessionId !== autoLogSessionId) return;

      if (permission === 'denied') {
        const message = 'ブラウザで位置情報が拒否されているため、現在地と天気は自動取得されません。';
        setAlert(root, message, 'warning');
        setAutoLocationStatus(root, message, 'warning');
        return;
      }

      setAutoLocationStatus(root, '1秒ごとに現在地と天気を自動取得しています。', 'info');
      await recordCurrentWeather();
      if (!stopped && sessionId === autoLogSessionId) {
        intervalId = window.setInterval(recordCurrentWeather, AUTO_LOG_INTERVAL_MS);
      }
    } catch (error) {
      const message = error.message || '位置情報設定を確認できませんでした。';
      setAlert(root, message, 'error');
      setAutoLocationStatus(root, message, 'error');
    }
  };

  loadHomeStatus(root).finally(() => {
    if (!stopped && sessionId === autoLogSessionId) {
      startAutoLogging();
    }
  });
  return stopAutoLogging;
};
