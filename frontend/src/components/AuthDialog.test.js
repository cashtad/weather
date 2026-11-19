// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createAuthDialog } from './AuthDialog.js';

let dialog, submit, cancel, retry, trigger;
const select = (selector) => dialog.element.querySelector(selector);
function fill(email, password) {
  select('[name=email]').value = email;
  select('[name=password]').value = password;
}
function submitForm() {
  select('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  submit = vi.fn();
  cancel = vi.fn();
  retry = vi.fn();
  trigger = document.createElement('button');
  dialog = createAuthDialog({
    onSubmit: submit,
    onCancel: cancel,
    onRetry: retry,
    fallbackFocus: () => trigger,
  });
  document.body.append(trigger, dialog.element);
});
afterEach(() => {
  dialog.destroy();
  document.body.replaceChildren();
});

it('opens a labeled native modal with labeled required fields and email focus', () => {
  dialog.open(trigger);
  expect(dialog.element.open).toBe(true);
  expect(dialog.element.getAttribute('aria-labelledby')).toBe('auth-title');
  expect(select('label[for=auth-email]').textContent).toBe('Email');
  expect(select('[name=email]').type).toBe('email');
  expect(select('[name=password]').type).toBe('password');
  expect(select('[name=password]').required).toBe(true);
  expect(document.activeElement).toBe(select('[name=email]'));
});

it.each(['escape', 'close'])('closes via %s and restores focus', (action) => {
  dialog.open(trigger);
  if (action === 'escape') dialog.element.dispatchEvent(new Event('cancel', { cancelable: true }));
  else select('.auth-close').click();
  expect(dialog.element.open).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(cancel).toHaveBeenCalledTimes(1);
});

it('retains email across mode switches and submits actual registration fields', () => {
  dialog.open(trigger);
  fill('new@example.test', 'previous-value');
  select('.auth-switch').click();
  expect(select('h2').textContent).toBe('Create an account');
  expect(select('[name=password]').value).toBe('');
  expect(select('[name=password]').autocomplete).toBe('new-password');
  select('[name=password]').value = 'test-only-password';
  submitForm();
  expect(submit).toHaveBeenCalledExactlyOnceWith('register', {
    email: 'new@example.test',
    password: 'test-only-password',
  });
  expect(select('[name=password]').value).toBe('');
});

it.each(['   ', '\u00e9'.repeat(37)])('rejects blank and overlong UTF-8 passwords', (password) => {
  dialog.open(trigger);
  fill('new@example.test', password);
  submitForm();
  expect(submit).not.toHaveBeenCalled();
  expect(select('[role=alert]').textContent).toMatch(/password|UTF-8/);
});

it('uses native validation for malformed email', () => {
  dialog.open(trigger);
  fill('not-email', 'test-only-password');
  submitForm();
  expect(submit).not.toHaveBeenCalled();
});

it('prevents a second submission and keeps the entered email after failures', () => {
  dialog.open(trigger);
  fill('new@example.test', 'test-only-password');
  dialog.update({ phase: 'authenticating' });
  expect(select('button[type=submit]').disabled).toBe(true);
  submitForm();
  expect(submit).not.toHaveBeenCalled();
  dialog.update({ phase: 'guest', error: 'Invalid email or password.' });
  expect(select('[name=email]').value).toBe('new@example.test');
  expect(select('[role=alert]').textContent).toBe('Invalid email or password.');
});

it('offers session verification retry if the profile service fails', () => {
  dialog.open(trigger);
  dialog.update({ phase: 'unavailable', message: 'Unable to verify your session.' });
  expect(select('.session-retry').hidden).toBe(false);
  select('.session-retry').click();
  expect(retry).toHaveBeenCalledTimes(1);
});

it('closes after authentication and clears credentials from the form', () => {
  dialog.open(trigger);
  fill('new@example.test', 'test-only-password');
  dialog.update({ phase: 'authenticated' });
  expect(dialog.element.open).toBe(false);
  expect(select('[name=password]').value).toBe('');
});
