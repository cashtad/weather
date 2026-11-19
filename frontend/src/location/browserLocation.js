import { validCoordinates } from './preferences.js';

export function getBrowserLocation({ signal, timeoutMs = 9000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () =>
      finish(reject, new DOMException('Location request cancelled.', 'AbortError'));
    const timer = setTimeout(
      () => finish(reject, new Error('Browser location timed out.')),
      timeoutMs,
    );
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    try {
      if (globalThis.isSecureContext === false || !globalThis.navigator?.geolocation) {
        finish(reject, new Error('Browser location is unavailable.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position?.coords?.latitude,
            lon = position?.coords?.longitude;
          if (!validCoordinates(lat, lon)) {
            finish(reject, new Error('Browser location is invalid.'));
            return;
          }
          finish(resolve, { name: 'Current location', lat, lon, source: 'browser' });
        },
        () => finish(reject, new Error('Browser location could not be determined.')),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
      );
    } catch {
      finish(reject, new Error('Browser location is unavailable.'));
    }
  });
}
