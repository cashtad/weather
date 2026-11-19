import { createCurrentWeather } from './CurrentWeather.js';
import { createForecastPanel } from './ForecastPanel.js';
import { createWeatherDetails } from './WeatherDetails.js';

export function createDashboard({ onRetry, onSaveFavorite }) {
  const element = document.createElement('main');
  element.id = 'main-content';
  element.className = 'dashboard shell';
  element.tabIndex = -1;
  const current = createCurrentWeather(onRetry, onSaveFavorite);
  const hourly = createForecastPanel('hourly');
  const daily = createForecastPanel('daily');
  const details = createWeatherDetails();
  element.append(current.element, hourly.element, daily.element, details.element);
  return {
    element,
    updateSave: current.updateSave,
    setLocationStatus: current.setLocationStatus,
    updateWeather(state) {
      current.update(state);
      hourly.update(state);
      daily.update(state);
      details.update(state);
    },
  };
}
