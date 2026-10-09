import { apiFetch, authHeaders, cell, emptyState, escapeHtml, readJson, setBusy, statusBadge, toast } from './shared.js';

const label = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

function formatWhen(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '—';
  const day = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `<span class="au-when"><span>${escapeHtml(day)}</span><small>${escapeHtml(time)}</small></span>`;
}

function parseDetails(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function hasDetails(value) {
  const details = parseDetails(value);
  if (details == null || details === '') return false;
  return typeof details !== 'object' || Object.keys(details).length > 0;
}

function renderSummary(items) {
  const roles = (role) => items.filter((i) => i.admin_role === role).length;
  const today = new Date().toDateString();
  const stats = [
    ['Entries loaded', items.length, 'info'],
    ['Today', items.filter((i) => new Date(i.created_at).toDateString() === today).length, 'warn'],
    ['Secretariat', roles('secretariat'), 'ok'],
    ['Council', roles('council'), 'mute'],
  ];
  return stats.map(([name, value, tone]) => `<div class="au-stat ${tone}"><span>${name}</span><strong>${value}</strong></div>`).join('');
}

function renderTable(items) {
  if (!items.length) return emptyState('No audit entries match these filters.');

  const rows = items.map((item) => {
    const entity = item.entity_type || item.entity_id
      ? `<span class="au-entity"><strong>${escapeHtml(label(item.entity_type) || '—')}</strong>${item.entity_id ? `<code>${escapeHtml(item.entity_id)}</code>` : ''}</span>`
      : '—';
    const view = `<button type="button" class="btn btn-ghost btn-sm" data-view="${escapeHtml(item.id)}">${hasDetails(item.details) ? 'View details' : 'View'}</button>`;
    return '<tr>'
      + cell('When', formatWhen(item.created_at))
      + cell('Role', item.admin_role ? statusBadge(item.admin_role) : '—')
      + cell('Action', `<span class="au-action">${escapeHtml(label(item.action_type) || '—')}</span>`)
      + cell('Entity', entity)
      + cell('IP address', `<span class="au-ip">${escapeHtml(item.ip_address || '—')}</span>`)
      + cell('Actions', `<div class="row-actions">${view}</div>`)
      + '</tr>';
  }).join('');

  return `<table class="data-table"><thead><tr><th scope="col">When</th><th scope="col">Role</th><th scope="col">Action</th><th scope="col">Entity</th><th scope="col">IP address</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function showDetails(item) {
  const details = parseDetails(item.details);
  const pretty = hasDetails(item.details) ? (typeof details === 'string' ? details : JSON.stringify(details, null, 2)) : '';
  const when = item.created_at ? new Date(item.created_at).toLocaleString() : '—';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="au-title">
      <h2 id="au-title">${escapeHtml(label(item.action_type) || 'Audit entry')}</h2>
      <dl class="au-kv">
        <dt>When</dt><dd>${escapeHtml(when)}</dd>
        <dt>Role</dt><dd>${escapeHtml(label(item.admin_role) || '—')}</dd>
        <dt>Entity</dt><dd>${escapeHtml(label(item.entity_type) || '—')}${item.entity_id ? ` <span class="au-code">${escapeHtml(item.entity_id)}</span>` : ''}</dd>
        <dt>IP address</dt><dd><span class="au-code">${escapeHtml(item.ip_address || '—')}</span></dd>
        <dt>Browser</dt><dd class="au-sub">${escapeHtml(item.user_agent || '—')}</dd>
      </dl>
      ${pretty ? `<pre class="au-pre">${escapeHtml(pretty)}</pre>` : '<p class="au-sub">No extra details were recorded for this action.</p>'}
      <div class="modal-actions">
        ${pretty ? '<button class="btn btn-ghost" type="button" data-au="copy">Copy details</button>' : ''}
        <button class="btn btn-gold" type="button" data-au="close">Close</button>
      </div>
    </div>`;

  const close = () => { document.removeEventListener('keydown', onKey); overlay.remove(); };
  const onKey = (event) => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  overlay.querySelector('[data-au="close"]').addEventListener('click', close);
  overlay.querySelector('[data-au="copy"]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pretty); toast('Details copied.', 'ok'); } catch { toast('Could not copy details.', 'err'); }
  });
  document.body.appendChild(overlay);
  overlay.querySelector('[data-au="close"]').focus();
}

