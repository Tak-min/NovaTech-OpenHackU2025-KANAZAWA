const WEATHER_CATEGORIES = [
  'sunny',
  'cloudy',
  'rainy',
  'snowy',
  'thunderstorm',
  'stormy',
  'unknown'
];

const SCORE_DELTAS = {
  sunny: 1,
  cloudy: 0.5,
  snowy: 1,
  rainy: -1,
  stormy: -2,
  thunderstorm: -3,
  unknown: 0
};

const POSITIVE_CATEGORIES = ['sunny', 'cloudy', 'snowy'];
const NEGATIVE_CATEGORIES = ['rainy', 'stormy', 'thunderstorm'];

const categoryFromWeatherCode = (weatherCode) => {
  const code = Number(weatherCode);

  if (!Number.isFinite(code)) return 'unknown';
  if (code >= 200 && code < 300) return 'thunderstorm';
  if (code >= 300 && code < 600) return 'rainy';
  if (code >= 600 && code < 700) return 'snowy';
  if (code >= 700 && code < 800) return 'stormy';
  if (code === 800) return 'sunny';
  if (code > 800 && code < 900) return 'cloudy';
  return 'unknown';
};

const scoreForCategory = (category) => SCORE_DELTAS[category] ?? 0;

const normalizeCounts = (counts = {}) => {
  return WEATHER_CATEGORIES.reduce((normalized, category) => {
    normalized[category] = Number(counts[category] || 0);
    return normalized;
  }, {});
};

const calculateWeatherStats = (counts = {}) => {
  const normalizedCounts = normalizeCounts(counts);
  const totalRecords = Object.values(normalizedCounts).reduce((sum, value) => sum + value, 0);
  const positiveWeatherCount = POSITIVE_CATEGORIES.reduce((sum, category) => sum + normalizedCounts[category], 0);
  const negativeWeatherCount = NEGATIVE_CATEGORIES.reduce((sum, category) => sum + normalizedCounts[category], 0);

  return {
    counts: normalizedCounts,
    totalRecords,
    positiveWeatherCount,
    negativeWeatherCount,
    positiveWeatherRate: totalRecords > 0 ? Math.round((positiveWeatherCount / totalRecords) * 1000) / 10 : 0,
    negativeWeatherRate: totalRecords > 0 ? Math.round((negativeWeatherCount / totalRecords) * 1000) / 10 : 0
  };
};

const getDiagnosisTitle = (score) => {
  if (score >= 20) return 'Sun Chaser';
  if (score >= 5) return 'Sunny Person';
  if (score <= -20) return 'Storm Bringer';
  if (score <= -5) return 'Rainy Person';
  return 'Weather Neutral';
};

const getDiagnosisLabel = (score) => {
  if (score >= 5) return '晴れタイプ';
  if (score <= -20) return '嵐タイプ';
  if (score <= -5) return '雨タイプ';
  return '空模様ミックス';
};

const buildDiagnosisReason = (score, stats) => {
  if (!stats.totalRecords) {
    return 'まだ天気ログがありません。現在地の天気を記録すると、あなたの空模様タイプが育ち始めます。';
  }

  const trend = score > 0
    ? '晴れ・くもり・雪の記録が少し優勢です。'
    : score < 0
      ? '雨や荒天の記録が少し強く出ています。'
      : '晴れ寄りと雨寄りがちょうど拮抗しています。';

  return `${stats.totalRecords}件の天気ログから判定中。晴れ寄り${stats.positiveWeatherRate}%、雨寄り${stats.negativeWeatherRate}%です。${trend}`;
};

const buildDiagnosis = ({ score, counts }) => {
  const numericScore = Number(score || 0);
  const stats = calculateWeatherStats(counts);

  return {
    diagnosisTitle: getDiagnosisTitle(numericScore),
    diagnosisLabel: getDiagnosisLabel(numericScore),
    score: numericScore,
    counts: stats.counts,
    totalRecords: stats.totalRecords,
    positiveWeatherCount: stats.positiveWeatherCount,
    negativeWeatherCount: stats.negativeWeatherCount,
    positiveWeatherRate: stats.positiveWeatherRate,
    negativeWeatherRate: stats.negativeWeatherRate,
    reason: buildDiagnosisReason(numericScore, stats)
  };
};

module.exports = {
  WEATHER_CATEGORIES,
  SCORE_DELTAS,
  categoryFromWeatherCode,
  scoreForCategory,
  calculateWeatherStats,
  buildDiagnosis
};
