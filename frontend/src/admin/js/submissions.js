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

  const MEMBER_COLUMNS = [
    ['id', 'ID'], ['name', 'Member'], ['email', 'Email'], ['organisation', 'Organisation'],
    ['membership_grade', 'Grade'], ['membership_status', 'Status'], ['created_at', 'Joined'],
  ];
  const countEl = document.querySelector('#members-count');
  const initials = (item) => ((item.first_name || '?')[0] + (item.last_name || '')[0]).toUpperCase();

  function memberCell(item, field, label) {
    const value = item[field] ?? '';
    if (field === 'id') return `<td data-label="ID" class="col-id">${escapeHtml(value)}</td>`;
    if (field === 'name') {
      const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || '—';
      return cell(label, `<span class="m-person"><span class="m-avatar" aria-hidden="true">${escapeHtml(initials(item))}</span><span>${escapeHtml(name)}</span></span>`);
    }
    if (field === 'email') return `<td data-label="Email" title="Click to open profile" class="cell-link">${escapeHtml(value)}</td>`;
    if (field === 'membership_status') return cell(label, statusBadge(value));
    if (field === 'membership_grade') return cell(label, `<span class="m-grade">${escapeHtml(value || '—')}</span>`);
    if (field === 'created_at') return cell(label, formatDate(value));
    return cell(label, escapeHtml(value || '—'));
  }

  function renderRows(items) {
    if (countEl) countEl.textContent = items.length ? `${items.length} record${items.length === 1 ? '' : 's'}` : '';
    if (!items.length) {
      tableContainer.innerHTML = emptyState('No records match the current filters.');
      updateBulkActionsButton();
      return;
    }

    const isMembers = selectedTable() === 'members';
    const columns = isMembers ? MEMBER_COLUMNS : Object.keys(items[0]).map((field) => [field, humanize(field)]);

    const rows = items.map((item) => {
      const cells = isMembers
        ? columns.map(([field, label]) => memberCell(item, field, label)).join('')
        : columns.map(([field, label]) => {
          const value = item[field] ?? '';
          if (field === 'email_status' || field === 'membership_status') return cell(label, statusBadge(value));
          if (isDateField(field)) return cell(label, formatDate(value));
          return `<td data-label="${escapeHtml(label)}" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
        }).join('');

      const action = isMembers
        ? `<select aria-label="Member status" data-action="status" data-id="${escapeHtml(item.id)}"><option value="unverified">Unverified</option><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="expired">Expired</option></select>`
        : `<button type="button" data-action="handled" data-id="${escapeHtml(item.id)}" data-table="${escapeHtml(selectedTable())}">Mark handled</button>`;

      return `<tr>${cell('Select', '<input type="checkbox" aria-label="Select row" data-bulk-select data-id="' + escapeHtml(item.id) + '">')}${cells}${cell('Action', `<div class="row-actions">${action}</div>`)}</tr>`;
    }).join('');

    const head = columns.map(([field, label]) => `<th scope="col"${field === 'id' ? ' class="col-id"' : ''}>${escapeHtml(label)}</th>`).join('');
    tableContainer.innerHTML = `<table class="data-table"><thead><tr><th scope="col"><input type="checkbox" id="select-all-checkbox" aria-label="Select all"></th>${head}<th scope="col">Action</th></tr></thead><tbody>${rows}</tbody></table>`;

    selectAllCheckbox = tableContainer.querySelector('#select-all-checkbox');
    selectAllCheckbox.addEventListener('change', () => {
      toggleAllCheckboxes(selectAllCheckbox, tableContainer);
      updateBulkActionsButton();
    });
    tableContainer.querySelectorAll('input[type="checkbox"][data-bulk-select]').forEach((cb) => {
      cb.addEventListener('change', () => {
        updateSelectAllCheckbox(selectAllCheckbox, tableContainer);
        updateBulkActionsButton();
      });
    });
    bindRowActions();
    updateBulkActionsButton();
  }

  function updateBulkActionsButton() {
    const bulkButton = document.querySelector('#bulk-actions');
    if (!bulkButton) return;
    const selectedCount = getSelectedIds(tableContainer).length;
    bulkButton.disabled = selectedCount === 0;
    const label = bulkButton.querySelector('[data-label]');
    if (label) label.textContent = selectedCount > 0 ? `Bulk actions (${selectedCount})` : 'Bulk actions';
  }

  function bindRowActions() {
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


  const STATUSES = ['unverified', 'pending', 'active', 'suspended', 'expired'];

  function openBulkDialog(selectedIds) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="bulk-title">
        <h2 id="bulk-title">Bulk actions</h2>
        <p class="modal-text">${selectedIds.length} member${selectedIds.length === 1 ? '' : 's'} selected.</p>
        <div class="field">
          <label for="bulk-status">Set membership status to</label>
          <select id="bulk-status">${STATUSES.map((v) => `<option value="${v}">${v[0].toUpperCase()}${v.slice(1)}</option>`).join('')}</select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-bulk="cancel">Cancel</button>
          <button class="btn btn-ghost" type="button" data-bulk="export">Export data</button>
          <button class="btn" type="button" data-bulk="status">Apply status</button>
        </div>
      </div>`;
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    document.body.appendChild(overlay);
    overlay.querySelector('#bulk-status').focus();

    overlay.querySelector('[data-bulk="cancel"]').addEventListener('click', close);

    overlay.querySelector('[data-bulk="status"]').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const status = overlay.querySelector('#bulk-status').value;
      setBusy(button, true);
      try {
        const response = await apiFetch('/api/admin/members', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
          body: JSON.stringify({ action: 'bulk-update-status', ids: selectedIds, status }),
        });
        const data = await readJson(response);
        if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to update members.');
        toast(data.message || 'Members updated.', 'ok');
        close();
        refresh();
      } catch (error) {
        toast(error.message || 'Unable to update members.', 'err');
        setBusy(button, false);
      }
    });

    overlay.querySelector('[data-bulk="export"]').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      setBusy(button, true);
      try {
        const response = await apiFetch('/api/admin/members', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
          body: JSON.stringify({ action: 'export-data', ids: selectedIds }),
        });
        const data = await readJson(response);
        if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to export data.');
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `members-bulk-export-${Date.now()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        toast('Member data exported.', 'ok');
        close();
      } catch (error) {
        toast(error.message || 'Unable to export member data.', 'err');
        setBusy(button, false);
      }
    });
  }

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
      openBulkDialog(selectedIds);
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