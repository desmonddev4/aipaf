import { apiFetch, authHeaders, cell, emptyState, escapeHtml, formatDate, readJson, setBusy, statusBadge, toast } from './shared.js';

export function initDataDeletion({ showLogin }) {
  const statusSelect = document.querySelector('#deletion-status');
  const typeSelect = document.querySelector('#deletion-type');
  const limitSelect = document.querySelector('#deletion-limit');
  const refreshButton = document.querySelector('#deletions-refresh');
  const exportButton = document.querySelector('#deletions-export');
  const tableContainer = document.querySelector('#deletions-table-container');
  const statusSpan = document.querySelector('#deletions-status');
  let refreshSeq = 0;

  const humanize = (field) => field.replace(/_/g, ' ');
  const isDateField = (field) => /(_at|date)$/i.test(field);

  function renderRows(items) {
    if (!items.length) {
      tableContainer.innerHTML = emptyState('No deletion requests match the current filters.');
      return;
    }

    const fields = Object.keys(items[0]);

    const rows = items.map((item) => {
      const cells = fields.map((field) => {
        const value = item[field] ?? '';
        const label = humanize(field);
        if (field === 'status') return cell(label, statusBadge(value));
        if (isDateField(field)) return cell(label, formatDate(value));
        return `<td data-label="${escapeHtml(label)}" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
      }).join('');

      const actions = `<div class="row-actions">
        <button type="button" data-action="process" data-id="${escapeHtml(item.id)}" data-email="${escapeHtml(item.email)}" data-type="${escapeHtml(item.request_type)}">Process</button>
        <button type="button" data-action="update-status" data-id="${escapeHtml(item.id)}">Update Status</button>
      </div>`;

      return `<tr>${cells}${cell('Actions', actions)}</tr>`;
    }).join('');

    tableContainer.innerHTML = `<table class="data-table"><thead><tr>${fields.map((field) => `<th scope="col">${escapeHtml(humanize(field))}</th>`).join('')}<th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;

    tableContainer.querySelectorAll('[data-action="process"]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm(`Process deletion request for ${button.dataset.email} (${button.dataset.type})? This will permanently delete the data.`)) return;

        setBusy(button, true);
        try {
          const response = await apiFetch('/api/admin/data-deletion', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({ action: 'process', id: button.dataset.id }),
          });
          const data = await readJson(response);
          if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to process deletion request.');
          toast(data.message, 'ok');
          refresh();
        } catch (error) {
          toast(error.message || 'Unable to process deletion request.', 'err');
        } finally {
          setBusy(button, false);
        }
      });
    });

    tableContainer.querySelectorAll('[data-action="update-status"]').forEach((button) => {
      button.addEventListener('click', async () => {
        const newStatus = prompt('Enter new status (pending, processing, completed, rejected):');
        if (!newStatus || !['pending', 'processing', 'completed', 'rejected'].includes(newStatus)) {
          toast('Invalid status.', 'err');
          return;
        }

        const adminNotes = prompt('Add admin notes (optional):') || null;

        setBusy(button, true);
        try {
          const response = await apiFetch('/api/admin/data-deletion', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({ action: 'update-status', id: button.dataset.id, status: newStatus, adminNotes }),
          });
          const data = await readJson(response);
          if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to update deletion request.');
          toast('Deletion request updated.', 'ok');
          refresh();
        } catch (error) {
          toast(error.message || 'Unable to update deletion request.', 'err');
        } finally {
          setBusy(button, false);
        }
      });
    });
  }

  function refresh() {
    const seq = ++refreshSeq;
    const params = new URLSearchParams({
      status: statusSelect.value,
      type: typeSelect.value,
      limit: limitSelect.value,
    });

    tableContainer.classList.add('is-loading');
    statusSpan.textContent = 'Loading...';

    apiFetch(`/api/admin/data-deletion?${params}`, { headers: authHeaders() })
      .then(async (response) => {
        if (response.status === 401) throw new Error('Invalid or expired key.');
        const data = await readJson(response);
        if (!response.ok) throw new Error(data.message || 'Unable to load deletion requests.');
        return data;
      })
      .then((data) => { if (seq === refreshSeq) renderRows(data.items || []); })
      .catch((error) => { if (seq === refreshSeq) showLogin(error.message); })
      .finally(() => {
        if (seq === refreshSeq) {
          tableContainer.classList.remove('is-loading');
          statusSpan.textContent = '';
        }
      });
  }

  statusSelect.addEventListener('change', refresh);
  typeSelect.addEventListener('change', refresh);
  limitSelect.addEventListener('change', refresh);
  refreshButton.addEventListener('click', refresh);

  exportButton.addEventListener('click', async () => {
    const params = new URLSearchParams({
      status: statusSelect.value,
      type: typeSelect.value,
      limit: limitSelect.value,
      format: 'csv',
    });

    try {
      const response = await apiFetch(`/api/admin/data-deletion?${params}`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to export deletion requests.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'data-deletion-requests.csv';
      anchor.click();
      URL.revokeObjectURL(url);
      toast('Export downloaded.', 'ok');
    } catch {
      toast('Unable to export deletion requests.', 'err');
    }
  });

  return { refresh };
}
