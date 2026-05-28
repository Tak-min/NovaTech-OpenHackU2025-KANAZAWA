const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 60000
};

export class GeolocationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GeolocationError';
    this.code = code;
  }
}

const messageForError = (error) => {
  if (!navigator.geolocation) {
    return 'このブラウザでは位置情報を利用できません。';
  }

  if (error?.code === 1) {
    return '位置情報の許可がオフになっています。ブラウザ設定から許可すると天気を記録できます。';
  }
  if (error?.code === 2) {
    return '現在地を取得できませんでした。通信状態を確認してもう一度お試しください。';
  }
  if (error?.code === 3) {
    return '現在地の取得に時間がかかっています。少し待ってからもう一度お試しください。';
  }
  return '位置情報を取得できませんでした。';
};

export const getCurrentPosition = (options = DEFAULT_OPTIONS) => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new GeolocationError(messageForError(), 'UNSUPPORTED'));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
    },
    (error) => {
      reject(new GeolocationError(messageForError(error), error.code));
    },
    options
  );
});

export const getPermissionState = async () => {
  if (!navigator.permissions?.query) return 'unknown';
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch (_) {
    return 'unknown';
  }
};
