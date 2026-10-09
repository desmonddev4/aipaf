import { apiFetch, cell, escapeHtml, statusBadge, emptyState, toast, setBusy, formatDate, confirmDialog } from './shared.js';

async function fetchPayments(filters) {
  try {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.purpose) params.set('purpose', filters.purpose);
    if (filters.provider) params.set('provider', filters.provider);
    if (filters.search) params.set('search', filters.search);
    if (filters.limit) params.set('limit', filters.limit);

    const response = await apiFetch(`/api/admin/payments?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch payments');
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Failed to load payments');
    return data.items;
  } catch (error) {
    console.error('Error fetching payments:', error);
    return null;
  }
}

async function updatePaymentStatus(id, status) {
  try {
    const response = await apiFetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-status', id, status })
    });
    if (!response.ok) throw new Error('Failed to update payment status');
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Failed to update payment status');
    return true;
  } catch (error) {
    console.error('Error updating payment status:', error);
    throw error;
  }
}

async function processRefund(id) {
  try {
    const response = await apiFetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refund', id })
    });
    if (!response.ok) throw new Error('Failed to process refund');
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Failed to process refund');
    return true;
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
}

const STATUSES = ['pending', 'authorized', 'paid', 'failed', 'refunded', 'cancelled'];
const cap = (value) => String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);

function formatMoney(amount, currency) {
  const number = Number(amount);
  if (!Number.isFinite(number)) return escapeHtml(`${amount ?? ''} ${currency ?? ''}`.trim());
  return `<span class="money">${escapeHtml(currency || '')} ${number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
}

function renderSummary(payments) {
  const sum = (list) => list.reduce((total, p) => total + (Number(p.amount) || 0), 0);
  const by = (status) => payments.filter((p) => p.status === status);
  const currency = payments[0]?.currency || '';
  const money = (value) => `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`.trim();
  const items = [
    ['Collected', money(sum(by('paid'))), `${by('paid').length} paid`, 'ok'],
    ['Awaiting', money(sum([...by('pending'), ...by('authorized')])), `${by('pending').length + by('authorized').length} in progress`, 'warn'],
    ['Failed or cancelled', String(by('failed').length + by('cancelled').length), 'payments', 'bad'],
    ['Refunded', money(sum(by('refunded'))), `${by('refunded').length} refunds`, 'mute'],
  ];
  return items.map(([label, value, note, tone]) => `<div class="pay-stat ${tone}"><span>${label}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`).join('');
}

function renderPaymentsTable(payments) {
  if (!payments || payments.length === 0) return emptyState('No payments match these filters.');

  const rows = payments.map((p) => {
    const canUpdate = p.status !== 'refunded' && p.status !== 'cancelled';
    const canRefund = p.status === 'paid' || p.status === 'authorized';
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();

    const options = STATUSES.map((s) => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${cap(s)}</option>`).join('');
    const actions = (canUpdate
      ? `<select class="status-select" aria-label="New status" data-id="${escapeHtml(p.id)}">${options}</select><button class="btn btn-ghost btn-sm" type="button" data-action="update-status" data-id="${escapeHtml(p.id)}">Update</button>`
      : '<span class="pay-final">Final</span>')
      + (canRefund ? `<button class="btn btn-danger btn-sm" type="button" data-action="refund" data-id="${escapeHtml(p.id)}">Refund</button>` : '');

    return '<tr>'
      + cell('Member', `<span class="pay-member"><strong>${escapeHtml(name || p.email || '—')}</strong>${name && p.email ? `<small>${escapeHtml(p.email)}</small>` : ''}</span>`)
      + cell('Amount', formatMoney(p.amount, p.currency))
      + cell('Purpose', `<span class="pay-purpose">${escapeHtml(p.purpose || '—')}</span>`)
      + cell('Provider', `<span class="pay-provider">${escapeHtml(p.provider || '—')}</span><small class="pay-ref">${escapeHtml(p.provider_reference || '')}</small>`)
      + cell('Status', statusBadge(p.status))
      + cell('Paid', p.paid_at ? formatDate(p.paid_at) : '—')
      + cell('Actions', `<div class="row-actions">${actions}</div>`)
      + '</tr>';
  }).join('');

  return `<table class="data-table"><thead><tr><th scope="col">Member</th><th scope="col">Amount</th><th scope="col">Purpose</th><th scope="col">Provider</th><th scope="col">Status</th><th scope="col">Paid</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function exportPaymentsToCsv(payments) {
  const headers = ['ID', 'Member Email', 'Member Name', 'Provider', 'Reference', 'Amount', 'Currency', 'Purpose', 'Status', 'Paid At', 'Created At'];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = payments.map((p) => [
    p.id, p.email, `${p.first_name || ''} ${p.last_name || ''}`.trim(), p.provider, p.provider_reference,
    p.amount, p.currency, p.purpose, p.status, p.paid_at, p.created_at,
  ].map(escape).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function initPayments() {
  const $ = (selector) => document.querySelector(selector);
  const filters = { status: $('#payment-status'), purpose: $('#payment-purpose'), provider: $('#payment-provider'), limit: $('#payment-limit') };
  const searchInput = $('#payment-search');
  const refreshButton = $('#payments-refresh');
  const exportButton = $('#payments-export');
  const countElement = $('#payments-status');
  const summary = $('#payments-summary');
  const tableContainer = $('#payments-table-container');

  let currentPayments = [];
  let requestId = 0;

  async function load() {
    const current = ++requestId;
    setBusy(refreshButton, true);
    tableContainer.innerHTML = '<div class="skeleton-rows" aria-hidden="true"><i></i><i></i><i></i><i></i></div>';
    const result = await fetchPayments({
      status: filters.status.value, purpose: filters.purpose.value, provider: filters.provider.value,
      limit: filters.limit.value, search: searchInput.value.trim(),
    });
    if (current !== requestId) return;
    setBusy(refreshButton, false);
    if (!result) {
      currentPayments = [];
      summary.innerHTML = '';
      countElement.textContent = '';
      tableContainer.innerHTML = '<div class="empty"><p>We could not load payments. Check your connection and try again.</p></div>';
      return;
    }
    currentPayments = result;
    countElement.textContent = `${result.length} payment${result.length === 1 ? '' : 's'}`;
    summary.innerHTML = result.length ? renderSummary(result) : '';
    tableContainer.innerHTML = renderPaymentsTable(result);
  }

  let timer;
  searchInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 350); });
  refreshButton.addEventListener('click', load);
  Object.values(filters).forEach((select) => select.addEventListener('change', load));

  exportButton.addEventListener('click', () => {
    if (currentPayments.length === 0) { toast('No payments to export.', 'info'); return; }
    const blob = new Blob([exportPaymentsToCsv(currentPayments)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payments_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast('Payments exported.', 'ok');
  });

  tableContainer.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;

    if (action === 'update-status') {
      const newStatus = tableContainer.querySelector(`.status-select[data-id="${CSS.escape(id)}"]`).value;
      const payment = currentPayments.find((p) => String(p.id) === id);
      if (payment && payment.status === newStatus) { toast('Choose a different status first.', 'info'); return; }
      const ok = await confirmDialog({ title: 'Update payment status', message: `Change this payment to "${newStatus}"?`, confirmLabel: 'Update status' });
      if (!ok) return;
      setBusy(button, true);
      try {
        await updatePaymentStatus(id, newStatus);
        toast('Payment status updated.', 'ok');
        load();
      } catch (error) {
        toast(error.message || 'Failed to update payment status.', 'err');
        setBusy(button, false);
      }
    }

    if (action === 'refund') {
      const ok = await confirmDialog({ title: 'Refund payment', message: 'This marks the payment as refunded and cannot be undone.', confirmLabel: 'Refund payment', danger: true });
      if (!ok) return;
      setBusy(button, true);
      try {
        await processRefund(id);
        toast('Payment refunded.', 'ok');
        load();
      } catch (error) {
        toast(error.message || 'Failed to process refund.', 'err');
        setBusy(button, false);
      }
    }
  });

  load();
}
