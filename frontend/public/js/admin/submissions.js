import { apiFetch, authHeaders, cell, emptyState, escapeHtml, formatDate, readJson, setBusy, statusBadge, toast, getSelectedIds, updateSelectAllCheckbox, toggleAllCheckboxes } from './shared.js';

export function initSubmissions({ showLogin }) {
  const tableSelect = document.querySelector('#admin-table');
  const statusSelect = document.querySelector('#admin-status');
  const searchInput = document.querySelector('#admin-search');
  const tableContainer = document.querySelector('#admin-table-container');
  if (!tableContainer || !statusSelect || !searchInput) return { refresh() {} };

  let searchTimer;
  let refreshSeq = 0;
  let selectAllCheckbox = null;
  const selectedTable = () => tableSelect?.value || 'members';

  const humanize = (field) => field.replace(/_/g, ' ');
  const isDateField = (field) => /(_at|date)$/i.test(field);

  function renderRows(items) {
    if (!items.length) {
      tableContainer.innerHTML = emptyState('No records match the current filters.');
      return;
    }

    const fields = Object.keys(items[0]);
    const isMembers = selectedTable() === 'members';

    const rows = items.map((item) => {
      const cells = fields.map((field) => {
        const value = item[field] ?? '';
        const label = humanize(field);
        if (field === 'email_status' || field === 'membership_status') return cell(label, statusBadge(value));
        if (isDateField(field)) return cell(label, formatDate(value));
        // Make email clickable for members
        if (field === 'email' && isMembers) {
          return `<td data-label="${escapeHtml(label)}" title="${escapeHtml(value)}" style="cursor: pointer; color: var(--a-green); font-weight: 600;">${escapeHtml(value)}</td>`;
        }
        return `<td data-label="${escapeHtml(label)}" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
      }).join('');

      const action = isMembers
        ? `<select aria-label="Member status" data-action="status" data-id="${escapeHtml(item.id)}"><option value="unverified">Unverified</option><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="expired">Expired</option></select>`
        : `<button type="button" data-action="handled" data-id="${escapeHtml(item.id)}" data-table="${escapeHtml(selectedTable())}">Mark handled</button>`;

      return `<tr>${cell('Select', '<input type="checkbox" data-bulk-select data-id="' + escapeHtml(item.id) + '">')}${cells}${cell('Action', `<div class="row-actions">${action}</div>`)}</tr>`;
    }).join('');

    tableContainer.innerHTML = `<table class="data-table"><thead><tr><th scope="col"><input type="checkbox" id="select-all-checkbox"></th>${fields.map((field) => `<th scope="col">${escapeHtml(humanize(field))}</th>`).join('')}<th scope="col">Action</th></tr></thead><tbody>${rows}</tbody></table>`;

    // Setup select all checkbox
    selectAllCheckbox = tableContainer.querySelector('#select-all-checkbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', () => toggleAllCheckboxes(selectAllCheckbox, tableContainer));
      tableContainer.querySelectorAll('input[type="checkbox"][data-bulk-select]').forEach(cb => {
        cb.addEventListener('change', () => {
          updateSelectAllCheckbox(selectAllCheckbox, tableContainer);
          updateBulkActionsButton();
        });
      });
    }
    updateBulkActionsButton();
  }

  function updateBulkActionsButton() {
    const bulkButton = document.querySelector('#bulk-actions');
    const selectedCount = getSelectedIds(tableContainer).length;
    if (bulkButton) {
      bulkButton.disabled = selectedCount === 0;
      bulkButton.textContent = selectedCount > 0 ? `Bulk Actions (${selectedCount})` : 'Bulk Actions';
    }

    tableContainer.querySelectorAll('[data-action="handled"]').forEach((button) => {
      button.addEventListener('click', async () => {
        setBusy(button, true);
        try {
          const response = await apiFetch(`/api/admin/submissions?table=${selectedTable()}`, {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({ action: 'mark-handled', id: button.dataset.id }),
          });
          const data = await readJson(response);
          if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to update the submission.');
          toast('Marked as handled.', 'ok');
          refresh();
        } catch (error) {
          toast(error.message || 'Unable to update the submission.', 'err');
        } finally {
          setBusy(button, false);
        }
      });
    });

    tableContainer.querySelectorAll('[data-action="status"]').forEach((select) => {
      const statusCell = select.closest('tr').querySelector('.status');
      select.value = statusCell ? statusCell.textContent.trim().toLowerCase() : 'unverified';
      select.addEventListener('change', async () => {
        select.disabled = true;
        try {
          const response = await apiFetch('/api/admin/members', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({ action: 'update-status', id: select.dataset.id, status: select.value }),
          });
          const data = await readJson(response);
          if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to update the member.');
          toast('Member status updated.', 'ok');
          refresh();
        } catch (error) {
          toast(error.message || 'Unable to update the member.', 'err');
        } finally {
          select.disabled = false;
        }
      });
    });
  }

  function refresh() {
    const seq = ++refreshSeq;
    const table = selectedTable();
    const endpoint = table === 'members' ? '/api/admin/members' : '/api/admin/submissions';
    const params = new URLSearchParams({
      table,
      status: statusSelect.value,
      search: searchInput.value,
      limit: '100',
    });
    if (table === 'members') params.delete('table');
    tableContainer.classList.add('is-loading');
    apiFetch(`${endpoint}?${params}`, { headers: authHeaders() })
      .then(async (response) => {
        if (response.status === 401) throw new Error('Invalid or expired key.');
        const data = await readJson(response);
        if (!response.ok) throw new Error(data.message || 'Unable to load records.');
        return data;
      })
      .then((data) => { if (seq === refreshSeq) renderRows(data.items || []); })
      .catch((error) => { if (seq === refreshSeq) showLogin(error.message); })
      .finally(() => { if (seq === refreshSeq) tableContainer.classList.remove('is-loading'); });
  }

  tableSelect?.addEventListener('change', refresh);
  statusSelect.addEventListener('change', refresh);
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refresh, 250);
  });
  document.querySelector('#admin-refresh')?.addEventListener('click', refresh);

  document.querySelector('#admin-export')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true);
    try {
      const response = await apiFetch(`/api/admin/submissions?table=${selectedTable()}&format=csv`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to export submissions.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${selectedTable()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast('Export downloaded.', 'ok');
    } catch {
      toast('Unable to export submissions.', 'err');
    } finally {
      setBusy(button, false);
    }
  });

  // Bulk actions handler
  document.querySelector('#bulk-actions')?.addEventListener('click', async () => {
    const selectedIds = getSelectedIds(tableContainer);
    if (selectedIds.length === 0) {
      toast('No items selected.', 'err');
      return;
    }

    const isMembers = selectedTable() === 'members';
    const action = isMembers ? 'bulk-update-status' : 'bulk-mark-handled';

    if (isMembers) {
      const bulkAction = prompt('Choose bulk action:\n1. Update Status\n2. Export Data\n\nEnter number (1 or 2):');
      if (bulkAction === '1') {
        const newStatus = prompt('Enter new status (unverified, pending, active, suspended, expired):');
        if (!newStatus || !['unverified', 'pending', 'active', 'suspended', 'expired'].includes(newStatus)) {
          toast('Invalid status.', 'err');
          return;
        }

        if (!confirm(`Update ${selectedIds.length} members to status: ${newStatus}?`)) return;

        setBusy(document.querySelector('#bulk-actions'), true);
        try {
          const response = await apiFetch('/api/admin/members', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({ action, ids: selectedIds, status: newStatus }),
          });
          const data = await readJson(response);
          if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to update members.');
          toast(data.message, 'ok');
          refresh();
        } catch (error) {
          toast(error.message || 'Unable to update members.', 'err');
        } finally {
          setBusy(document.querySelector('#bulk-actions'), false);
        }
      } else if (bulkAction === '2') {
        if (!confirm(`Export data for ${selectedIds.length} members?`)) return;

        setBusy(document.querySelector('#bulk-actions'), true);
        try {
          const response = await apiFetch('/api/admin/members', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({ action: 'export-data', ids: selectedIds }),
          });
          const data = await readJson(response);
          if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to export data.');

          const dataStr = JSON.stringify(data, null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `members-bulk-export-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast('Member data exported successfully.', 'ok');
        } catch (error) {
          toast(error.message || 'Unable to export member data.', 'err');
        } finally {
          setBusy(document.querySelector('#bulk-actions'), false);
        }
      } else {
        toast('Invalid action.', 'err');
      }
    } else {
      if (!confirm(`Mark ${selectedIds.length} submissions as handled?`)) return;

      setBusy(document.querySelector('#bulk-actions'), true);
      try {
        const response = await apiFetch(`/api/admin/submissions?table=${selectedTable()}`, {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
          body: JSON.stringify({ action, ids: selectedIds }),
        });
        const data = await readJson(response);
        if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to update submissions.');
        toast(data.message, 'ok');
        refresh();
      } catch (error) {
        toast(error.message || 'Unable to update submissions.', 'err');
      } finally {
        setBusy(document.querySelector('#bulk-actions'), false);
      }
    }
  });

  return { refresh };
}