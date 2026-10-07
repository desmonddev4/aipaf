import { readJson, setBusy } from './shared.js';

const form = document.querySelector('#admin-login-form');
const tokenInput = document.querySelector('#admin-login-token');
const status = document.querySelector('#admin-login-status');
const submitButton = form.querySelector('button[type="submit"]');

function showStatus(message, kind = 'error') {
  status.className = `admin-login-status${kind ? ` is-${kind}` : ''}`;
  status.textContent = message;
}

fetch('/api/admin/session', { credentials: 'same-origin' })
  .then((response) => {
    if (response.ok) window.location.replace('/admin');
  })
  .catch(() => {});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = tokenInput.value.trim();
  if (!token) {
    showStatus('Enter your API key.');
    tokenInput.setAttribute('aria-invalid', 'true');
    tokenInput.focus();
    return;
  }

  tokenInput.removeAttribute('aria-invalid');
  showStatus('Signing you in…', 'info');
  setBusy(submitButton, true);
  try {
    const response = await fetch('/api/admin/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const payload = await readJson(response);
    if (!response.ok) throw new Error(payload.message || 'Unable to sign in. Check your API key and try again.');
    showStatus('Signed in. Redirecting…', 'success');
    tokenInput.value = '';
    window.location.assign('/admin');
  } catch (error) {
    showStatus(error.message || 'Unable to sign in. Please try again.');
    tokenInput.setAttribute('aria-invalid', 'true');
    tokenInput.focus();
  } finally {
    setBusy(submitButton, false);
  }
});

tokenInput.addEventListener('input', () => {
  tokenInput.removeAttribute('aria-invalid');
  if (tokenInput.value.trim()) showStatus('');
});