export function initAudit({ showLogin }) {
  const $ = (selector) => document.querySelector(selector);
  const roleSelect = $('#audit-role');
  const actionInput = $('#audit-action');
  const startInput = $('#audit-start');
  const endInput = $('#audit-end');
  const limitSelect = $('#audit-limit');
  const searchInput = $('#audit-search');
  const refreshButton = $('#audit-refresh');
  const exportButton = $('#audit-export');
  const clearButton = $('#audit-clear');
  const countElement = $('#audit-status');
  const summary = $('#audit-summary');
  const tableContainer = $('#audit-table-container');

  let all = [];
  let requestId = 0;
  let debounce;

  // The API compares against midnight, so "To" must reach the end of the chosen day.
  function endBoundary() {
    if (!endInput.value) return '';
    const next = new Date(`${endInput.value}T00:00:00`);
    next.setDate(next.getDate() + 1);
    return [next.getFullYear(), String(next.getMonth() + 1).padStart(2, '0'), String(next.getDate()).padStart(2, '0')].join('-');
  }

  const params = (extra = {}) => new URLSearchParams({
    role: roleSelect.value,
    actionType: actionInput.value.trim(),
    startDate: startInput.value,
    endDate: endBoundary(),
    limit: limitSelect.value,
    ...extra,
  });

  function show() {
    const term = searchInput.value.trim().toLowerCase();
    const items = term
      ? all.filter((i) => [i.action_type, i.entity_type, i.entity_id, i.ip_address].some((v) => String(v || '').toLowerCase().includes(term)))
      : all;
    countElement.textContent = `${items.length} entr${items.length === 1 ? 'y' : 'ies'}`;
    summary.innerHTML = all.length ? renderSummary(all) : '';
    tableContainer.innerHTML = renderTable(items);
  }

  async function load() {
    const current = ++requestId;
    setBusy(refreshButton, true);
    tableContainer.innerHTML = '<div class="skeleton-rows" aria-hidden="true"><i></i><i></i><i></i></div>';
    try {
      const response = await apiFetch(`/api/admin/audit?${params()}`, { headers: authHeaders() });
      if (response.status === 401) { if (current === requestId) showLogin('Invalid or expired key.'); return; }
      const data = await readJson(response);
      if (current !== requestId) return;
      if (!response.ok) throw new Error(data.message || 'Unable to load audit log.');
      all = data.items || [];
      show();
    } catch (error) {
      if (current !== requestId) return;
      all = [];
      summary.innerHTML = '';
      countElement.textContent = '';
      tableContainer.innerHTML = `<div class="empty"><p>${escapeHtml(error.message || 'We could not load the audit log.')} Check your connection and try again.</p></div>`;
    } finally {
      if (current === requestId) setBusy(refreshButton, false);
    }
  }

  [roleSelect, startInput, endInput, limitSelect].forEach((el) => el.addEventListener('change', load));
  actionInput.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(load, 400); });
  searchInput.addEventListener('input', show);
  refreshButton.addEventListener('click', load);

  clearButton.addEventListener('click', () => {
    roleSelect.value = '';
    actionInput.value = '';
    startInput.value = '';
    endInput.value = '';
    searchInput.value = '';
    load();
  });

  tableContainer.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    const item = all.find((i) => String(i.id) === button.dataset.view);
    if (item) showDetails(item);
  });

  exportButton.addEventListener('click', async () => {
    setBusy(exportButton, true);
    try {
      const response = await apiFetch(`/api/admin/audit?${params({ format: 'csv' })}`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to export audit log.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'audit-log.csv';
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
