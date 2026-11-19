export const EMPTY_VALUE = '—';
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

export function weatherTimeZone(value) {
  if (typeof value === 'string' && new RegExp('^[A-Za-z_]+(/[A-Za-z0-9_+.-]+)*$').test(value)) {
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: value });
      return { name: value, fallback: false };
    } catch {
      /* Invalid IANA identifiers fall back to explicitly labeled UTC. */
    }
  }
  return { name: 'UTC', fallback: true };
}

export function formatUnix(value, timeZone, options) {
  if (!finite(value) || value <= 0) return EMPTY_VALUE;
  const date = new Date(value * 1000);
  if (!Number.isFinite(date.getTime())) return EMPTY_VALUE;
  return new Intl.DateTimeFormat('en-GB', {
    ...options,
    timeZone: weatherTimeZone(timeZone).name,
  }).format(date);
}

export const formatTemperature = (value) =>
  finite(value) ? `${Math.round(value)}°C` : EMPTY_VALUE;
export const formatWind = (value) =>
  finite(value)
    ? `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)} m/s`
    : EMPTY_VALUE;
export const formatHumidity = (value) => (finite(value) ? `${Math.round(value)}%` : EMPTY_VALUE);
export const formatPressure = (value) => (finite(value) ? `${Math.round(value)} hPa` : EMPTY_VALUE);
export const formatProbability = (value) =>
  finite(value) && value >= 0 && value <= 1 ? `${Math.round(value * 100)}%` : EMPTY_VALUE;
export const weatherDescription = (value) =>
  typeof value === 'string' && value.trim()
    ? value.trim().charAt(0).toUpperCase() + value.trim().slice(1)
    : 'Conditions unavailable';
