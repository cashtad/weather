import { validCoordinates } from './preferences.js';

const IP_LOOKUP_URL = 'https://ipwho.is/?fields=success,city,region,country,latitude,longitude';

export async function getApproximateLocation({ signal, timeoutMs = 4000 } = {}) {
  const controller = new AbortController();
  let timer;
  let abort;
  const deadline = new Promise((resolve, reject) => {
    abort = () => {
      controller.abort();
      reject(new DOMException('Location request cancelled.', 'AbortError'));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Approximate location timed out.'));
    }, timeoutMs);
  });
  const lookup = async () => {
    const response = await fetch(IP_LOOKUP_URL, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error('Approximate location is unavailable.');
    const data = await response.json();
    if (
      data?.success !== true ||
      !validCoordinates(data.latitude, data.longitude) ||
      typeof data.city !== 'string' ||
      !data.city.trim() ||
      data.city.length > 255 ||
      typeof data.country !== 'string' ||
      !data.country.trim() ||
      data.country.length > 255 ||
      (data.region != null && (typeof data.region !== 'string' || data.region.length > 255))
    ) {
      throw new Error('Approximate location response is invalid.');
    }
    // Discard the provider response; retain neither an IP address nor other provider metadata.
    return {
      name: data.city.trim(),
      country: data.country.trim(),
      state: data.region?.trim() || undefined,
      lat: data.latitude,
      lon: data.longitude,
      source: 'ip',
    };
  };
  try {
    if (signal?.aborted) return await deadline;
    return await Promise.race([lookup(), deadline]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
