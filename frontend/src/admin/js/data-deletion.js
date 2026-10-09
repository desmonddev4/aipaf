import { apiFetch, authHeaders, cell, emptyState, escapeHtml, formatDate, readJson, setBusy, statusBadge, toast } from './shared.js';

const STATUSES = ['pending', 'processing', 'completed', 'rejected'];
const TYPE_LABELS = { contact_message: 'Contact message', membership_interest: 'Membership interest', member_account: 'Member account' };
const TYPE_SCOPE = {
  contact_message: 'every contact message sent from',
  membership_interest: 'every membership-interest submission from',
  member_account: 'the member account registered with',
};
const cap = (value) => String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
const typeLabel = (type) => TYPE_LABELS[type] || String(type || '—').replace(/_/g, ' ');
const WARN_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>';

function renderSummary(items) {
  const count = (status) => items.filter((i) => i.status === status).length;
  const stats = [
    ['Pending', count('pending'), 'warn'],
    ['Processing', count('processing'), 'info'],
    ['Completed', count('completed'), 'ok'],
    ['Rejected', count('rejected'), 'mute'],
  ];
  return stats.map(([name, value, tone]) => `<div class="dl-stat ${tone}"><span>${name}</span><strong>${value}</strong></div>`).join('');
}

function renderTable(items) {
  if (!items.length) return emptyState('No deletion requests match these filters.');

  const rows = items.map((item) => {
    const id = escapeHtml(item.id);
    const buttons = [];
    if (item.status === 'pending') buttons.push(`<button type="button" class="btn btn-danger-solid btn-sm" data-action="process" data-id="${id}">Process</button>`);
    if (item.status !== 'completed') buttons.push(`<button type="button" class="btn btn-ghost btn-sm" data-action="update" data-id="${id}">Update</button>`);
    return '<tr>'
      + cell('Requester', `<span class="dl-person"><strong>${escapeHtml(item.name || item.email || '—')}</strong>${item.name ? `<small>${escapeHtml(item.email || '—')}</small>` : ''}</span>`)
      + cell('Type', `<span class="dl-type">${escapeHtml(typeLabel(item.request_type))}</span>`)
      + cell('Status', statusBadge(item.status))
      + cell('Requested', item.created_at ? formatDate(item.created_at) : '—')
      + cell('Processed', item.processed_at ? formatDate(item.processed_at) : '—')
      + cell('Notes', item.admin_notes ? `<span class="dl-notes" title="${escapeHtml(item.admin_notes)}">${escapeHtml(item.admin_notes)}</span>` : '—')
      + cell('Actions', `<div class="row-actions">${buttons.join('') || '<span class="dl-done">—</span>'}</div>`)
      + '</tr>';
  }).join('');

  return `<table class="data-table"><thead><tr><th scope="col">Requester</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Requested</th><th scope="col">Processed</th><th scope="col">Notes</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/* Shared shell for the two dialogs. `run()` throws to keep the dialog open with the message. */
function openDialog({ title, body, submitLabel, submitClass, onSubmit }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dl-title">
      <h2 id="dl-title">${escapeHtml(title)}</h2>
      <form id="dl-form" novalidate>
        ${body}
        <p class="form-status" id="dl-error" role="alert"></p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-dl="cancel">Cancel</button>
          <button class="btn ${submitClass}" type="submit">${escapeHtml(submitLabel)}</button>
        </div>
      </form>
    </div>`;

  return new Promise((resolve) => {
    const finish = (value) => { document.removeEventListener('keydown', onKey); overlay.remove(); resolve(value); };
    const onKey = (event) => { if (event.key === 'Escape') finish(null); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(null); });
    document.body.appendChild(overlay);

    const form = overlay.querySelector('#dl-form');
    const error = overlay.querySelector('#dl-error');
    const submit = form.querySelector('[type="submit"]');
    overlay.querySelector('[data-dl="cancel"]').addEventListener('click', () => finish(null));
    (form.querySelector('select, textarea') || submit).focus();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.textContent = '';
      setBusy(submit, true);
      try {
        finish(await onSubmit(form));
      } catch (err) {
        error.textContent = err.message || 'Something went wrong.';
        setBusy(submit, false);
      }
    });
  });
}

async function post(payload, fallback) {
  const response = await apiFetch('/api/admin/data-deletion', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);
  if (!response.ok || !data.ok) throw new Error(data.message || fallback);
  return data;
}

