import { readJson, setBusy } from './shared.js';
import { apiUrl } from '../config.js';

/* =====================================================================
   Styles: this file owns the look of the admin login page.
   The CSS is injected as a <style> tag, so the page works even if the
   HTML ships with no CSS of its own.
   ===================================================================== */
const LOGIN_CSS = `
/* ---------- page: hide site chrome, one full-height screen ---------- */
body.admin-login-page {
  margin: 0; min-height: 100vh; min-height: 100dvh; overflow-x: hidden;
  background:
    radial-gradient(ellipse at 75% 12%, rgba(210, 133, 3, .17), transparent 38rem),
    radial-gradient(ellipse at 8% 100%, rgba(11, 107, 43, .28), transparent 32rem),
    linear-gradient(145deg, #03140a, #0a2c16 58%, #061f10);
  background-attachment: fixed;
}
body.admin-login-page #aipaf-header,
body.admin-login-page .site-footer,
body.admin-login-page > .skip { display: none; }

.admin-login, .admin-login *, .admin-login *::before, .admin-login *::after { box-sizing: border-box; }
.admin-login [hidden] { display: none !important; }
.admin-login h1, .admin-login p { margin: 0; }
.admin-login button, .admin-login input { font: inherit; }
.admin-login {
  display: grid; place-items: center; min-height: 100vh; min-height: 100dvh;
  padding: clamp(.75rem, 3vh, 2.5rem) clamp(.75rem, 4vw, 3rem);
  color: #10231c; font-family: "Public Sans", "Segoe UI", system-ui, sans-serif; line-height: 1.5;
}

/* ---------- split card ---------- */
.admin-login-card {
  display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr);
  width: min(100%, 54rem); overflow: hidden; border-radius: 1.5rem; background: #fff;
  box-shadow: 0 2rem 5rem -2rem rgba(0, 0, 0, .6), 0 0 0 1px rgba(255, 255, 255, .08);
  animation: al-rise .7s cubic-bezier(.22, .8, .3, 1) both;
}

/* brand side, with the graduated ruler from the seal */
.admin-login-aside {
  position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 1.5rem;
  padding: clamp(1.25rem, 5vh, 2.5rem); color: #fff;
  background:
    radial-gradient(120% 80% at 100% 0, rgba(210, 133, 3, .3), transparent 60%),
    linear-gradient(160deg, #0b6b2b, #02521d 45%, #03290f);
}
.admin-login-ruler {
  position: absolute; top: 0; right: 0; bottom: 0; width: 18px; opacity: .55; pointer-events: none;
  background:
    repeating-linear-gradient(180deg, #f2ac1f 0 2px, transparent 2px 96px) right top / 18px 100% no-repeat,
    repeating-linear-gradient(180deg, #f2ac1f 0 2px, transparent 2px 24px) right top / 9px 100% no-repeat,
    linear-gradient(#f2ac1f, #f2ac1f) right top / 2px 100% no-repeat;
}
.admin-login-brand {
  display: inline-flex; align-items: center; gap: .8rem; width: fit-content; color: #fff; text-decoration: none;
  font: 600 1.3rem/1.1 var(--serif, Georgia, "Times New Roman", serif); letter-spacing: .05em;
}
.admin-login-brand:hover { color: #fff; }
.admin-login-brand img { width: 3rem; height: 3rem; padding: .2rem; border-radius: 50%; background: #fff; flex: none; transition: transform .45s cubic-bezier(.22, .8, .3, 1); }
.admin-login-brand:hover img { transform: rotate(-8deg) scale(1.05); }
.admin-login-brand small { display: block; margin-top: .2rem; color: #f7d68a; font: 500 .8rem/1 "Public Sans", "Segoe UI", system-ui, sans-serif; letter-spacing: .03em; }
.admin-login-note { max-width: 15rem; padding-right: 1.25rem; color: rgba(255, 255, 255, .88); font: italic 500 1.45rem/1.25 var(--serif, Georgia, "Times New Roman", serif); }

/* form side */
.admin-login-main { display: flex; flex-direction: column; justify-content: center; padding: clamp(1.25rem, 5vh, 2.75rem) clamp(1.25rem, 4vw, 3rem); }
.admin-login-eyebrow {
  display: inline-flex; align-items: center; gap: .4rem; align-self: flex-start; margin: 0 0 .85rem; padding: .25rem .75rem .25rem .6rem;
  border-radius: 999px; background: #fbf0d6; color: #86550a; font-size: .8rem; font-weight: 600;
}
.admin-login-eyebrow svg { flex: none; }
.admin-login h1 { color: #10231c; font: 500 clamp(1.8rem, 3.2vw, 2.4rem)/1.1 var(--serif, Georgia, "Times New Roman", serif); letter-spacing: -.01em; }
.admin-login-intro { margin: .6rem 0 1.4rem; color: #52645a; line-height: 1.55; }

/* ---------- form ---------- */
.admin-login-label { display: block; margin: 0 0 .4rem; color: #10231c; font-size: .9rem; font-weight: 600; }
.admin-login-control { position: relative; margin-bottom: .85rem; }
.admin-login-control > svg { position: absolute; left: .95rem; top: 50%; width: 18px; height: 18px; transform: translateY(-50%); color: #6b7f73; pointer-events: none; transition: color .2s; }
.admin-login-control:focus-within > svg { color: #02521d; }
.admin-login-control input {
  display: block; width: 100%; min-height: 3.1rem; padding: .7rem .95rem .7rem 2.7rem;
  border: 1.5px solid #cbd8cf; border-radius: .8rem; background-color: #fbfdfb; color: #10231c;
  transition: border-color .2s, box-shadow .2s, background-color .2s;
}
.admin-login-control input:hover { border-color: #8fb79b; }
.admin-login-control input:focus,
.admin-login-control input:focus-visible { outline: none; border-color: #02521d; background-color: #fff; box-shadow: 0 0 0 4px rgba(2, 82, 29, .16); }
.admin-login-control input[aria-invalid="true"] { border-color: #b3261e; }
.admin-login-control input[aria-invalid="true"]:focus { box-shadow: 0 0 0 4px rgba(179, 38, 30, .16); }
.admin-login-control:has(input[aria-invalid="true"]) { animation: al-shake .35s ease; }

.admin-login-options { display: flex; align-items: center; justify-content: space-between; gap: .75rem; min-height: 1.9rem; margin-top: .55rem; }
.admin-login-caps { display: inline-flex; align-items: center; gap: .4rem; color: #86550a; font-size: .82rem; font-weight: 600; }
.admin-login-caps::before { content: ""; width: .5rem; height: .5rem; border-radius: 50%; background: #d28503; }
.admin-login-show { position: relative; display: inline-flex; align-items: center; gap: .55rem; margin: 0 0 0 auto; color: #385647; font-size: .85rem; font-weight: 500; cursor: pointer; user-select: none; }
.admin-login-show input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.admin-login-switch { position: relative; flex: none; width: 2.3rem; height: 1.3rem; border-radius: 999px; background: #cbd8cf; transition: background-color .25s; }
.admin-login-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: calc(1.3rem - 6px); height: calc(1.3rem - 6px); border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform .25s cubic-bezier(.22, .8, .3, 1); }
.admin-login-show input:checked + .admin-login-switch { background: #02521d; }
.admin-login-show input:checked + .admin-login-switch::after { transform: translateX(1rem); }
.admin-login-show input:focus-visible + .admin-login-switch { outline: 3px solid #d28503; outline-offset: 2px; }

.admin-login-status { min-height: 1.4rem; margin: .35rem 0 .7rem; color: #b3261e; font-size: .9rem; line-height: 1.4; }
.admin-login-status.is-info { color: #52645a; }
.admin-login-status.is-success { color: #12704a; }

.admin-login-submit {
  position: relative; display: flex; align-items: center; justify-content: center; gap: .6rem; width: 100%; min-height: 3.1rem; padding: .7rem 1.4rem;
  border: 0; border-radius: 999px; background: linear-gradient(135deg, #0b6b2b, #013a14); color: #fff; font-weight: 650; cursor: pointer;
  box-shadow: 0 .6rem 1.4rem -.8rem rgba(1, 58, 20, .85);
  transition: transform .25s cubic-bezier(.22, .8, .3, 1), box-shadow .25s cubic-bezier(.22, .8, .3, 1), filter .2s;
}
.admin-login-submit:hover { transform: translateY(-2px); filter: brightness(1.08); box-shadow: 0 1rem 1.8rem -.9rem rgba(1, 58, 20, .95); }
.admin-login-submit:active { transform: scale(.98); }
.admin-login-submit:focus-visible { outline: 3px solid #d28503; outline-offset: 3px; }
.admin-login-submit:disabled { cursor: progress; opacity: .75; transform: none; filter: none; }
.admin-login-submit:disabled::before { content: ""; width: 1rem; height: 1rem; border: 2px solid rgba(255, 255, 255, .4); border-top-color: #fff; border-radius: 50%; animation: al-spin .7s linear infinite; }

.admin-login-back { display: block; width: 100%; margin-top: 1.1rem; padding: .9rem 0 0; border: 0; border-top: 1px solid #e3ebe5; background: none; text-align: left; color: #385647; font-size: .9rem; text-decoration: none; cursor: pointer; }
.admin-login-back:hover { color: #02521d; text-decoration: underline; text-underline-offset: .2em; }
.admin-login-back:focus-visible { outline: 3px solid #d28503; outline-offset: 3px; border-radius: 4px; }

.admin-login-resend { display: inline-block; margin-top: .5rem; padding: 0; border: 0; background: none; color: #385647; font-size: .85rem; text-decoration: none; cursor: pointer; }
.admin-login-resend:hover:not(:disabled) { color: #02521d; text-decoration: underline; }
.admin-login-resend:disabled { opacity: .6; cursor: default; }

/* ---------- motion ---------- */
@keyframes al-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes al-shake { 20%, 60% { transform: translateX(-4px); } 40%, 80% { transform: translateX(4px); } }
@keyframes al-spin { to { transform: rotate(360deg); } }

/* ---------- responsive: always fits the screen, no scrolling ---------- */
@media (max-width: 720px) {
  .admin-login-card { grid-template-columns: 1fr; width: min(100%, 28rem); }
  .admin-login-aside { flex-direction: row; align-items: center; padding: .85rem 1.25rem; }
  .admin-login-aside::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: linear-gradient(90deg, #02521d, #f2ac1f 50%, #02521d); }
  .admin-login-brand { font-size: 1.15rem; }
  .admin-login-brand img { width: 2.5rem; height: 2.5rem; }
  .admin-login-note, .admin-login-ruler { display: none; }
  .admin-login-main { padding: 1.25rem; }
}
@media (max-height: 640px) {
  .admin-login-intro { display: none; }
  .admin-login h1 { margin-bottom: 1rem; }
  .admin-login-eyebrow { margin-bottom: .6rem; }
  .admin-login-status { margin-bottom: .4rem; }
  .admin-login-back { margin-top: .7rem; padding-top: .6rem; }
}
@media (max-height: 520px) {
  .admin-login-note { display: none; }
  .admin-login-control input, .admin-login-submit { min-height: 2.8rem; }
  .admin-login-options { min-height: 1.6rem; margin-top: .35rem; }
}
@media (max-height: 400px) { .admin-login { place-items: start center; } }

@media (prefers-reduced-motion: reduce) {
  .admin-login *, .admin-login *::before, .admin-login *::after { animation: none !important; transition-duration: .01ms !important; }
}
`;

