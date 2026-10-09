export function authHeaders() {
  return {};
}

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);
}

export function className(value) {
  return String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

export function statusBadge(value) {
  return `<span class="status ${className(value)}">${escapeHtml(value)}</span>`;
}

export function readJson(response) {
  try {
    return response.json();
  } catch (error) {
    console.error('The server returned an invalid API response.', error);
    throw new Error('We could not complete your request right now. Please try again.');
  }
}

/* ---------- new helpers ---------- */

/* Table cell with a data-label, so rows can turn into stacked cards on phones.
   `html` is inserted as-is: escape user data before passing it in. */
export function cell(label, html) {
  return `<td data-label="${escapeHtml(label)}">${html}</td>`;
}

/* "2026-10-07T09:30:00Z" -> "7 Oct 2026". Anything that is not a date is returned escaped, unchanged. */
export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return escapeHtml(date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
}

export function emptyState(message) {
  return '<div class="empty">'
    + '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h18M5 7l1 12h12l1-12M9 7V4h6v3"/></svg>'
    + `<p>${escapeHtml(message)}</p></div>`;
}

/* Small non-blocking message in the bottom-right corner. type: 'info' | 'ok' | 'err' */
let toastHost;
export function toast(message, type = 'info', duration = 4200) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'a-toasts';
    toastHost.setAttribute('role', 'status');
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const element = document.createElement('div');
  element.className = `a-toast ${className(type)}`;
  element.textContent = message;
  toastHost.appendChild(element);

  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    element.classList.add('is-leaving');
    setTimeout(() => element.remove(), 260);
  };
  timer = setTimeout(dismiss, duration);
  element.addEventListener('click', dismiss);
}

/* Disable a button while work is running. */
export function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

/* Bulk operation helpers */
export function getSelectedIds(tableContainer) {
  const checkboxes = tableContainer.querySelectorAll('input[type="checkbox"][data-bulk-select]:checked');
  return Array.from(checkboxes).map(cb => Number(cb.dataset.id));
}

export function updateSelectAllCheckbox(selectAllCheckbox, tableContainer) {
  const checkboxes = tableContainer.querySelectorAll('input[type="checkbox"][data-bulk-select]');
  const checkedCount = tableContainer.querySelectorAll('input[type="checkbox"][data-bulk-select]:checked').length;
  selectAllCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
  selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

export function toggleAllCheckboxes(selectAllCheckbox, tableContainer) {
  const checkboxes = tableContainer.querySelectorAll('input[type="checkbox"][data-bulk-select]');
  checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
}