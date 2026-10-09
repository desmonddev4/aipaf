import { apiFetch, cell, escapeHtml, statusBadge, emptyState, toast, setBusy, formatDate } from './shared.js';

const STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn'];
const label = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

async function fetchApplications(status, grade, limit) {
  try {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (grade) params.set('grade', grade);
    params.set('limit', limit);

    const response = await apiFetch(`/api/admin/applications?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch applications');
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Failed to load applications');
    return data.items;
  } catch (error) {
    console.error('Error fetching applications:', error);
    return null;
  }
}

async function updateApplicationStatus(id, status, notes) {
  const response = await apiFetch('/api/admin/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update-status', id, status, notes })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || 'Failed to update application status');
  return result;
}

function fullName(app) {
  return [app.first_name, app.last_name].filter(Boolean).join(' ') || app.email || 'Unknown applicant';
}

function renderSummary(items) {
  const count = (...statuses) => items.filter((i) => statuses.includes(i.status)).length;
  const stats = [
    ['Awaiting review', count('submitted', 'under_review'), 'warn'],
    ['Approved', count('approved'), 'ok'],
    ['Rejected', count('rejected'), 'mute'],
    ['Drafts and withdrawn', count('draft', 'withdrawn'), 'info'],
  ];
  return stats.map(([name, value, tone]) => `<div class="ap-stat ${tone}"><span>${name}</span><strong>${value}</strong></div>`).join('');
}

function renderApplicationsTable(applications) {
  if (!applications || applications.length === 0) return emptyState('No applications match these filters.');

  const rows = applications.map((app) => {
    const canReview = app.status === 'submitted' || app.status === 'under_review';
    const action = canReview
      ? `<button class="btn btn-gold btn-sm" type="button" data-action="review" data-id="${escapeHtml(app.id)}">Review</button>`
      : '<span class="ap-done">—</span>';
    return '<tr>'
      + cell('Applicant', `<span class="ap-person"><strong>${escapeHtml(fullName(app))}</strong><small>${escapeHtml(app.email || '—')}</small></span>`)
      + cell('Grade', escapeHtml(label(app.grade)))
      + cell('Status', statusBadge(app.status))
      + cell('Submitted', app.submitted_at ? formatDate(app.submitted_at) : '—')
      + cell('Reviewed', app.reviewed_at ? formatDate(app.reviewed_at) : '—')
      + cell('Notes', app.reviewer_notes ? `<span class="ap-notes" title="${escapeHtml(app.reviewer_notes)}">${escapeHtml(app.reviewer_notes)}</span>` : '—')
      + cell('Actions', `<div class="row-actions">${action}</div>`)
      + '</tr>';
  }).join('');

  return `<table class="data-table"><thead><tr><th scope="col">Applicant</th><th scope="col">Grade</th><th scope="col">Status</th><th scope="col">Submitted</th><th scope="col">Reviewed</th><th scope="col">Notes</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/* Resolves true when saved. `save(status, notes)` throws to keep the dialog open. */
function showReviewModal(app, save) {
  const options = STATUSES.map((s) => `<option value="${s}" ${s === app.status ? 'selected' : ''}>${label(s)}</option>`).join('');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rv-title">
      <h2 id="rv-title">Review application</h2>
      <div class="ap-summary">
        <strong>${escapeHtml(fullName(app))}</strong>
        <small>${escapeHtml(app.email || '—')} · applying for ${escapeHtml(label(app.grade))}</small>
      </div>
      <form id="rv-form" novalidate>
        <div class="field"><label for="rv-status">Decision</label><select id="rv-status" name="status">${options}</select></div>
        <p class="ap-hint" id="rv-hint" aria-live="polite"></p>
        <div class="field"><label for="rv-notes">Reviewer notes <span class="opt" id="rv-opt">(optional)</span></label><textarea id="rv-notes" name="notes" placeholder="Share the reasoning behind this decision">${escapeHtml(app.reviewer_notes || '')}</textarea></div>
        <p class="form-status" id="rv-error" role="alert"></p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-rv="cancel">Cancel</button>
          <button class="btn btn-gold" type="submit">Save decision</button>
        </div>
      </form>
    </div>`;

  return new Promise((resolve) => {
    const finish = (value) => { document.removeEventListener('keydown', onKey); overlay.remove(); resolve(value); };
    const onKey = (event) => { if (event.key === 'Escape') finish(false); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(false); });
    document.body.appendChild(overlay);

    const form = overlay.querySelector('#rv-form');
    const error = overlay.querySelector('#rv-error');
    const hint = overlay.querySelector('#rv-hint');
    const optional = overlay.querySelector('#rv-opt');
    const submit = form.querySelector('[type="submit"]');
    overlay.querySelector('[data-rv="cancel"]').addEventListener('click', () => finish(false));

    const sync = () => {
      const status = form.status.value;
      hint.classList.toggle('warn', status === 'rejected');
      if (status === 'approved') hint.textContent = `Approving will set the member's grade to ${label(app.grade)} and mark them active.`;
      else if (status === 'rejected') hint.textContent = 'Please explain the rejection so it is on record.';
      else hint.textContent = '';
      optional.textContent = status === 'rejected' ? '(required)' : '(optional)';
    };
    form.status.addEventListener('change', sync);
    sync();
    form.status.focus();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = form.status.value;
      const notes = form.notes.value.trim();
      if (status === app.status && notes === (app.reviewer_notes || '')) { error.textContent = 'Change the decision or notes before saving.'; return; }
      if (status === 'rejected' && !notes) { error.textContent = 'Add reviewer notes before rejecting.'; form.notes.focus(); return; }
      error.textContent = '';
      setBusy(submit, true);
      try {
        await save(status, notes || null);
        finish(status);
      } catch (err) {
        error.textContent = err.message || 'Unable to save the decision.';
        setBusy(submit, false);
      }
    });
  });
}

