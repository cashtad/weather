import { icon } from './icons.js';
import { locationLabel } from '../location/preferences.js';
import { createFavoritesPanel } from './FavoritesPanel.js';

export function createSearchPanel({ onQuery, onSelect, onUseLocation, onSelectFavorite, ...favoriteCallbacks }) {
  const element = document.createElement('div');
  element.className = 'header-search';
  element.innerHTML = `
    <form class="city-search" role="search" aria-label="City search" autocomplete="off">
      <label class="visually-hidden" for="city-search">City name</label>
      <div class="search-input-wrap">${icon('search')}
        <input id="city-search" name="name" type="search" placeholder="Search city..." maxlength="255"
          role="combobox" aria-autocomplete="list" aria-controls="city-results"
          aria-expanded="false" aria-describedby="search-help" />
      </div>
      <div class="search-popup" hidden>
        <p id="search-help" class="helper-text" role="status"></p>
        <ul id="city-results" class="search-results" role="listbox" aria-label="Matching cities" hidden></ul>
      </div>
    </form>
    <button class="location-button" type="button" aria-label="Use my location" title="Use my location">${icon('locate')}</button>`;
  const input = element.querySelector('input');
  const popup = element.querySelector('.search-popup');
  const list = element.querySelector('#city-results');
  const help = element.querySelector('#search-help');
  const locate = element.querySelector('.location-button');
  const events = new AbortController();
  const listener = { signal: events.signal };
  const favorites = createFavoritesPanel({
    ...favoriteCallbacks,
    onSelectFavorite(item) {
      finishSelection();
      onSelectFavorite(item);
    },
  });
  popup.append(favorites.element);

  let results = [];
  let active = -1;
  let status = 'idle';
  let open = false;
  let authenticated = false;

  function renderPopup() {
    const showFavorites = open && authenticated && input.value.trim() === '';
    const showResults = open && results.length > 0;
    popup.hidden = !open;
    favorites.element.hidden = !showFavorites;
    list.hidden = !showResults;
    input.setAttribute('aria-expanded', String(showResults));
    help.classList.toggle('visually-hidden', showFavorites || showResults);
    const message = showFavorites
      ? 'Saved places. Press Tab to browse.'
      : status === 'loading'
        ? 'Searching...'
        : status === 'error'
          ? 'Unable to search right now. Please try again.'
          : status === 'success'
            ? results.length
              ? `${results.length} matching cities. Use arrow keys and Enter to choose.`
              : 'No matching cities found.'
            : 'Type at least two characters.';
    if (help.textContent !== message) help.textContent = message;
  }

  function clearHighlight() {
    if (active >= 0) list.children[active]?.setAttribute('aria-selected', 'false');
    active = -1;
    input.removeAttribute('aria-activedescendant');
  }

  function close(restoreFocus = false) {
    if (restoreFocus && document.activeElement !== input) input.focus();
    open = false;
    clearHighlight();
    favorites.collapse();
    renderPopup();
    popup.scrollTop = 0;
  }

  function finishSelection() {
    input.value = '';
    close(true);
  }

  function choose(index) {
    if (!results[index]) return;
    const selected = results[index];
    finishSelection();
    onSelect(selected);
  }

  function highlight(index) {
    clearHighlight();
    active = index;
    open = true;
    renderPopup();
    const option = list.children[index];
    option.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView?.({ block: 'nearest' });
  }

  input.addEventListener('focus', () => {
    open = true;
    renderPopup();
  }, listener);
  input.addEventListener('click', () => {
    open = true;
    renderPopup();
  }, listener);
  input.addEventListener('input', () => {
    open = true;
    onQuery(input.value);
  }, listener);
  input.addEventListener('keydown', (event) => {
    if (results.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const index = event.key === 'ArrowDown'
        ? (active + 1) % results.length
        : active <= 0 ? results.length - 1 : active - 1;
      highlight(index);
    } else if (event.key === 'Enter' && !list.hidden && results.length) {
      event.preventDefault();
      choose(active < 0 ? 0 : active);
    }
  }, listener);
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close(popup.contains(document.activeElement));
    }
  }, listener);
  element.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    open = true;
    renderPopup();
    onQuery(input.value, { immediate: true });
  }, listener);
  locate.addEventListener('click', () => {
    if (locate.getAttribute('aria-disabled') === 'true') return;
    input.value = '';
    close();
    onUseLocation();
  }, listener);
  list.addEventListener('mousedown', (event) => event.preventDefault(), listener);
  list.addEventListener('click', (event) => {
    const option = event.target.closest('[role=option]');
    if (option) choose(Number(option.dataset.index));
  }, listener);
  element.addEventListener('focusout', (event) => {
    if (event.relatedTarget) {
      if (!element.contains(event.relatedTarget)) close();
      return;
    }
    queueMicrotask(() => {
      if (!events.signal.aborted && !element.contains(document.activeElement)) close();
    });
  }, listener);
  document.addEventListener('pointerdown', (event) => {
    if (!element.contains(event.target)) close();
  }, listener);

  return {
    element,
    destroy: () => events.abort(),
    setLocating(locating) {
      locate.setAttribute('aria-disabled', String(locating));
    },
    updateFavorites(account, view) {
      authenticated = account.phase === 'authenticated';
      if (!authenticated && favorites.element.contains(document.activeElement)) close(true);
      favorites.update(account, view);
      renderPopup();
    },
    update({ status: nextStatus = 'idle', items = [] } = {}) {
      clearHighlight();
      status = nextStatus;
      results = items;
      list.replaceChildren();
      items.forEach((item, index) => {
        const option = document.createElement('li');
        option.id = `city-option-${index}`;
        option.dataset.index = index;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.textContent = locationLabel(item);
        list.append(option);
      });
      input.setAttribute('aria-busy', String(status === 'loading'));
      renderPopup();
    },
  };
}
