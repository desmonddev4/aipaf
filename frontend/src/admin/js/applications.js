import { apiFetch, cell, escapeHtml } from './shared.js';

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
  try {
    const response = await apiFetch('/api/admin/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-status', id, status, notes })
    });
    if (!response.ok) throw new Error('Failed to update application status');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to update application status');
    return result;
  } catch (error) {
    console.error('Error updating application status:', error);
    throw error;
  }
}

function renderApplicationsTable(applications) {
  if (!applications || applications.length === 0) {
    return '<p class="admin-note">No applications found.</p>';
  }

  const rows = applications.map(app => {
    const statusClass = app.status === 'approved' ? 'status-ok' : app.status === 'rejected' ? 'status-err' : '';
    const statusLabel = app.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const gradeLabel = app.grade.charAt(0).toUpperCase() + app.grade.slice(1);
    const canReview = app.status === 'submitted' || app.status === 'under_review';

    const statusOptions = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn']
      .map(s => `<option value="${s}" ${app.status === s ? 'selected' : ''}>${s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>`)
      .join('');

    const reviewButton = canReview
      ? `<select class="status-select" data-id="${app.id}">${statusOptions}</select> <button class="btn btn-ghost btn-sm" data-action="update-status" data-id="${app.id}">Update</button>`
      : '';

    return '<tr>'
      + cell('ID', escapeHtml(app.id?.substring(0, 8) || '—'))
      + cell('Member', escapeHtml(app.email || '—'))
      + cell('Name', `${escapeHtml(app.first_name)} ${escapeHtml(app.last_name)}`)
      + cell('Grade', escapeHtml(gradeLabel))
      + cell('Status', `<span class="${statusClass}">${escapeHtml(statusLabel)}</span>`)
      + cell('Submitted', escapeHtml(app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'))
      + cell('Reviewed', escapeHtml(app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString() : '—'))
      + cell('Notes', escapeHtml(app.reviewer_notes || '—'))
      + cell('Actions', reviewButton)
      + '</tr>';
  }).join('');

  return `<table class="data-table"><thead><tr><th scope="col">ID</th><th scope="col">Member</th><th scope="col">Name</th><th scope="col">Grade</th><th scope="col">Status</th><th scope="col">Submitted</th><th scope="col">Reviewed</th><th scope="col">Notes</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function initApplications() {
  const statusSelect = document.querySelector('#app-status');
  const gradeSelect = document.querySelector('#app-grade');
  const limitSelect = document.querySelector('#app-limit');
  const refreshButton = document.querySelector('#apps-refresh');
  const exportButton = document.querySelector('#apps-export');
  const statusElement = document.querySelector('#apps-status');
  const tableContainer = document.querySelector('#apps-table-container');

  async function load() {
    tableContainer.innerHTML = '<p class="admin-note">Loading applications...</p>';
    const applications = await fetchApplications(statusSelect.value, gradeSelect.value, limitSelect.value);
    if (!applications) {
      tableContainer.innerHTML = '<p class="admin-note">Unable to load applications. Please try again.</p>';
      return;
    }
    tableContainer.innerHTML = renderApplicationsTable(applications);
  }

  refreshButton.addEventListener('click', load);
  statusSelect.addEventListener('change', load);
  gradeSelect.addEventListener('change', load);
  limitSelect.addEventListener('change', load);

  exportButton.addEventListener('click', async () => {
    const params = new URLSearchParams();
    if (statusSelect.value) params.set('status', statusSelect.value);
    if (gradeSelect.value) params.set('grade', gradeSelect.value);
    params.set('limit', limitSelect.value);
    params.set('format', 'csv');

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
      statusElement.textContent = 'Export downloaded.';
      statusElement.className = 'records-status ok';
    } catch (error) {
      statusElement.textContent = 'Unable to export applications.';
      statusElement.className = 'records-status err';
    }
  });

  tableContainer.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === 'update-status') {
      const statusSelect = tableContainer.querySelector(`.status-select[data-id="${id}"]`);
      const newStatus = statusSelect.value;

      if (newStatus === 'approved' || newStatus === 'rejected') {
        const notes = prompt('Enter reviewer notes:');
        if (notes === null) return;
      }

      if (!confirm(`Update application status to ${newStatus}?`)) return;

      button.disabled = true;
      button.textContent = 'Updating...';

      try {
        const notes = newStatus === 'approved' || newStatus === 'rejected' ? prompt('Enter reviewer notes:') : null;
        await updateApplicationStatus(id, newStatus, notes);
        statusElement.textContent = 'Application status updated successfully.';
        statusElement.className = 'records-status ok';
        load();
      } catch (error) {
        statusElement.textContent = error.message || 'Failed to update application status.';
        statusElement.className = 'records-status err';
        button.disabled = false;
        button.textContent = 'Update';
      }
    }
  });

  load();
}
