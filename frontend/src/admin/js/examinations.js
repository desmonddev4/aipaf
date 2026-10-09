import { apiFetch, cell, escapeHtml, statusBadge, emptyState, toast, setBusy, formatDate, confirmDialog } from './shared.js';

async function fetchExaminations(status, limit) {
  try {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('limit', limit);

    const response = await apiFetch(`/api/admin/examinations?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch examinations');
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Failed to load examinations');
    return data.items;
  } catch (error) {
    console.error('Error fetching examinations:', error);
    return null;
  }
}

async function createExamination(data) {
  try {
    const response = await apiFetch('/api/admin/examinations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...data })
    });
    if (!response.ok) throw new Error('Failed to create examination');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to create examination');
    return result;
  } catch (error) {
    console.error('Error creating examination:', error);
    throw error;
  }
}

async function updateExamination(id, data) {
  try {
    const response = await apiFetch('/api/admin/examinations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, ...data })
    });
    if (!response.ok) throw new Error('Failed to update examination');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to update examination');
    return result;
  } catch (error) {
    console.error('Error updating examination:', error);
    throw error;
  }
}

async function deleteExamination(id) {
  try {
    const response = await apiFetch('/api/admin/examinations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id })
    });
    if (!response.ok) throw new Error('Failed to delete examination');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to delete examination');
    return true;
  } catch (error) {
    console.error('Error deleting examination:', error);
    throw error;
  }
}

const STATUSES = ['draft', 'open', 'closed', 'archived'];
const cap = (value) => String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);

function renderSummary(items) {
  const count = (status) => items.filter((ex) => ex.status === status).length;
  const registrations = items.reduce((total, ex) => total + (parseInt(ex.registration_count, 10) || 0), 0);
  const stats = [
    ['Open now', count('open'), 'ok'],
    ['Drafts', count('draft'), 'warn'],
    ['Closed or archived', count('closed') + count('archived'), 'mute'],
    ['Registrations', registrations, 'ok'],
  ];
  return stats.map(([label, value, tone]) => `<div class="ex-stat ${tone}"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function renderExaminationsTable(examinations) {
  if (!examinations || examinations.length === 0) return emptyState('No examinations found. Create one to get started.');

  const rows = examinations.map((ex) => {
    const registrations = parseInt(ex.registration_count, 10) || 0;
    const id = escapeHtml(ex.id);
    return '<tr>'
      + cell('Examination', `<span class="ex-name"><strong>${escapeHtml(ex.name)}</strong><small>${escapeHtml(ex.code)}</small></span>`)
      + cell('Status', statusBadge(ex.status))
      + cell('Opens', ex.opens_at ? formatDate(ex.opens_at) : '—')
      + cell('Closes', ex.closes_at ? formatDate(ex.closes_at) : '—')
      + cell('Registrations', `<span class="ex-count">${registrations}</span>`)
      + cell('Actions', `<div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-action="edit" data-id="${id}">Edit</button>
          ${registrations === 0 ? `<button class="btn btn-danger btn-sm" type="button" data-action="delete" data-id="${id}">Delete</button>` : ''}
        </div>`)
      + '</tr>';
  }).join('');

  return `<table class="data-table"><thead><tr><th scope="col">Examination</th><th scope="col">Status</th><th scope="col">Opens</th><th scope="col">Closes</th><th scope="col">Registrations</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/* The API stores UTC; datetime-local inputs work in local time. */
function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : '');

/* Resolves true when saved, false when dismissed. `save(data)` must throw to keep the dialog open. */
function showExaminationModal(examination, save) {
  const isEdit = Boolean(examination);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="exam-title">
      <h2 id="exam-title">${isEdit ? 'Edit examination' : 'Create examination'}</h2>
      <form id="exam-form" novalidate>
        <div class="field-row">
          <div class="field"><label for="exam-code">Code *</label><input id="exam-code" name="code" type="text" required value="${escapeHtml(examination?.code || '')}"></div>
          <div class="field"><label for="exam-form-status">Status</label><select id="exam-form-status" name="status">${STATUSES.map((s) => `<option value="${s}" ${(examination?.status || 'draft') === s ? 'selected' : ''}>${cap(s)}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="exam-name">Name *</label><input id="exam-name" name="name" type="text" required value="${escapeHtml(examination?.name || '')}"></div>
        <div class="field"><label for="exam-description">Description</label><textarea id="exam-description" name="description" rows="3">${escapeHtml(examination?.description || '')}</textarea></div>
        <div class="field-row">
          <div class="field"><label for="exam-opens">Opens at</label><input id="exam-opens" name="opens_at" type="datetime-local" value="${toLocalInput(examination?.opens_at)}"></div>
          <div class="field"><label for="exam-closes">Closes at</label><input id="exam-closes" name="closes_at" type="datetime-local" value="${toLocalInput(examination?.closes_at)}"></div>
        </div>
        <p class="form-status" id="exam-error" role="alert"></p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-exam="cancel">Cancel</button>
          <button class="btn" type="submit">${isEdit ? 'Save changes' : 'Create examination'}</button>
        </div>
      </form>
    </div>`;

  return new Promise((resolve) => {
    const finish = (value) => { document.removeEventListener('keydown', onKey); overlay.remove(); resolve(value); };
    const onKey = (event) => { if (event.key === 'Escape') finish(false); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(false); });
    document.body.appendChild(overlay);

    const form = overlay.querySelector('#exam-form');
    const error = overlay.querySelector('#exam-error');
    const submit = form.querySelector('[type="submit"]');
    overlay.querySelector('[data-exam="cancel"]').addEventListener('click', () => finish(false));
    form.code.focus();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.code = data.code.trim();
      data.name = data.name.trim();
      if (!data.code || !data.name) { error.textContent = 'Code and name are required.'; return; }
      if (data.opens_at && data.closes_at && new Date(data.closes_at) <= new Date(data.opens_at)) {
        error.textContent = 'The closing time must be after the opening time.';
        return;
      }
      data.opens_at = fromLocalInput(data.opens_at);
      data.closes_at = fromLocalInput(data.closes_at);
      error.textContent = '';
      setBusy(submit, true);
      try {
        await save(data);
        finish(true);
      } catch (err) {
        error.textContent = err.message || 'Unable to save the examination.';
        setBusy(submit, false);
      }
    });
  });
}

export function initExaminations() {
  const $ = (selector) => document.querySelector(selector);
  const statusSelect = $('#exam-status');
  const limitSelect = $('#exam-limit');
  const refreshButton = $('#exams-refresh');
  const createButton = $('#exam-create');
  const countElement = $('#exams-status');
  const summary = $('#exams-summary');
  const tableContainer = $('#exams-table-container');

  let currentExaminations = [];
  let requestId = 0;

  async function load() {
    const current = ++requestId;
    setBusy(refreshButton, true);
    tableContainer.innerHTML = '<div class="skeleton-rows" aria-hidden="true"><i></i><i></i><i></i></div>';
    const result = await fetchExaminations(statusSelect.value, limitSelect.value);
    if (current !== requestId) return;
    setBusy(refreshButton, false);
    if (!result) {
      currentExaminations = [];
      summary.innerHTML = '';
      countElement.textContent = '';
      tableContainer.innerHTML = '<div class="empty"><p>We could not load examinations. Check your connection and try again.</p></div>';
      return;
    }
    currentExaminations = result;
    countElement.textContent = `${result.length} examination${result.length === 1 ? '' : 's'}`;
    summary.innerHTML = result.length ? renderSummary(result) : '';
    tableContainer.innerHTML = renderExaminationsTable(result);
  }

  refreshButton.addEventListener('click', load);
  statusSelect.addEventListener('change', load);
  limitSelect.addEventListener('change', load);

  createButton.addEventListener('click', async () => {
    if (await showExaminationModal(null, createExamination)) {
      toast('Examination created.', 'ok');
      load();
    }
  });

  tableContainer.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    const examination = currentExaminations.find((ex) => String(ex.id) === id);

    if (action === 'edit' && examination) {
      if (await showExaminationModal(examination, (data) => updateExamination(id, data))) {
        toast('Examination updated.', 'ok');
        load();
      }
    }

    if (action === 'delete') {
      const ok = await confirmDialog({
        title: 'Delete examination',
        message: `Delete "${examination?.name || 'this examination'}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      setBusy(button, true);
      try {
        await deleteExamination(id);
        toast('Examination deleted.', 'ok');
        load();
      } catch (error) {
        toast(error.message || 'Failed to delete examination.', 'err');
        setBusy(button, false);
      }
    }
  });

  load();
}
