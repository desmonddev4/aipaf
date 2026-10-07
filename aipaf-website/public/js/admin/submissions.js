import { authHeaders, cell, emptyState, escapeHtml, formatDate, readJson, setBusy, statusBadge, toast } from './shared.js';

export function initSubmissions({ showLogin }) {
  const tableSelect = document.querySelector('#admin-table');
  const statusSelect = document.querySelector('#admin-status');
  const searchInput = document.querySelector('#admin-search');
  const tableContainer = document.querySelector('#admin-table-container');
  let searchTimer;
  let refreshSeq = 0;

  const humanize = (field) => field.replace(/_/g, ' ');
  const isDateField = (field) => /(_at|date)$/i.test(field);

  function renderRows(items) {
    if (!items.length) {
      tableContainer.innerHTML = emptyState('No records match the current filters.');
      return;
    }

    const fields = Object.keys(items[0]);
    const isMembers = tableSelect.value === 'members';

    const rows = items.map((item) => {
      const cells = fields.map((field) => {
        const value = item[field] ?? '';
        const label = humanize(field);
        if (field === 'email_status' || field === 'membership_status') return cell(label, statusBadge(value));
        if (isDateField(field)) return cell(label, formatDate(value));
        return `<td data-label="${escapeHtml(label)}" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
      }).join('');

      const action = isMembers
        ? `<select aria-label="Member status" data-action="status" data-id="${escapeHtml(item.id)}"><option value="unverified">Unverified</option><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="expired">Expired</option></select>`
        : `<button type="button" data-action="handled" data-id="${escapeHtml(item.id)}" data-table="${escapeHtml(tableSelect.value)}">Mark handled</button>`;

      return `<tr>${cells}${cell('Action', `<div class="row-actions">${action}</div>`)}</tr>`;
    }).join('');

    tableContainer.innerHTML = `<table class="data-table"><thead><tr>${fields.map((field) => `<th scope="col">${escapeHtml(humanize(field))}</th>`).join('')}<th scope="col">Action</th></tr></thead><tbody>${rows}</tbody></table>`;

    tableContainer.querySelectorAll('[data-action="handled"]').forEach((button) => {
      button.addEventListener('click', async () => {
        setBusy(button, true);
        try {
          const response = await fetch(`/api/admin/submissions?table=${tableSelect.value}`, {
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
          const response = await fetch('/api/admin/members', {
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
    const endpoint = tableSelect.value === 'members' ? '/api/admin/members' : '/api/admin/submissions';
    const params = new URLSearchParams({
      table: tableSelect.value,
      status: statusSelect.value,
      search: searchInput.value,
      limit: '100',
    });
    if (tableSelect.value === 'members') params.delete('table');
    tableContainer.classList.add('is-loading');
    fetch(`${endpoint}?${params}`, { headers: authHeaders() })
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

  tableSelect.addEventListener('change', refresh);
  statusSelect.addEventListener('change', refresh);
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refresh, 250);
  });
  document.querySelector('#admin-refresh').addEventListener('click', refresh);

  document.querySelector('#admin-export').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true);
    try {
      const response = await fetch(`/api/admin/submissions?table=${tableSelect.value}&format=csv`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to export submissions.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${tableSelect.value}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast('Export downloaded.', 'ok');
    } catch {
      toast('Unable to export submissions.', 'err');
    } finally {
      setBusy(button, false);
    }
  });

  return { refresh };
}