function injectStyles() {
  if (document.getElementById('admin-login-styles')) return;
  const style = document.createElement('style');
  style.id = 'admin-login-styles';
  style.textContent = LOGIN_CSS;
  document.head.appendChild(style);
  document.body.classList.add('admin-login-page');
}
injectStyles();

/* =====================================================================
   Behaviour
   ===================================================================== */
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

const RESEND_COOLDOWN_SECONDS = 30;
let savedEmail = '';
let resendTimer = null;

function showStatus(element, message, kind = 'error') {
  element.className = `admin-login-status${message && kind ? ` is-${kind}` : ''}`;
  element.textContent = message;
}

// Both forms ship with `hidden`, so reveal step 1 right away.
loginForm.hidden = false;
verifyForm.hidden = true;

// Desktop only: start on the email field (touch screens would pop the keyboard open).
if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  emailInput.focus();
}

// If a session already exists, skip the form entirely.
fetch(apiUrl('/api/admin/session'), { credentials: 'include' })
  .then((response) => {
    if (response.ok) window.location.replace('/admin');
  })
  .catch(() => {});

function startResendCooldown(seconds = RESEND_COOLDOWN_SECONDS) {
  clearInterval(resendTimer);
  let remaining = seconds;
  resendCodeBtn.disabled = true;
  resendCodeBtn.textContent = `Resend code (${remaining}s)`;
  resendTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(resendTimer);
      resendCodeBtn.disabled = false;
      resendCodeBtn.textContent = 'Resend code';
    } else {
      resendCodeBtn.textContent = `Resend code (${remaining}s)`;
    }
  }, 1000);
}

