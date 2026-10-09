import { apiFetch, authHeaders, readJson, setBusy, toast, escapeHtml } from './shared.js';

export function initCertificates() {
  const form = document.querySelector('#certificate-form');
  const status = document.querySelector('#certificate-status');
  const issuedInput = document.querySelector('#certificate-issued');
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const $ = (selector) => document.querySelector(selector);
  const searchInput = $('#certificate-member-search');
  const results = $('#certificate-results');
  const chip = $('#certificate-chip');
  const idInput = $('#certificate-member-id');
  const preview = $('#certificate-preview');
  const resultBox = $('#certificate-result');
  const TYPES = { professional: 'Professional', exam: 'Examination', cpd: 'CPD' };
  const cap = (value) => value.charAt(0).toUpperCase() + value.slice(1);
  let selectedName = '';
  let searchTimer;
  let searchId = 0;

  const setPreview = (key, text) => { preview.querySelector(`[data-p="${key}"]`).textContent = text; };
  const dateText = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

  function updatePreview() {
    setPreview('member', selectedName || 'Select a member');
    setPreview('name', form.elements.name.value.trim() || 'Certificate name');
    setPreview('grade', cap(form.elements.grade.value));
    setPreview('type', TYPES[form.elements.type.value] || '');
    setPreview('issued', dateText(form.elements.issuedAt.value) || '—');
    setPreview('expires', dateText(form.elements.expiresAt.value) || 'No expiry');
  }

  function closeResults() {
    results.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
  }

  function chooseMember(id, name, email) {
    idInput.value = id;
    selectedName = name || email;
    chip.innerHTML = `<span>${escapeHtml(name ? `${name} · ${email}` : email)}</span><button type="button" aria-label="Clear member">×</button>`;
    chip.hidden = false;
    searchInput.value = '';
    idInput.removeAttribute('aria-invalid');
    searchInput.removeAttribute('aria-invalid');
    closeResults();
    updatePreview();
  }

  chip.addEventListener('click', (event) => {
    if (!event.target.closest('button')) return;
    idInput.value = '';
    selectedName = '';
    chip.hidden = true;
    updatePreview();
    searchInput.focus();
  });

  async function searchMembers(term) {
    const current = ++searchId;
    try {
      const response = await apiFetch(`/api/admin/members?search=${encodeURIComponent(term)}&limit=8`);
      const payload = await readJson(response);
      if (current !== searchId) return;
      if (!response.ok || !payload.ok) throw new Error();
      const items = payload.items || [];
      results.innerHTML = items.length
        ? items.map((m) => {
          const name = `${m.first_name || ''} ${m.last_name || ''}`.trim();
          return `<li role="option" data-id="${escapeHtml(m.id)}" data-name="${escapeHtml(name)}" data-email="${escapeHtml(m.email)}"><strong>${escapeHtml(name || m.email)}</strong><small>${escapeHtml(m.email)}</small></li>`;
        }).join('')
        : '<li class="cert-none">No members found.</li>';
    } catch (error) {
      if (current !== searchId) return;
      results.innerHTML = '<li class="cert-none">Could not search members.</li>';
    }
    results.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const term = searchInput.value.trim();
    if (uuidPattern.test(term)) { chooseMember(term, '', term); return; }
    if (term.length < 2) { closeResults(); return; }
    searchTimer = setTimeout(() => searchMembers(term), 300);
  });
  searchInput.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeResults(); });
  results.addEventListener('click', (event) => {
    const item = event.target.closest('li[data-id]');
    if (item) chooseMember(item.dataset.id, item.dataset.name, item.dataset.email);
  });
  document.addEventListener('click', (event) => { if (!event.target.closest('.cert-search')) closeResults(); });

  function validate() {
    const memberId = form.elements.memberId;
    const name = form.elements.name;
    const issuedAt = form.elements.issuedAt;
    const expiresAt = form.elements.expiresAt;
    const checks = [
      [searchInput, !uuidPattern.test(memberId.value.trim()), 'Search for a member and choose them from the list.'],
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
    updatePreview();
  });
  form.addEventListener('change', updatePreview);

  $('#certificate-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#certificate-token').value);
      toast('Token copied.', 'ok');
    } catch (error) {
      $('#certificate-token').select();
      toast('Press Ctrl+C to copy the selected token.', 'info');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validate()) return;
    status.className = 'certificate-status info';
    status.textContent = 'Issuing certificate…';
    resultBox.hidden = true;
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true);

    try {
      const data = Object.fromEntries(new FormData(form).entries());
      data.id = [Date.now(), Math.random().toString(16).slice(2)].join('-');
      const response = await apiFetch('/api/certificates?action=issue', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify(data),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.message || 'Unable to issue the certificate.');
      status.className = 'certificate-status ok';
      status.textContent = '';
      toast('Certificate issued.', 'ok');
      const token = payload.certificate?.verification_token;
      if (token) { $('#certificate-token').value = token; resultBox.hidden = false; }
      form.reset();
      idInput.value = '';
      selectedName = '';
      chip.hidden = true;
      document.querySelector('#certificate-grade').value = 'member';
      document.querySelector('#certificate-type').value = 'professional';
      issuedInput.value = new Date().toISOString().slice(0, 10);
      updatePreview();
    } catch (error) {
      status.className = 'certificate-status';
      status.textContent = error.message;
      toast(error.message, 'err');
    } finally {
      setBusy(button, false);
    }
  });

  issuedInput.value = new Date().toISOString().slice(0, 10);
  updatePreview();
}