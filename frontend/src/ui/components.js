import { WEATHER_META } from '../app/constants.js';

export const qs = (root, selector) => root.querySelector(selector);

export const qsa = (root, selector) => Array.from(root.querySelectorAll(selector));

export const setText = (root, selector, value) => {
  const element = qs(root, selector);
  if (element) element.textContent = value == null || value === '' ? '--' : String(value);
};

export const setHidden = (element, hidden) => {
  if (element) element.classList.toggle('is-hidden', hidden);
};

export const setBusy = (button, busy, busyText = '送信中') => {
  if (!button) return;
  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.defaultText;
};

export const setFormBusy = (form, busy, busyText = '送信中') => {
  const submit = form.querySelector('button[type="submit"]');
  form.querySelectorAll('button, input, textarea, select').forEach((element) => {
    element.disabled = busy;
  });
  setBusy(submit, busy, busyText);
};

export const formatNumber = (value, fractionDigits = 0) => {
  const number = Number(value || 0);
  return number.toLocaleString('ja-JP', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits
  });
};

export const formatDateTime = (value) => {
  if (!value) return 'まだ記録がありません';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '日時不明';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const weatherLabel = (category) => WEATHER_META[category]?.label || '不明';

export const stateMessage = (message, type = 'info') => `
  <div class="state-message state-${type}" role="status">${message}</div>
`;

export const renderPageHeader = ({ eyebrow, title, text }) => `
  <div class="page-heading">
    <p class="eyebrow">${eyebrow}</p>
    <h1>${title}</h1>
    ${text ? `<p>${text}</p>` : ''}
  </div>
`;