export function initDataDeletion({ showLogin }) {
  const $ = (selector) => document.querySelector(selector);
  const statusSelect = $('#deletion-status');
  const typeSelect = $('#deletion-type');
  const limitSelect = $('#deletion-limit');
  const searchInput = $('#deletion-search');
  const refreshButton = $('#deletions-refresh');
  const exportButton = $('#deletions-export');
  const countElement = $('#deletions-status');
  const summary = $('#deletions-summary');
  const tableContainer = $('#deletions-table-container');

  let all = [];
  let requestId = 0;

  const params = (extra = {}) => new URLSearchParams({ status: statusSelect.value, type: typeSelect.value, limit: limitSelect.value, ...extra });

  function show() {
    const term = searchInput.value.trim().toLowerCase();
    const items = term ? all.filter((i) => [i.name, i.email].some((v) => String(v || '').toLowerCase().includes(term))) : all;
    countElement.textContent = `${items.length} request${items.length === 1 ? '' : 's'}`;
    summary.innerHTML = all.length ? renderSummary(all) : '';
    tableContainer.innerHTML = renderTable(items);
  }

  async function load() {
    const current = ++requestId;
    setBusy(refreshButton, true);
    tableContainer.innerHTML = '<div class="skeleton-rows" aria-hidden="true"><i></i><i></i><i></i></div>';
    try {
      const response = await apiFetch(`/api/admin/data-deletion?${params()}`, { headers: authHeaders() });
      if (response.status === 401) { if (current === requestId) showLogin('Invalid or expired key.'); return; }
      const data = await readJson(response);
      if (current !== requestId) return;
      if (!response.ok) throw new Error(data.message || 'Unable to load deletion requests.');
      all = data.items || [];
      show();
    } catch (error) {
      if (current !== requestId) return;
      all = [];
      summary.innerHTML = '';
      countElement.textContent = '';
      tableContainer.innerHTML = `<div class="empty"><p>${escapeHtml(error.message || 'We could not load deletion requests.')} Check your connection and try again.</p></div>`;
    } finally {
      if (current === requestId) setBusy(refreshButton, false);
    }
  }

  async function processRequest(item) {
    const scope = TYPE_SCOPE[item.request_type] || 'the data linked to';
    const done = await openDialog({
      title: 'Process deletion request',
      submitLabel: 'Delete permanently',
      submitClass: 'btn-danger-solid',
      body: `<div class="dl-warn">${WARN_ICON}<span>This permanently deletes ${escapeHtml(scope)} <strong>${escapeHtml(item.email)}</strong>. It cannot be undone.</span></div>`,
      onSubmit: async () => (await post({ action: 'process', id: item.id }, 'Unable to process deletion request.')).message || 'Deletion processed.',
    });
    if (done) { toast(done, 'ok'); load(); }
  }

  async function updateRequest(item) {
    const options = STATUSES.map((s) => `<option value="${s}" ${s === item.status ? 'selected' : ''}>${cap(s)}</option>`).join('');
    const done = await openDialog({
      title: 'Update request',
      submitLabel: 'Save changes',
      submitClass: 'btn-gold',
      body: `
        <div class="ap-summary dl-summary"><strong>${escapeHtml(item.name || item.email)}</strong><small>${escapeHtml(item.email)} · ${escapeHtml(typeLabel(item.request_type))}</small></div>
        <div class="field"><label for="dl-status">Status</label><select id="dl-status" name="status">${options}</select></div>
        <div class="field"><label for="dl-notes">Admin notes <span class="opt">(optional)</span></label><textarea id="dl-notes" name="notes" placeholder="Record why this status was set">${escapeHtml(item.admin_notes || '')}</textarea></div>`,
      onSubmit: async (form) => {
        const status = form.status.value;
        const notes = form.notes.value.trim();
        if (status === item.status && notes === (item.admin_notes || '')) throw new Error('Change the status or notes before saving.');
        await post({ action: 'update-status', id: item.id, status, adminNotes: notes || null }, 'Unable to update deletion request.');
        return true;
      },
    });
    if (done) { toast('Deletion request updated.', 'ok'); load(); }
  }

  statusSelect.addEventListener('change', load);
  typeSelect.addEventListener('change', load);
  limitSelect.addEventListener('change', load);
  refreshButton.addEventListener('click', load);
  searchInput.addEventListener('input', show);

  tableContainer.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const item = all.find((i) => String(i.id) === button.dataset.id);
    if (!item) return;
    if (button.dataset.action === 'process') processRequest(item);
    else updateRequest(item);
  });

  exportButton.addEventListener('click', async () => {
    setBusy(exportButton, true);
    try {
      const response = await apiFetch(`/api/admin/data-deletion?${params({ format: 'csv' })}`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to export deletion requests.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'data-deletion-requests.csv';
      anchor.click();
      URL.revokeObjectURL(url);
      toast('Export downloaded.', 'ok');
    } catch (error) {
      toast(error.message, 'err');
    } finally {
      setBusy(exportButton, false);
    }
  });

  load();
  return { refresh: load };
}
