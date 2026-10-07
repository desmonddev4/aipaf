import { CONTACT_EMAIL, ENDPOINTS } from './config.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function fieldError(form, input, message) {
  const slot = form.querySelector(`[data-error-for="${input.name}"]`);
  if (slot) slot.textContent = message || '';
  if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
}

function validate(form) {
  let firstBad = null;
  for (const input of form.querySelectorAll('input, select, textarea')) {
    if (input.type === 'hidden' || input.classList.contains('hp-input')) continue;
    const value = input.value.trim();
    let msg = '';
    if (input.required && !value) msg = 'This field is required.';
    else if (input.type === 'email' && value && !EMAIL_RE.test(value)) msg = 'Enter a valid email address, like name@example.com.';
    else if (input.type === 'checkbox' && input.required && !input.checked) msg = 'Please tick this box to continue.';
    fieldError(form, input, msg);
    if (msg && !firstBad) firstBad = input;
  }
  firstBad?.focus();
  return !firstBad;
}

function toMailto(kind, data) {
  const subject = kind === 'membership' ? 'Founding membership interest' : 'Message from the AIPAF website';
  const body = Object.entries(data).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function initForms() {
  for (const form of document.querySelectorAll('form[data-form]')) {
    const kind = form.dataset.form;
    const status = form.querySelector('[data-status]');
    const button = form.querySelector('button[type="submit"]');
    form.setAttribute('novalidate', '');
    const loadedAt = Date.now();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = '';
      if (!validate(form)) return;

      const data = Object.fromEntries(new FormData(form).entries());
      if (data.website) return; // honeypot: bots fill this in, people never see it
      delete data.website;
      data._elapsedMs = Date.now() - loadedAt;
      data._page = location.pathname;

      const endpoint = ENDPOINTS[kind];
      if (!endpoint) {
        // No backend yet: hand the message to the visitor's email app.
        window.location.href = toMailto(kind, data);
        status.classList.add('is-ok');
        status.textContent = `Your email app should open with the message ready to send to ${CONTACT_EMAIL}.`;
        return;
      }

      button.disabled = true;
      status.textContent = 'Sending...';
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        status.classList.add('is-ok');
        status.textContent = 'Thank you. The Secretariat has received your message and will reply by email.';
      } catch {
        status.classList.add('is-err');
        status.textContent = `We could not send that. Please try again, or email ${CONTACT_EMAIL}.`;
      } finally {
        button.disabled = false;
      }
    });

    form.addEventListener('input', (e) => { if (e.target.name) fieldError(form, e.target, ''); });
  }
}
