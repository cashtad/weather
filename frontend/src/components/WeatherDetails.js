import {
  EMPTY_VALUE,
  formatHumidity,
  formatWind,
  formatPressure,
  formatUnix,
  weatherTimeZone,
} from '../utils/weatherFormat.js';

const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
const timeOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

export function createWeatherDetails() {
  const element = document.createElement('section');
  element.className = 'card weather-details';
  element.setAttribute('aria-labelledby', 'weather-details-title');
  element.innerHTML = `<h2 id="weather-details-title">Weather details</h2>
    <p class="details-timezone"></p><dl class="weather-measurements"></dl>`;
  const list = element.querySelector('dl');
  const timezone = element.querySelector('.details-timezone');

  return {
    element,
    update({ data, loading, error }) {
      list.replaceChildren();
      element.hidden = !data || Boolean(loading || error);
      if (element.hidden) return;

      const current = data.current || {};
      const zone = weatherTimeZone(data.timezone);
      const today = formatUnix(current.dt, zone.name, dateOptions);
      const daily = today !== EMPTY_VALUE && Array.isArray(data.daily)
        ? data.daily.find((day) => formatUnix(day?.dt, zone.name, dateOptions) === today)
        : null;
      const solarTime = (field) => {
        const currentTime = formatUnix(current[field], zone.name, timeOptions);
        return currentTime === EMPTY_VALUE
          ? formatUnix(daily?.[field], zone.name, timeOptions)
          : currentTime;
      };
      timezone.textContent = `Sun times: ${zone.fallback ? 'UTC (timezone unavailable)' : zone.name}`;
      const metrics = [
        ['Humidity', formatHumidity(current.humidity)],
        ['Wind', formatWind(current.wind_speed)],
        ['Pressure', formatPressure(current.pressure)],
        ['Sunrise', solarTime('sunrise')],
        ['Sunset', solarTime('sunset')],
        ['UV index', Number.isFinite(current.uvi) ? numberFormat.format(current.uvi) : EMPTY_VALUE],
        ['Visibility', Number.isFinite(current.visibility)
          ? `${numberFormat.format(current.visibility / 1000)} km` : EMPTY_VALUE],
        ['Cloud coverage', formatHumidity(current.clouds)],
      ];
      for (const [label, value] of metrics) {
        const group = document.createElement('div');
        const term = document.createElement('dt');
        const detail = document.createElement('dd');
        term.textContent = label;
        detail.textContent = value;
        group.append(term, detail);
        list.append(group);
      }
    },
  };
}
