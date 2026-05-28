import { getRanking } from '../../api/rankingApi.js';
import { formatNumber } from '../../ui/components.js';

let rankingRequestId = 0;

const setAlert = (root, message, type = 'info') => {
  const alert = root.querySelector('#ranking-alert');
  if (!alert) return;
  alert.textContent = message;
  alert.className = `state-message state-${type}`;
};

const createRankingRow = (entry) => {
  const row = document.createElement('article');
  row.className = `ranking-row${entry.isCurrentUser ? ' is-current-user' : ''}`;

  const rank = document.createElement('strong');
  rank.className = 'ranking-rank';
  rank.textContent = `#${entry.rank}`;

  const user = document.createElement('div');
  user.className = 'ranking-user';
  const username = document.createElement('span');
  username.textContent = entry.username;
  const sub = document.createElement('small');
  sub.textContent = entry.isCurrentUser ? 'あなたの順位' : 'SoraLog user';
  user.append(username, sub);

  const score = document.createElement('span');
  score.className = 'ranking-score';
  score.textContent = formatNumber(entry.score, 1);

  row.append(rank, user, score);
  return row;
};

export const mountRankingPage = async (root) => {
  const list = root.querySelector('#ranking-list');
  const requestId = ++rankingRequestId;
  list.textContent = '';
  setAlert(root, 'ランキングを読み込んでいます...', 'info');

  try {
    const result = await getRanking({ limit: 50 });
    if (requestId !== rankingRequestId) return;

    const entries = [...(result.rankings || [])];
    if (result.currentUserRank) {
      entries.push(result.currentUserRank);
    }

    if (entries.length === 0) {
      setAlert(root, 'まだランキングに表示できるユーザーがいません。', 'warning');
      return;
    }

    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => fragment.appendChild(createRankingRow(entry)));
    list.appendChild(fragment);
    setAlert(root, `${result.totalUsers || entries.length}人中の天気スコアランキングです。`, 'success');
  } catch (error) {
    setAlert(root, error.message || 'ランキングを読み込めませんでした。', 'error');
  }
};
