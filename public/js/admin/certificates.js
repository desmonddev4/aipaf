import { authHeaders, readJson, setBusy, toast } from './shared.js';

export function initCertificates() {
  const form = document.querySelector('#certificate-form');
  const status = document.querySelector('#certificate-status');
  const issuedInput = document.querySelector('#certificate-issued');
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function validate() {
    const memberId = form.elements.memberId;
    const name = form.elements.name;
    const issuedAt = form.elements.issuedAt;
    const expiresAt = form.elements.expiresAt;
    const checks = [
      [memberId, !uuidPattern.test(memberId.value.trim()), 'Enter the member ID as a UUID, for example 123e4567-e89b-12d3-a456-426614174000.'],
      [name, name.value.trim().length < 3, 'Enter the certificate name (at least 3 characters).'],
      [issuedAt, !issuedAt.value, 'Choose the issue date.'],
      [expiresAt, Boolean(expiresAt.value && issuedAt.value && expiresAt.value < issuedAt.value), 'The expiry date cannot be before the issue date.'],
    ];
    let firstInvalid;
    let message;
    checks.forEach(([element, invalid, errorMessage]) => {
      if (invalid) element.setAttribute('aria-invalid', 'true');
      else element.removeAttribute('aria-invalid');
      if (invalid && !firstInvalid) {
        firstInvalid = element;
        message = errorMessage;
      }
    });
    if (firstInvalid) {
      status.className = 'certificate-status';
      status.textContent = message;
      firstInvalid.focus();
      return false;
    }
    return true;
  }

  form.addEventListener('input', (event) => {
    if (event.target.getAttribute?.('aria-invalid')) event.target.removeAttribute('aria-invalid');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validate()) return;
    status.className = 'certificate-status info';
    status.textContent = 'Issuing certificate…';
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true);

    try {
      const data = Object.fromEntries(new FormData(form).entries());
      data.id = [Date.now(), Math.random().toString(16).slice(2)].join('-');
      const response = await fetch('/api/certificates?action=issue', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify(data),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.message || 'Unable to issue the certificate.');
      status.className = 'certificate-status ok';
      status.textContent = 'Certificate issued. Share the verification token privately.';
      toast('Certificate issued.', 'ok');
      form.reset();
      document.querySelector('#certificate-grade').value = 'member';
      document.querySelector('#certificate-type').value = 'professional';
      issuedInput.value = new Date().toISOString().slice(0, 10);
    } catch (error) {
      status.className = 'certificate-status';
      status.textContent = error.message;
      toast(error.message, 'err');
    } finally {
      setBusy(button, false);
    }
  });

  issuedInput.value = new Date().toISOString().slice(0, 10);
}