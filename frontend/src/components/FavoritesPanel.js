import { locationLabel } from '../location/preferences.js';

const INITIAL_LIMIT = 5;

export function createFavoritesPanel({ onLoad, onSelectFavorite, onRemoveFavorite }) {
  const element = document.createElement('section');
  element.className = 'favorites-panel';
  element.setAttribute('aria-labelledby', 'favorites-title');
  element.hidden = true;
  element.innerHTML = `
    <div class="saved-heading">
      <h2 id="favorites-title" tabindex="-1">Saved places</h2>
      <button class="favorites-more" type="button" aria-expanded="false" aria-controls="favorite-list" hidden>Show all</button>
    </div>
    <p class="favorites-status" role="status"></p>
    <button type="button" class="favorites-retry" hidden>Retry favorites</button>
    <ul id="favorite-list" class="favorite-list" aria-label="Saved cities"></ul>`;
  const title = element.querySelector('h2');
  const status = element.querySelector('.favorites-status');
  const retry = element.querySelector('.favorites-retry');
  const more = element.querySelector('.favorites-more');
  const list = element.querySelector('ul');
  let expanded = false;
  let authenticated = false;
  let favorites;

  retry.addEventListener('click', onLoad);
  more.addEventListener('click', () => {
    expanded = !expanded;
    render();
  });

  function render() {
    const focused = document.activeElement;
    const selectedRow = focused?.closest('.favorite-row');
    const previousIndex = [...list.children].indexOf(selectedRow);
    list.replaceChildren();
    if (!authenticated) {
      status.textContent = '';
      list.hidden = retry.hidden = more.hidden = true;
      expanded = false;
      return;
    }

    retry.hidden = favorites.phase !== 'error';
    more.hidden = favorites.items.length <= INITIAL_LIMIT;
    if (more.hidden) expanded = false;
    more.setAttribute('aria-expanded', String(expanded));
    more.textContent = expanded ? 'Show fewer' : 'Show all';
    status.textContent =
      favorites.message ||
      (favorites.phase === 'loading'
        ? 'Loading favorites...'
        : favorites.saving
          ? 'Saving city...'
          : favorites.removing.size
            ? 'Removing city...'
            : favorites.phase === 'ready' && !favorites.items.length
              ? 'No favorite cities yet.'
              : '');
    list.hidden = favorites.items.length === 0;

    let nextFocus;
    const visibleItems = expanded ? favorites.items : favorites.items.slice(0, INITIAL_LIMIT);
    for (const item of visibleItems) {
      const row = document.createElement('li');
      row.className = 'favorite-row';
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'favorite-select';
      select.dataset.favoriteId = item.id;
      select.textContent = item.displayName;
      const details = locationLabel(item);
      if (details && details !== item.displayName && !item.displayName.includes(details)) {
        const metadata = document.createElement('small');
        metadata.textContent = details;
        select.append(metadata);
      }
      select.addEventListener('click', () => onSelectFavorite(item));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'favorite-remove';
      remove.dataset.favoriteId = item.id;
      remove.setAttribute('aria-label', `Remove ${item.displayName}`);
      remove.disabled = favorites.removing.has(item.id);
      remove.textContent = remove.disabled ? 'Removing...' : 'Remove';
      remove.addEventListener('click', () => onRemoveFavorite(item.id));
      row.append(select, remove);
      list.append(row);
      if (item.id === focused?.dataset.favoriteId) {
        nextFocus = focused.classList.contains('favorite-remove') && !remove.disabled ? remove : select;
      }
    }
    if (previousIndex >= 0) {
      const neighbor = list.children[Math.min(previousIndex, list.children.length - 1)];
      (nextFocus || neighbor?.querySelector('.favorite-select') || title).focus();
    } else if ((focused === retry && retry.hidden) || (focused === more && more.hidden)) {
      title.focus();
    }
  }

  return {
    element,
    collapse() {
      if (!expanded) return;
      expanded = false;
      render();
    },
    update(account, next) {
      authenticated = account.phase === 'authenticated';
      favorites = next;
      render();
    },
  };
}