// Step 1: email + password
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const submitBtn = loginForm.querySelector('button[type="submit"]');

  if (!email || !password) {
    showStatus(loginStatus, 'Please enter your email and password.');
    if (!email) emailInput.setAttribute('aria-invalid', 'true');
    if (!password) passwordInput.setAttribute('aria-invalid', 'true');
    (!email ? emailInput : passwordInput).focus();
    return;
  }

  emailInput.removeAttribute('aria-invalid');
  passwordInput.removeAttribute('aria-invalid');
  showStatus(loginStatus, 'Sending verification code…', 'info');
  setBusy(submitBtn, true);

  try {
    const response = await fetch(apiUrl('/api/admin/session'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(payload.message || 'Unable to sign in. Check your credentials and try again.');
    }

    savedEmail = email;
    loginForm.hidden = true;
    verifyForm.hidden = false;
    homeLink.hidden = true;
    showStatus(loginStatus, '');
    showStatus(verifyStatus, `We sent a 6-digit code to ${email}.`, 'info');
    startResendCooldown();
    codeInput.focus();
  } catch (error) {
    showStatus(loginStatus, error.message || 'Unable to sign in. Please try again.');
    if (/email/i.test(error.message || '')) {
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
    } else {
      passwordInput.setAttribute('aria-invalid', 'true');
      passwordInput.focus();
    }
  } finally {
    setBusy(submitBtn, false);
  }
});

