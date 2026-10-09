import { authHeaders, cell, emptyState, escapeHtml, formatDate, readJson, setBusy, statusBadge, toast } from './shared.js';

export function initAudit({ showLogin }) {
  const roleSelect = document.querySelector('#audit-role');
  const actionInput = document.querySelector('#audit-action');
  const startDateInput = document.querySelector('#audit-start');
  const endDateInput = document.querySelector('#audit-end');
  const limitSelect = document.querySelector('#audit-limit');
  const refreshButton = document.querySelector('#audit-refresh');
  const exportButton = document.querySelector('#audit-export');
  const tableContainer = document.querySelector('#audit-table-container');
  const statusSpan = document.querySelector('#audit-status');
  let refreshSeq = 0;

  const humanize = (field) => field.replace(/_/g, ' ');
  const isDateField = (field) => /(_at|date)$/i.test(field);

  function renderRows(items) {
    if (!items.length) {
      tableContainer.innerHTML = emptyState('No audit log entries match the current filters.');
      return;
    }

    const fields = Object.keys(items[0]);

    const rows = items.map((item) => {
      const cells = fields.map((field) => {
        const value = item[field] ?? '';
        const label = humanize(field);
        if (field === 'admin_role') return cell(label, statusBadge(value));
        if (isDateField(field)) return cell(label, formatDate(value));
        if (field === 'details') {
          const detailsStr = JSON.stringify(value);
          return `<td data-label="${escapeHtml(label)}" title="${escapeHtml(detailsStr)}"><code style="font-size: 0.85em;">${escapeHtml(detailsStr.substring(0, 100))}${detailsStr.length > 100 ? '...' : ''}</code></td>`;
        }
        return `<td data-label="${escapeHtml(label)}" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
      }).join('');

      return `<tr>${cells}</tr>`;
    }).join('');

    tableContainer.innerHTML = `<table class="data-table"><thead><tr>${fields.map((field) => `<th scope="col">${escapeHtml(humanize(field))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function refresh() {
    const seq = ++refreshSeq;
    const params = new URLSearchParams({
      role: roleSelect.value,
      actionType: actionInput.value,
      startDate: startDateInput.value,
      endDate: endDateInput.value,
      limit: limitSelect.value,
    });

    tableContainer.classList.add('is-loading');
    statusSpan.textContent = 'Loading...';

    fetch(`/api/admin/audit?${params}`, { headers: authHeaders() })
      .then(async (response) => {
        if (response.status === 401) throw new Error('Invalid or expired key.');
        const data = await readJson(response);
        if (!response.ok) throw new Error(data.message || 'Unable to load audit log.');
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

  roleSelect.addEventListener('change', refresh);
  actionInput.addEventListener('input', () => {
    clearTimeout(refreshSeq);
    setTimeout(refresh, 500);
  });
  startDateInput.addEventListener('change', refresh);
  endDateInput.addEventListener('change', refresh);
  limitSelect.addEventListener('change', refresh);
  refreshButton.addEventListener('click', refresh);

  exportButton.addEventListener('click', async () => {
    const params = new URLSearchParams({
      role: roleSelect.value,
      actionType: actionInput.value,
      startDate: startDateInput.value,
      endDate: endDateInput.value,
      limit: limitSelect.value,
      format: 'csv',
    });

    try {
      const response = await fetch(`/api/admin/audit?${params}`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to export audit log.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'audit-log.csv';
      anchor.click();
      URL.revokeObjectURL(url);
      toast('Export downloaded.', 'ok');
    } catch {
      toast('Unable to export audit log.', 'err');
    }
  });

  return { refresh };
}
