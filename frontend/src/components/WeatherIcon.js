import { icon } from './icons.js';

export function createWeatherIcon(code, description, { large = false } = {}) {
  const root = document.createElement('span');
  root.className = 'weather-icon';
  const fallback = document.createElement('span');
  fallback.className = 'weather-icon-fallback';
  fallback.innerHTML = icon('weather');
  fallback.setAttribute('role', 'img');
  fallback.setAttribute('aria-label', 'Weather icon unavailable');
  root.append(fallback);
  if (typeof code !== 'string' || !/^(01|02|03|04|09|10|11|13|50)[dn]$/.test(code)) return root;
  const image = document.createElement('img');
  image.width = image.height = large ? 200 : 64;
  image.alt =
    typeof description === 'string' && description.trim() ? description : 'Weather conditions';
  image.referrerPolicy = 'no-referrer';
  image.hidden = true;
  image.addEventListener(
    'load',
    () => {
      image.hidden = false;
      fallback.hidden = true;
    },
    { once: true },
  );
  const source = `https://openweathermap.org/img/wn/${code}`;
  const standard = `${source}@2x.png`;
  const highResolution = `${source}@4x.png`;
  image.addEventListener('error', () => {
    if (image.src === highResolution) {
      image.src = standard;
      return;
    }
    image.remove();
    fallback.hidden = false;
  });
  image.src = large ? highResolution : standard;
  root.append(image);
  return root;
}