// Step 2: verification code
verifyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = codeInput.value.trim();
  const submitBtn = verifyForm.querySelector('button[type="submit"]');

  if (code.length !== 6) {
    showStatus(verifyStatus, 'Please enter the 6-digit verification code.');
    codeInput.setAttribute('aria-invalid', 'true');
    codeInput.focus();
    return;
  }

  codeInput.removeAttribute('aria-invalid');
  showStatus(verifyStatus, 'Verifying…', 'info');
  setBusy(submitBtn, true);

  try {
    const response = await fetch(apiUrl('/api/admin/session'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', email: savedEmail, code }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(payload.message || 'Unable to verify. Please check the code and try again.');
    }

    showStatus(verifyStatus, 'Signed in. Redirecting…', 'success');
    window.location.assign('/admin');
    return; // keep the button busy while redirecting
  } catch (error) {
    showStatus(verifyStatus, error.message || 'Unable to verify. Please try again.');
    codeInput.setAttribute('aria-invalid', 'true');
    codeInput.select();
  }
  setBusy(submitBtn, false);
});

// Resend code
resendCodeBtn.addEventListener('click', async () => {
  showStatus(verifyStatus, 'Resending code…', 'info');
  resendCodeBtn.disabled = true;

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
    codeInput.value = '';
    codeInput.focus();
    startResendCooldown();
  } catch (error) {
    showStatus(verifyStatus, error.message || 'Unable to resend code. Please try again.');
    resendCodeBtn.disabled = false;
  }
});

// Back to step 1
backLoginBtn.addEventListener('click', () => {
  clearInterval(resendTimer);
  verifyForm.hidden = true;
  loginForm.hidden = false;
  homeLink.hidden = false;
  codeInput.value = '';
  passwordInput.value = '';
  showStatus(verifyStatus, '');
  passwordInput.focus();
});

// Input niceties
emailInput.addEventListener('input', () => {
  emailInput.removeAttribute('aria-invalid');
  if (emailInput.value.trim()) showStatus(loginStatus, '');
});

passwordInput.addEventListener('input', () => {
  passwordInput.removeAttribute('aria-invalid');
  if (passwordInput.value) showStatus(loginStatus, '');
});

codeInput.setAttribute('inputmode', 'numeric');
codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6); // digits only
  codeInput.removeAttribute('aria-invalid');
  if (codeInput.value) showStatus(verifyStatus, '');
  if (codeInput.value.length === 6) verifyForm.requestSubmit(); // auto-submit when complete
});