export function initApplications() {
  const $ = (selector) => document.querySelector(selector);
  const statusSelect = $('#app-status');
  const gradeSelect = $('#app-grade');
  const limitSelect = $('#app-limit');
  const searchInput = $('#app-search');
  const refreshButton = $('#apps-refresh');
  const exportButton = $('#apps-export');
  const countElement = $('#apps-status');
  const summary = $('#apps-summary');
  const tableContainer = $('#apps-table-container');

  let all = [];
  let requestId = 0;

  function show() {
    const term = searchInput.value.trim().toLowerCase();
    const items = term
      ? all.filter((a) => [fullName(a), a.email].some((v) => String(v || '').toLowerCase().includes(term)))
      : all;
    countElement.textContent = `${items.length} application${items.length === 1 ? '' : 's'}`;
    summary.innerHTML = all.length ? renderSummary(all) : '';
    tableContainer.innerHTML = renderApplicationsTable(items);
  }

  async function load() {
    const current = ++requestId;
    setBusy(refreshButton, true);
    tableContainer.innerHTML = '<div class="skeleton-rows" aria-hidden="true"><i></i><i></i><i></i></div>';
    const result = await fetchApplications(statusSelect.value, gradeSelect.value, limitSelect.value);
    if (current !== requestId) return;
    setBusy(refreshButton, false);
    if (!result) {
      all = [];
      summary.innerHTML = '';
      countElement.textContent = '';
      tableContainer.innerHTML = '<div class="empty"><p>We could not load applications. Check your connection and try again.</p></div>';
      return;
    }
    all = result;
    show();
  }

  refreshButton.addEventListener('click', load);
  statusSelect.addEventListener('change', load);
  gradeSelect.addEventListener('change', load);
  limitSelect.addEventListener('change', load);
  searchInput.addEventListener('input', show);

  exportButton.addEventListener('click', async () => {
    const params = new URLSearchParams();
    if (statusSelect.value) params.set('status', statusSelect.value);
    if (gradeSelect.value) params.set('grade', gradeSelect.value);
    params.set('limit', limitSelect.value);
    params.set('format', 'csv');

    setBusy(exportButton, true);
    try {
      const response = await apiFetch(`/api/admin/applications?${params.toString()}`);
      if (!response.ok) throw new Error('Unable to export applications.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'applications.csv';
      anchor.click();
      URL.revokeObjectURL(url);
      toast('Export downloaded.', 'ok');
    } catch (error) {
      toast(error.message || 'Unable to export applications.', 'err');
    } finally {
      setBusy(exportButton, false);
    }
  });

  tableContainer.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="review"]');
    if (!button) return;
    const app = all.find((a) => String(a.id) === button.dataset.id);
    if (!app) return;
    const outcome = await showReviewModal(app, (status, notes) => updateApplicationStatus(app.id, status, notes));
    if (outcome) {
      toast(`Application marked ${label(outcome).toLowerCase()}.`, 'ok');
      load();
    }
  });

  load();
}
