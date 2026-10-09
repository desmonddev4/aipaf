import { apiFetch, cell, escapeHtml } from './shared.js';

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

function renderPaymentsTable(payments) {
  if (!payments || payments.length === 0) {
    return '<p class="admin-note">No payments found.</p>';
  }

  const rows = payments.map(p => {
    const statusClass = p.status === 'paid' ? 'status-ok' : p.status === 'failed' || p.status === 'cancelled' ? 'status-err' : '';
    const statusLabel = p.status.charAt(0).toUpperCase() + p.status.slice(1);
    const canUpdate = p.status !== 'refunded' && p.status !== 'cancelled';
    const canRefund = p.status === 'paid' || p.status === 'authorized';

    const statusOptions = ['pending', 'authorized', 'paid', 'failed', 'refunded', 'cancelled']
      .map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`)
      .join('');

    const updateButton = canUpdate
      ? `<select class="status-select" data-id="${p.id}">${statusOptions}</select> <button class="btn btn-ghost btn-sm" data-action="update-status" data-id="${p.id}">Update</button>`
      : '';

    const refundButton = canRefund
      ? `<button class="btn btn-ghost btn-sm" data-action="refund" data-id="${p.id}">Refund</button>`
      : '';

    return '<tr>'
      + cell('ID', escapeHtml(p.id?.substring(0, 8) || '—'))
      + cell('Member', escapeHtml(p.email || '—'))
      + cell('Provider', escapeHtml(p.provider))
      + cell('Reference', escapeHtml(p.provider_reference || '—'))
      + cell('Amount', `${escapeHtml(p.amount)} ${escapeHtml(p.currency)}`)
      + cell('Purpose', escapeHtml(p.purpose))
      + cell('Status', `<span class="${statusClass}">${escapeHtml(statusLabel)}</span>`)
      + cell('Paid', escapeHtml(p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'))
      + cell('Actions', updateButton + (refundButton ? ' ' + refundButton : ''))
      + '</tr>';
  }).join('');

  return `<table class="data-table"><thead><tr><th scope="col">ID</th><th scope="col">Member</th><th scope="col">Provider</th><th scope="col">Reference</th><th scope="col">Amount</th><th scope="col">Purpose</th><th scope="col">Status</th><th scope="col">Paid</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function exportPaymentsToCsv(payments) {
  if (!payments || payments.length === 0) return '';

  const headers = ['ID', 'Member Email', 'Member Name', 'Provider', 'Reference', 'Amount', 'Currency', 'Purpose', 'Status', 'Paid At', 'Created At'];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

  const rows = payments.map(p => [
    p.id,
    p.email,
    `${p.first_name} ${p.last_name}`,
    p.provider,
    p.provider_reference,
    p.amount,
    p.currency,
    p.purpose,
    p.status,
    p.paid_at,
    p.created_at
  ].map(escape).join(','));

  return [headers.join(','), ...rows].join('\n');
}

export function initPayments() {
  const statusSelect = document.querySelector('#payment-status');
  const purposeSelect = document.querySelector('#payment-purpose');
  const providerSelect = document.querySelector('#payment-provider');
  const limitSelect = document.querySelector('#payment-limit');
  const refreshButton = document.querySelector('#payments-refresh');
  const exportButton = document.querySelector('#payments-export');
  const statusElement = document.querySelector('#payments-status');
  const tableContainer = document.querySelector('#payments-table-container');

  let currentPayments = [];

  async function load() {
    tableContainer.innerHTML = '<p class="admin-note">Loading payments...</p>';
    const filters = {
      status: statusSelect.value,
      purpose: purposeSelect.value,
      provider: providerSelect.value,
      limit: limitSelect.value
    };
    currentPayments = await fetchPayments(filters);
    if (!currentPayments) {
      tableContainer.innerHTML = '<p class="admin-note">Unable to load payments. Please try again.</p>';
      return;
    }
    tableContainer.innerHTML = renderPaymentsTable(currentPayments);
  }

  refreshButton.addEventListener('click', load);
  statusSelect.addEventListener('change', load);
  purposeSelect.addEventListener('change', load);
  providerSelect.addEventListener('change', load);
  limitSelect.addEventListener('change', load);

  exportButton.addEventListener('click', function () {
    if (!currentPayments || currentPayments.length === 0) {
      statusElement.textContent = 'No payments to export.';
      statusElement.className = 'records-status err';
      return;
    }

    const csv = exportPaymentsToCsv(currentPayments);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payments_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    statusElement.textContent = 'Payments exported successfully.';
    statusElement.className = 'records-status ok';
  });

  tableContainer.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === 'update-status') {
      const statusSelect = tableContainer.querySelector(`.status-select[data-id="${id}"]`);
      const newStatus = statusSelect.value;

      if (!confirm(`Update payment status to ${newStatus}?`)) return;

      button.disabled = true;
      button.textContent = 'Updating...';

      try {
        await updatePaymentStatus(id, newStatus);
        statusElement.textContent = 'Payment status updated successfully.';
        statusElement.className = 'records-status ok';
        load();
      } catch (error) {
        statusElement.textContent = error.message || 'Failed to update payment status.';
        statusElement.className = 'records-status err';
        button.disabled = false;
        button.textContent = 'Update';
      }
    }

    if (action === 'refund') {
      if (!confirm('Are you sure you want to refund this payment? This action cannot be undone.')) return;

      button.disabled = true;
      button.textContent = 'Processing...';

      try {
        await processRefund(id);
        statusElement.textContent = 'Payment refunded successfully.';
        statusElement.className = 'records-status ok';
        load();
      } catch (error) {
        statusElement.textContent = error.message || 'Failed to process refund.';
        statusElement.className = 'records-status err';
        button.disabled = false;
        button.textContent = 'Refund';
      }
    }
  });

  load();
}
