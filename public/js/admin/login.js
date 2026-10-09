import { readJson, setBusy } from './shared.js';
import { apiUrl } from '../config.js';

const loginForm = document.querySelector('#admin-login-form');
const verifyForm = document.querySelector('#admin-verify-form');
const emailInput = document.querySelector('#admin-login-email');
const passwordInput = document.querySelector('#admin-login-password');
const codeInput = document.querySelector('#admin-verify-code');
const loginStatus = document.querySelector('#admin-login-status');
const verifyStatus = document.querySelector('#admin-verify-status');
const homeLink = document.querySelector('#admin-home-link');
const backLoginBtn = document.querySelector('#admin-back-login');
const resendCodeBtn = document.querySelector('#admin-resend-code');

let savedEmail = '';

function showStatus(element, message, kind = 'error') {
  element.className = `admin-login-status${kind ? ` is-${kind}` : ''}`;
  element.textContent = message;
}

// Check if already authenticated
fetch(apiUrl('/api/admin/session'), { credentials: 'include' })
  .then((response) => {
    if (response.ok) window.location.replace('/admin');
  })
  .catch(() => {});

// Step 1: Submit email and password
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    showStatus(loginStatus, 'Please enter your email and password.');
    if (!email) emailInput.setAttribute('aria-invalid', 'true');
    if (!password) passwordInput.setAttribute('aria-invalid', 'true');
    if (!email) emailInput.focus();
    else passwordInput.focus();
    return;
  }

  emailInput.removeAttribute('aria-invalid');
  passwordInput.removeAttribute('aria-invalid');
  showStatus(loginStatus, 'Sending verification code…', 'info');
  setBusy(loginForm.querySelector('button[type="submit"]'), true);

  try {
    const response = await fetch(apiUrl('/api/admin/session'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password }),
    });
    const payload = await readJson(response);
    if (!response.ok) throw new Error(payload.message || 'Unable to sign in. Check your credentials and try again.');

    // Show verification form
    savedEmail = email;
    loginForm.hidden = true;
    verifyForm.hidden = false;
    homeLink.hidden = true;
    codeInput.focus();
    showStatus(loginStatus, '', 'success');
  } catch (error) {
    showStatus(loginStatus, error.message || 'Unable to sign in. Please try again.');
    if (error.message?.includes('email')) emailInput.setAttribute('aria-invalid', 'true');
    else passwordInput.setAttribute('aria-invalid', 'true');
    passwordInput.focus();
  } finally {
    setBusy(loginForm.querySelector('button[type="submit"]'), false);
  }
});

// Step 2: Submit verification code
verifyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = codeInput.value.trim();

  if (!code) {
    showStatus(verifyStatus, 'Please enter the verification code.');
    codeInput.setAttribute('aria-invalid', 'true');
    codeInput.focus();
    return;
  }

  codeInput.removeAttribute('aria-invalid');
  showStatus(verifyStatus, 'Verifying…', 'info');
  setBusy(verifyForm.querySelector('button[type="submit"]'), true);

  try {
    const response = await fetch(apiUrl('/api/admin/session'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', email: savedEmail, code }),
    });
    const payload = await readJson(response);
    if (!response.ok) throw new Error(payload.message || 'Unable to verify. Please check the code and try again.');

    showStatus(verifyStatus, 'Signed in. Redirecting…', 'success');
    window.location.assign('/admin');
  } catch (error) {
    showStatus(verifyStatus, error.message || 'Unable to verify. Please try again.');
    codeInput.setAttribute('aria-invalid', 'true');
    codeInput.focus();
  } finally {
    setBusy(verifyForm.querySelector('button[type="submit"]'), false);
  }
});

// Resend verification code
resendCodeBtn.addEventListener('click', async () => {
  showStatus(verifyStatus, 'Resending code…', 'info');
  setBusy(resendCodeBtn, true);

  try {
    const response = await fetch(apiUrl('/api/admin/session'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resend', email: savedEmail }),
    });
    const payload = await readJson(response);
    if (!response.ok) throw new Error(payload.message || 'Unable to resend code. Please try again.');

    showStatus(verifyStatus, 'New code sent to your email.', 'success');
  } catch (error) {
    showStatus(verifyStatus, error.message || 'Unable to resend code. Please try again.');
  } finally {
    setBusy(resendCodeBtn, false);
  }
});

// Back to login form
backLoginBtn.addEventListener('click', () => {
  verifyForm.hidden = true;
  loginForm.hidden = false;
  homeLink.hidden = false;
  codeInput.value = '';
  showStatus(verifyStatus, '');
  emailInput.focus();
});

// Clear validation on input
emailInput.addEventListener('input', () => {
  emailInput.removeAttribute('aria-invalid');
  if (emailInput.value.trim()) showStatus(loginStatus, '');
});

passwordInput.addEventListener('input', () => {
  passwordInput.removeAttribute('aria-invalid');
  if (passwordInput.value) showStatus(loginStatus, '');
});

codeInput.addEventListener('input', () => {
  codeInput.removeAttribute('aria-invalid');
  if (codeInput.value.trim()) showStatus(verifyStatus, '');
});
