import { icon } from './icons.js';
import { createWeatherIcon } from './WeatherIcon.js';
import {
  formatUnix,
  weatherTimeZone,
  formatTemperature,
  formatProbability,
  weatherDescription,
} from '../utils/weatherFormat.js';

export function createForecastPanel(kind) {
  const hourly = kind === 'hourly';
  const element = document.createElement('section');
  element.className = `card forecast-panel ${hourly ? 'hourly-panel' : 'daily-panel'}`;
  element.setAttribute('aria-labelledby', `${kind}-title`);
  element.innerHTML = `<div class="card-heading"><h2 id="${kind}-title"></h2>${icon(hourly ? 'clock' : 'calendar')}</div>
    <p class="forecast-description"></p><div class="forecast-content"></div>`;
  element.querySelector('h2').textContent = hourly ? 'Hourly forecast' : 'Weekly forecast';
  const body = element.querySelector('.forecast-content');
  return {
    element,
    update({ loading, data, error }) {
      body.replaceChildren();
      element.setAttribute('aria-busy', String(loading));
      const zone = weatherTimeZone(data?.timezone);
      element.querySelector('.forecast-description').textContent = hourly ? data
        ? `Local times: ${zone.fallback ? 'UTC (timezone unavailable)' : zone.name}`
        : '' : "";
      const entries = Array.isArray(data?.[kind])
        ? data[kind].filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
        : [];
      if (loading || error || !Array.isArray(entries) || !entries.length) {
        const message = document.createElement('p');
        message.className = 'forecast-empty';
        message.textContent = loading
          ? 'Loading forecast...'
          : error
            ? 'Forecast unavailable until weather loads.'
            : `No ${kind} forecast available.`;
        body.append(message);
        return;
      }
      const list = document.createElement(hourly ? 'div' : 'ul');
      list.className = hourly ? 'hourly-items' : 'daily-items';
      if (hourly) {
        list.tabIndex = 0;
        list.setAttribute('role', 'region');
        list.setAttribute(
          'aria-label',
          'Hourly forecast. Use left and right arrow keys to scroll.',
        );
        list.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            list.scrollBy?.({ left: event.key === 'ArrowRight' ? 180 : -180, behavior: 'auto' });
          }
        });
      }
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        const row = document.createElement(hourly ? 'article' : 'li');
        row.className = hourly ? 'hourly-item' : 'daily-item';
        const time = document.createElement('p');
        time.className = 'forecast-time';
        time.textContent = formatUnix(
          entry.dt,
          zone.name,
          hourly
            ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
            : { weekday: 'short', day: 'numeric', month: 'short' },
        );
        const condition = entry.weather?.[0];
        const description = document.createElement('p');
        description.className = 'forecast-condition';
        description.textContent = weatherDescription(condition?.description);
        const image = createWeatherIcon(condition?.icon, condition?.description);
        if (hourly) {
          const temp = document.createElement('p');
          temp.className = 'forecast-temperature';
          temp.textContent = formatTemperature(entry.temp);
          row.append(time, image, temp, description);
        } else {
          const conditions = document.createElement('div');
          conditions.className = 'daily-conditions';
          conditions.append(image, description);
          row.append(time, conditions, dailyTemperatures(entry.temp));
        }
        if (
          hourly &&
          typeof entry.pop === 'number' &&
          Number.isFinite(entry.pop) &&
          entry.pop >= 0 &&
          entry.pop <= 1
        ) {
          const probability = document.createElement('p');
          probability.className = 'precipitation';
          probability.textContent = `Precipitation ${formatProbability(entry.pop)}`;
          row.append(probability);
        }
        list.append(row);
      }
      body.append(list);
    },
  };
}

function dailyTemperatures(temp) {
  const group = document.createElement('dl');
  group.className = 'daily-temperatures';
  const hasDayNight = Number.isFinite(temp?.day) || Number.isFinite(temp?.night);
  for (const [label, value] of hasDayNight
    ? [['Day', temp?.day], ['Night', temp?.night]]
    : [['Min', temp?.min], ['Max', temp?.max]]) {
    const metric = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = formatTemperature(value);
    detail.className = 'forecast-temperature';
    metric.append(term, detail);
    group.append(metric);
  }
  return group;
}
