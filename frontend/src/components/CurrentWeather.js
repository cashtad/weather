import { locationLabel } from '../location/preferences.js';
import { createWeatherIcon } from './WeatherIcon.js';
import { icon } from './icons.js';
import {
  formatTemperature,
  EMPTY_VALUE,
  weatherDescription,
  weatherTimeZone,
  formatUnix,
} from '../utils/weatherFormat.js';

export function createCurrentWeather(onRetry, onSave) {
  const element = document.createElement('section');
  element.className = 'card current-weather';
  element.setAttribute('aria-labelledby', 'current-title');
  element.innerHTML = `<div class="current-place">
      <div>
        <h1 id="current-title" class="location-name" tabindex="-1"></h1>
        <p class="local-date" hidden><span class="local-date-text"></span> <span class="local-date-utc" title="Location time zone unavailable" hidden>UTC</span></p>
      </div>
      <button type="button" class="save-favorite" aria-describedby="save-note" title="Save city" hidden>${icon('heart')}<span class="visually-hidden">Save city</span></button>
    </div>
    <p id="save-note" class="save-note" role="status"></p>
    <p class="location-status" role="status">Finding a place...</p>
    <p class="weather-message" role="status"></p>
    <div class="current-details"></div>`;
  const content = element.querySelector('.current-details');
  const title = element.querySelector('.location-name');
  const date = element.querySelector('.local-date');
  const dateText = date.querySelector('.local-date-text');
  const utc = date.querySelector('.local-date-utc');
  const save = element.querySelector('.save-favorite');
  const saveLabel = save.querySelector('span');
  const saveNote = element.querySelector('.save-note');
  const message = element.querySelector('.weather-message');
  const locationStatus = element.querySelector('.location-status');
  if (onSave) save.addEventListener('click', onSave);
  else save.remove();
  return {
    element,
    updateSave({ visible, disabled, label, saved, note }) {
      save.hidden = !visible;
      save.disabled = !!disabled;
      saveLabel.textContent = label || 'Save city';
      save.title = saveLabel.textContent;
      save.setAttribute('aria-pressed', String(!!saved));
      saveNote.textContent = note || (label === 'Saving city...' ? label : '');
    },
    setLocationStatus(text) {
      locationStatus.textContent = text;
    },
    update({ location, loading, data, error }) {
      content.replaceChildren();
      content.setAttribute('aria-busy', String(Boolean(loading)));
      title.textContent = locationLabel(location) || 'Your weather';
      if (!data || loading || error) {
        date.hidden = true;
        dateText.textContent = '';
        utc.hidden = true;
        message.textContent = loading
          ? 'Loading weather...'
          : error || (locationStatus.textContent ? '' : 'Choose a city to see the weather.');
        if (error) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'retry-button';
          button.textContent = 'Retry';
          button.addEventListener('click', () => {
            if (document.activeElement === button) title.focus();
            onRetry();
          });
          content.append(button);
        }
        return;
      }
      message.textContent = '';
      const current = data.current || {};
      const condition = current.weather?.[0];
      const zone = weatherTimeZone(data.timezone);
      const day = formatUnix(current.dt, zone.name, {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      });
      const time = formatUnix(current.dt, zone.name, {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
      date.hidden = day === EMPTY_VALUE;
      dateText.textContent = date.hidden ? '' : `${day} · ${time}`;
      utc.hidden = date.hidden || !zone.fallback;

      const summary = document.createElement('div');
      summary.className = 'weather-summary';
      const temperature = document.createElement('strong');
      temperature.className = 'current-temperature';
      temperature.textContent = formatTemperature(current.temp);
      const description = document.createElement('p');
      description.className = 'weather-description';
      description.textContent = weatherDescription(condition?.description);
      const feelsLike = document.createElement('p');
      feelsLike.className = 'feels-like';
      feelsLike.textContent = `Feels like ${formatTemperature(current.feels_like)}`;
      summary.append(temperature, description, feelsLike);
      const conditionIcon = createWeatherIcon(condition?.icon, condition?.description, { large: true });
      // The visible description already communicates the condition.
      conditionIcon.setAttribute('aria-hidden', 'true');
      content.append(summary, conditionIcon);
    },
  };
}
