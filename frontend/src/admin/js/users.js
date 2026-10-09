import { apiFetch, cell, confirmDialog, emptyState, escapeHtml, formatDate, setBusy, toast } from './shared.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_LABEL = { secretariat: 'Secretariat', council: 'Council' };

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('') + '!7';
}

async function request(method, path, body) {
  const response = await apiFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

function modal({ title, submitLabel, fields, intro, save }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="au-title">
      <h2 id="au-title">${escapeHtml(title)}</h2>
      ${intro ? `<p style="margin:.2rem 0 1rem;color:rgba(255,255,255,.72);line-height:1.5">${intro}</p>` : ''}
      <form id="au-form" novalidate>
        ${fields}
        <p class="form-status" id="au-error" role="alert"></p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-au="cancel">Cancel</button>
          <button class="btn" type="submit">${escapeHtml(submitLabel)}</button>
        </div>
      </form>
    </div>`;

  return new Promise((resolve) => {
    const finish = (value) => { document.removeEventListener('keydown', onKey); overlay.remove(); resolve(value); };
    const onKey = (event) => { if (event.key === 'Escape') finish(false); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(false); });
    document.body.appendChild(overlay);

    const form = overlay.querySelector('#au-form');
    const error = overlay.querySelector('#au-error');
    const submit = form.querySelector('[type="submit"]');
    overlay.querySelector('[data-au="cancel"]').addEventListener('click', () => finish(false));
    const gen = overlay.querySelector('[data-au="generate"]');
    if (gen) gen.addEventListener('click', () => { form.password.type = 'text'; form.password.value = generatePassword(); });
    (form.querySelector('input') || form).focus();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (form.notify) data.notify = form.notify.checked;
      error.textContent = '';
      setBusy(submit, true);
      try {
        const message = await save(data, error);
        if (message === false) { setBusy(submit, false); return; }
        finish(true);
      } catch (err) {
        error.textContent = err.message || 'Something went wrong.';
        setBusy(submit, false);
      }
    });
  });
}

const passwordField = (label) => `
  <div class="field"><label for="au-password">${label} *</label>
    <div style="display:flex;gap:.5rem"><input id="au-password" name="password" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters">
    <button class="btn btn-ghost" type="button" data-au="generate">Generate</button></div></div>`;

export function initUsers() {
  const container = document.querySelector('#users-table-container');
  const status = document.querySelector('#users-status');
  let currentId = null;

  async function load() {
    container.classList.add('is-loading');
    try {
      const data = await request('GET', '/api/admin/users');
      currentId = data.currentAdminId;
      render(data.admins);
      status.textContent = `${data.admins.length} admin user${data.admins.length === 1 ? '' : 's'}`;
    } catch (error) {
      container.innerHTML = emptyState(error.message);
      status.textContent = '';
    } finally {
      container.classList.remove('is-loading');
    }
  }

  function render(admins) {
    if (!admins.length) { container.innerHTML = emptyState('No admin users yet.'); return; }
    container.innerHTML = `<table><thead><tr><th>Email</th><th>Role</th><th>Last sign-in</th><th>Added</th><th>Actions</th></tr></thead><tbody>${admins.map((a) => {
      const me = a.id === currentId;
      return `<tr>
        ${cell('Email', `${escapeHtml(a.email)}${me ? ' <span class="status active">You</span>' : ''}`)}
        ${cell('Role', escapeHtml(ROLE_LABEL[a.role] || a.role))}
        ${cell('Last sign-in', a.last_login_at ? escapeHtml(formatDate(a.last_login_at)) : 'Never')}
        ${cell('Added', escapeHtml(formatDate(a.created_at)))}
        ${cell('Actions', `<div class="row-actions">
          ${me ? '' : `<button type="button" data-act="role" data-id="${a.id}" data-role="${a.role}" data-email="${escapeHtml(a.email)}">Change role</button>`}
          <button type="button" data-act="reset" data-id="${a.id}" data-email="${escapeHtml(a.email)}">Reset password</button>
          ${me ? '' : `<button type="button" class="btn-danger" data-act="delete" data-id="${a.id}" data-email="${escapeHtml(a.email)}">Remove</button>`}
        </div>`)}
      </tr>`;
    }).join('')}</tbody></table>`;
  }

  async function addAdmin() {
    const done = await modal({
      title: 'Add admin user',
      submitLabel: 'Add admin',
      intro: 'They sign in at the admin login page with this email and the temporary password you set. A verification code is emailed on every sign-in.',
      fields: `
        <div class="field"><label for="au-email">Email *</label><input id="au-email" name="email" type="email" autocomplete="off" placeholder="name@example.com"></div>
        <div class="field"><label for="au-role">Role *</label><select id="au-role" name="role"><option value="council">Council: view and review</option><option value="secretariat">Secretariat: full access</option></select></div>
        ${passwordField('Temporary password')}
        <label for="au-notify" style="display:flex;align-items:center;gap:.6rem;margin:.4rem 0 .8rem;cursor:pointer"><input id="au-notify" name="notify" type="checkbox" checked style="width:auto;margin:0"> Email them a welcome message</label>`,
      save: async (data, error) => {
        data.email = data.email.trim();
        if (!EMAIL_PATTERN.test(data.email)) { error.textContent = 'Enter a valid email address.'; return false; }
        if ((data.password || '').length < 8) { error.textContent = 'Password must be at least 8 characters.'; return false; }
        const result = await request('POST', '/api/admin/users', data);
        toast(`${data.email} added.${result.emailed ? ' Welcome email sent.' : ''} Share the temporary password with them securely.`, 'ok', 7000);
        return true;
      },
    });
    if (done) load();
  }

  async function changeRole(id, email, role) {
    const next = role === 'secretariat' ? 'council' : 'secretariat';
    const ok = await confirmDialog({ title: 'Change role', message: `Change ${email} from ${ROLE_LABEL[role]} to ${ROLE_LABEL[next]}?`, confirmLabel: 'Change role' });
    if (!ok) return;
    try { await request('PUT', '/api/admin/users', { id, action: 'set-role', role: next }); toast('Role updated.', 'ok'); load(); } catch (e) { toast(e.message, 'err'); }
  }

  async function resetPassword(id, email) {
    const done = await modal({
      title: 'Reset password',
      submitLabel: 'Reset password',
      intro: `Set a new temporary password for ${escapeHtml(email)}.`,
      fields: passwordField('New password'),
      save: async (data, error) => {
        if ((data.password || '').length < 8) { error.textContent = 'Password must be at least 8 characters.'; return false; }
        await request('PUT', '/api/admin/users', { id, action: 'reset-password', password: data.password });
        toast('Password reset. Share it with them securely.', 'ok', 6000);
        return true;
      },
    });
    if (done) load();
  }

  async function remove(id, email) {
    const ok = await confirmDialog({ title: 'Remove admin user', message: `${email} will lose access to the admin console immediately.`, confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    try { await request('DELETE', `/api/admin/users?id=${encodeURIComponent(id)}`); toast('Admin user removed.', 'ok'); load(); } catch (e) { toast(e.message, 'err'); }
  }

  container.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    const { act, id, email, role } = button.dataset;
    if (act === 'role') changeRole(id, email, role);
    if (act === 'reset') resetPassword(id, email);
    if (act === 'delete') remove(id, email);
  });
  document.querySelector('#users-create').addEventListener('click', addAdmin);
  document.querySelector('#users-refresh').addEventListener('click', load);
  load();
}
