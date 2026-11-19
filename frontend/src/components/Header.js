import { icon } from './icons.js';
import { createSearchPanel } from './SearchPanel.js';

export function createHeader({ onSignIn, onSignOut, onRetry, ...searchCallbacks }) {
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <div class="header-content shell">
      <a class="brand" href="#main-content">
        <span class="brand-icon">${icon('weather')}</span>
        <span>Weather</span>
      </a>
      <div class="account-controls" aria-label="Account">
        <span class="account-email" hidden></span>
        <button type="button" class="account-sign-in">Sign in</button>
        <button type="button" class="account-retry" hidden>Retry session</button>
        <button type="button" class="account-sign-out" hidden>Sign out</button>
      </div>
      <p class="account-status" role="status"></p>
    </div>
  `;
  const signIn = header.querySelector('.account-sign-in');
  const signOut = header.querySelector('.account-sign-out');
  const retry = header.querySelector('.account-retry');
  const identity = header.querySelector('.account-email');
  const status = header.querySelector('.account-status');
  const search = createSearchPanel(searchCallbacks);
  header.querySelector('.brand').after(search.element);
  signIn.addEventListener('click', (event) => onSignIn(event.currentTarget));
  signOut.addEventListener('click', onSignOut);
  retry.addEventListener('click', onRetry);

  function focusAction() {
    return (
      [signIn, retry, signOut].find((button) => !button.hidden) || header.querySelector('.brand')
    );
  }

  return {
    element: header,
    search,
    focusAction,
    update(state) {
      const focused = document.activeElement;
      signIn.hidden = state.phase !== 'guest';
      signOut.hidden = !['authenticated', 'verifying', 'unavailable'].includes(state.phase);
      retry.hidden = state.phase !== 'unavailable';
      identity.hidden = state.phase !== 'authenticated';
      identity.textContent = state.user?.email || '';
      status.textContent =
        state.message || (state.phase === 'verifying' ? 'Verifying your session...' : '');
      if (
        [signIn, signOut, retry].includes(focused) &&
        focused.hidden &&
        !header.parentElement?.querySelector('dialog[open]')
      ) {
        focusAction().focus();
      }
    },
  };
}
