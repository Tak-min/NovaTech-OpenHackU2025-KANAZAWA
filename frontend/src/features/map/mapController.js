import { getUsersLocations } from '../../api/mapApi.js';
import { getCurrentPosition } from '../../services/geolocationService.js';
import { weatherLabel } from '../../ui/components.js';

const DEFAULT_CENTER = [36.5613, 136.6562];
const DEFAULT_ZOOM = 5;

let map;
let markerLayer;
let currentPositionMarker;
let mapRequestId = 0;

const setAlert = (root, message, type = 'info') => {
  const alert = root.querySelector('#map-alert');
  if (!alert) return;
  alert.textContent = message;
  alert.className = `state-message state-${type}`;
};

const createMarkerIcon = (user) => {
  const className = user.isCurrentUser ? 'weather-marker current-user' : `weather-marker ${user.weatherCategory || 'unknown'}`;
  return window.L.divIcon({
    className,
    html: '<span></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16]
  });
};

const createPopupNode = (user) => {
  const node = document.createElement('div');
  node.className = 'map-popup';

  const title = document.createElement('strong');
  title.textContent = user.isCurrentUser ? `${user.username}（あなた）` : user.username;

  const label = document.createElement('span');
  label.textContent = `${user.diagnosisLabel || '空模様ミックス'} / ${weatherLabel(user.weatherCategory)}`;

  const score = document.createElement('small');
  score.textContent = `score ${Number(user.score || 0).toFixed(1)}`;

  node.append(title, label, score);
  return node;
};

const ensureMap = (root) => {
  if (!window.L) {
    setAlert(root, '地図ライブラリを読み込めませんでした。通信状態を確認してください。', 'error');
    return null;
  }

  const canvas = root.querySelector('#map-canvas');
  if (!canvas) return null;

  if (!map) {
    map = window.L.map(canvas, {
      zoomControl: true,
      attributionControl: true
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    markerLayer = window.L.layerGroup().addTo(map);
  } else if (map.getContainer() !== canvas) {
    map.remove();
    map = null;
    markerLayer = null;
    return ensureMap(root);
  }

  window.setTimeout(() => map.invalidateSize(), 80);
  return map;
};

const renderUserMarkers = (users) => {
  markerLayer.clearLayers();
  users.forEach((user) => {
    if (!Number.isFinite(user.latitude) || !Number.isFinite(user.longitude)) return;
    window.L.marker([user.latitude, user.longitude], {
      icon: createMarkerIcon(user),
      title: user.username
    })
      .bindPopup(createPopupNode(user))
      .addTo(markerLayer);
  });
};

const centerOnBrowserLocation = async (root) => {
  try {
    const position = await getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 300000
    });
    if (!map) return;
    const latLng = [position.latitude, position.longitude];
    map.setView(latLng, 12);
    if (currentPositionMarker) {
      currentPositionMarker.setLatLng(latLng);
    } else {
      currentPositionMarker = window.L.circleMarker(latLng, {
        radius: 8,
        color: '#2f7bdc',
        fillColor: '#8bd7f5',
        fillOpacity: 0.86,
        weight: 3
      }).addTo(map).bindPopup('現在地（保存していません）');
    }
  } catch (error) {
    setAlert(root, `${error.message} 公開ユーザーの地図はそのまま見られます。`, 'warning');
  }
};

export const mountMapPage = async (root) => {
  const mapInstance = ensureMap(root);
  if (!mapInstance) return;

  const requestId = ++mapRequestId;
  setAlert(root, '公開中の天気ログを読み込んでいます...', 'info');

  centerOnBrowserLocation(root);

  try {
    const result = await getUsersLocations();
    if (requestId !== mapRequestId) return;
    const users = result.users || [];
    renderUserMarkers(users);
    map.invalidateSize();

    if (users.length === 0) {
      setAlert(root, 'まだ公開中の位置ログがありません。設定で地図表示をONにしたユーザーがここに表示されます。', 'warning');
      return;
    }

    const currentUser = users.find((user) => user.isCurrentUser);
    if (currentUser) {
      map.setView([currentUser.latitude, currentUser.longitude], 12);
    } else if (users.length > 1) {
      const bounds = window.L.latLngBounds(users.map((user) => [user.latitude, user.longitude]));
      map.fitBounds(bounds.pad(0.18));
    }

    setAlert(root, `${users.length}件の公開ログを表示しています。`, 'success');
  } catch (error) {
    setAlert(root, error.message || '地図データを読み込めませんでした。', 'error');
  }
};
