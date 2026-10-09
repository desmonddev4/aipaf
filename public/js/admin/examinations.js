import { cell, escapeHtml } from './shared.js';

async function fetchExaminations(status, limit) {
  try {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('limit', limit);

    const response = await fetch(`/api/admin/examinations?${params.toString()}`);
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
    const response = await fetch(apiUrl('/api/admin/examinations', {
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
    const response = await fetch(apiUrl('/api/admin/examinations', {
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
    const response = await fetch(apiUrl('/api/admin/examinations', {
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

function renderExaminationsTable(examinations) {
  if (!examinations || examinations.length === 0) {
    return '<p class="admin-note">No examinations found.</p>';
  }

  const rows = examinations.map(ex => {
    const statusClass = ex.status === 'open' ? 'status-ok' : ex.status === 'closed' || ex.status === 'archived' ? 'status-err' : '';
    const statusLabel = ex.status.charAt(0).toUpperCase() + ex.status.slice(1);
    const hasRegistrations = parseInt(ex.registration_count) > 0;

    return '<tr>'
      + cell('Code', escapeHtml(ex.code))
      + cell('Name', escapeHtml(ex.name))
      + cell('Status', `<span class="${statusClass}">${escapeHtml(statusLabel)}</span>`)
      + cell('Opens', escapeHtml(ex.opens_at ? new Date(ex.opens_at).toLocaleDateString() : '—'))
      + cell('Closes', escapeHtml(ex.closes_at ? new Date(ex.closes_at).toLocaleDateString() : '—'))
      + cell('Registrations', escapeHtml(ex.registration_count || 0))
      + cell('Actions', `
        <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${ex.id}">Edit</button>
        ${!hasRegistrations ? `<button class="btn btn-ghost btn-sm" data-action="delete" data-id="${ex.id}">Delete</button>` : ''}
      `)
      + '</tr>';
  }).join('');

  return `<table class="data-table"><thead><tr><th scope="col">Code</th><th scope="col">Name</th><th scope="col">Status</th><th scope="col">Opens</th><th scope="col">Closes</th><th scope="col">Registrations</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function showExaminationModal(examination = null) {
  const isEdit = examination !== null;
  const title = isEdit ? 'Edit Examination' : 'Create Examination';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <h2>${title}</h2>
      <form id="exam-form">
        <div class="field"><label for="exam-code">Code *</label><input id="exam-code" name="code" type="text" required value="${escapeHtml(examination?.code || '')}"></div>
        <div class="field"><label for="exam-name">Name *</label><input id="exam-name" name="name" type="text" required value="${escapeHtml(examination?.name || '')}"></div>
        <div class="field"><label for="exam-description">Description</label><textarea id="exam-description" name="description">${escapeHtml(examination?.description || '')}</textarea></div>
        <div class="field"><label for="exam-opens">Opens at</label><input id="exam-opens" name="opens_at" type="datetime-local" value="${examination?.opens_at ? examination.opens_at.slice(0, 16) : ''}"></div>
        <div class="field"><label for="exam-closes">Closes at</label><input id="exam-closes" name="closes_at" type="datetime-local" value="${examination?.closes_at ? examination.closes_at.slice(0, 16) : ''}"></div>
        <div class="field"><label for="exam-status">Status</label><select id="exam-status" name="status">
          <option value="draft" ${examination?.status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="open" ${examination?.status === 'open' ? 'selected' : ''}>Open</option>
          <option value="closed" ${examination?.status === 'closed' ? 'selected' : ''}>Closed</option>
          <option value="archived" ${examination?.status === 'archived' ? 'selected' : ''}>Archived</option>
        </select></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" id="exam-cancel">Cancel</button>
          <button class="btn" type="submit">${isEdit ? 'Update' : 'Create'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  return new Promise((resolve) => {
    const form = modal.querySelector('#exam-form');
    const cancelBtn = modal.querySelector('#exam-cancel');

    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(null);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      document.body.removeChild(modal);
      resolve(data);
    });
  });
}

export function initExaminations() {
  const statusSelect = document.querySelector('#exam-status');
  const limitSelect = document.querySelector('#exam-limit');
  const refreshButton = document.querySelector('#exams-refresh');
  const createButton = document.querySelector('#exam-create');
  const statusElement = document.querySelector('#exams-status');
  const tableContainer = document.querySelector('#exams-table-container');

  let currentExaminations = [];

  async function load() {
    tableContainer.innerHTML = '<p class="admin-note">Loading examinations...</p>';
    currentExaminations = await fetchExaminations(statusSelect.value, limitSelect.value);
    if (!currentExaminations) {
      tableContainer.innerHTML = '<p class="admin-note">Unable to load examinations. Please try again.</p>';
      return;
    }
    tableContainer.innerHTML = renderExaminationsTable(currentExaminations);
  }

  refreshButton.addEventListener('click', load);
  statusSelect.addEventListener('change', load);
  limitSelect.addEventListener('change', load);

  createButton.addEventListener('click', async function () {
    const data = await showExaminationModal();
    if (!data) return;

    createButton.disabled = true;
    createButton.textContent = 'Creating...';

    try {
      await createExamination(data);
      statusElement.textContent = 'Examination created successfully.';
      statusElement.className = 'records-status ok';
      load();
    } catch (error) {
      statusElement.textContent = error.message || 'Failed to create examination.';
      statusElement.className = 'records-status err';
    } finally {
      createButton.disabled = false;
      createButton.textContent = 'Create examination';
    }
  });

  tableContainer.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    const examination = currentExaminations.find(ex => ex.id === id);

    if (action === 'edit') {
      const data = await showExaminationModal(examination);
      if (!data) return;

      button.disabled = true;
      button.textContent = 'Updating...';

      try {
        await updateExamination(id, data);
        statusElement.textContent = 'Examination updated successfully.';
        statusElement.className = 'records-status ok';
        load();
      } catch (error) {
        statusElement.textContent = error.message || 'Failed to update examination.';
        statusElement.className = 'records-status err';
        button.disabled = false;
        button.textContent = 'Edit';
      }
    }

    if (action === 'delete') {
      if (!confirm('Are you sure you want to delete this examination? This action cannot be undone.')) return;

      button.disabled = true;
      button.textContent = 'Deleting...';

      try {
        await deleteExamination(id);
        statusElement.textContent = 'Examination deleted successfully.';
        statusElement.className = 'records-status ok';
        load();
      } catch (error) {
        statusElement.textContent = error.message || 'Failed to delete examination.';
        statusElement.className = 'records-status err';
        button.disabled = false;
        button.textContent = 'Delete';
      }
    }
  });

  load();
}
