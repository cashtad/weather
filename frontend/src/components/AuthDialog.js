export function createAuthDialog({ onSubmit, onCancel, onRetry, fallbackFocus }) {
  const element = document.createElement('dialog');
  element.className = 'auth-dialog';
  element.setAttribute('aria-labelledby', 'auth-title');
  element.innerHTML = `
    <div class="auth-heading">
      <h2 id="auth-title">Sign in</h2>
      <button type="button" class="auth-close" aria-label="Close account dialog">&times;</button>
    </div>
    <form class="auth-form">
      <label for="auth-email">Email</label>
      <input id="auth-email" name="email" type="email" autocomplete="email" required maxlength="255" autofocus>
      <label for="auth-password">Password</label>
      <input id="auth-password" name="password" type="password" autocomplete="current-password" required>
      <p class="auth-error" role="alert"></p>
      <p class="auth-progress" role="status"></p>
      <button class="auth-submit" type="submit">Sign in</button>
      <button class="session-retry" type="button" hidden>Retry session verification</button>
      <button class="auth-switch" type="button">Create an account</button>
    </form>`;
  const form = element.querySelector('form');
  const title = element.querySelector('h2');
  const email = form.querySelector('[name=email]');
  const password = form.querySelector('[name=password]');
  const submit = form.querySelector('.auth-submit');
  const retry = form.querySelector('.session-retry');
  const toggle = form.querySelector('.auth-switch');
  const error = form.querySelector('.auth-error');
  const progress = form.querySelector('.auth-progress');
  let mode = 'login';
  let state = { phase: 'guest' };
  let opener;

  function render() {
    const register = mode === 'register';
    const busy = ['authenticating', 'verifying'].includes(state.phase);
    const unavailable = state.phase === 'unavailable';
    title.textContent = register ? 'Create an account' : 'Sign in';
    password.autocomplete = register ? 'new-password' : 'current-password';
    submit.textContent = register ? 'Create account' : 'Sign in';
    toggle.textContent = register ? 'Already have an account? Sign in' : 'Create an account';
    for (const input of [email, password]) input.disabled = busy || unavailable;
    submit.disabled = busy;
    toggle.disabled = busy;
    submit.hidden = toggle.hidden = unavailable;
    retry.hidden = !unavailable;
    error.textContent =
      state.error ||
      (unavailable ? state.message : '') ||
      (state.phase === 'guest' && element.open ? state.message || '' : '');
    progress.textContent =
      state.phase === 'verifying'
        ? 'Verifying your session...'
        : state.phase === 'authenticating'
          ? register
            ? 'Creating account...'
            : 'Signing in...'
          : '';
  }

  function close({ cancel = false, focus = true } = {}) {
    if (!element.open) return;
    element.close();
    form.reset();
    error.textContent = progress.textContent = '';
    if (cancel) onCancel();
    if (focus) {
      const target =
        opener?.isConnected && opener.getClientRects().length ? opener : fallbackFocus();
      target?.focus();
    }
    opener = null;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.phase !== 'guest' || !form.reportValidity()) return;
    if (!password.value.trim()) {
      error.textContent = 'Enter a password.';
      password.focus();
      return;
    }
    if (new TextEncoder().encode(password.value).length > 72) {
      error.textContent = 'Password must be at most 72 UTF-8 bytes.';
      password.focus();
      return;
    }
    onSubmit(mode, { email: email.value.trim(), password: password.value });
    password.value = '';
  });
  toggle.addEventListener('click', () => {
    mode = mode === 'login' ? 'register' : 'login';
    password.value = '';
    state = { phase: 'guest' };
    render();
    email.focus();
  });
  retry.addEventListener('click', onRetry);
  element.querySelector('.auth-close').addEventListener('click', () => close({ cancel: true }));
  element.addEventListener('cancel', (event) => {
    event.preventDefault();
    close({ cancel: true });
  });

  return {
    element,
    open(trigger) {
      if (element.open) return;
      opener = trigger;
      mode = 'login';
      state = { phase: 'guest' };
      form.reset();
      render();
      element.showModal();
      email.focus();
    },
    update(next) {
      const wasBusy = ['authenticating', 'verifying'].includes(state.phase);
      state = next;
      if (!element.open) return;
      if (state.phase === 'authenticated') {
        close();
        return;
      }
      render();
      if (wasBusy && state.phase === 'guest') password.focus();
      if (state.phase === 'unavailable') retry.focus();
    },
    destroy() {
      close({ focus: false });
    },
  };
}
