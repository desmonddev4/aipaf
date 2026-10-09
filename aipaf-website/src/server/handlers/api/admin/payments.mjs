import { withDb } from '../db.mjs';
import { jsonResponse } from '../_shared.mjs';
import { requireAdmin } from '../_auth.mjs';

const VALID_STATUSES = ['pending', 'authorized', 'paid', 'failed', 'refunded', 'cancelled'];
const VALID_PURPOSES = ['membership', 'examination', 'subscription', 'other'];
const VALID_PROVIDERS = ['manual', 'paystack', 'flutterwave'];

function parseLimit(value) {
  return Math.min(Math.max(Number(value) || 25, 1), 250);
}

function parseOffset(value) {
  return Math.max(Number(value) || 0, 0);
}

function sanitizeSearch(value) {
  return String(value || '').trim();
}

async function getPayments(search, status, purpose, provider, limit, offset) {
  const params = [];
  const clauses = [];

  if (search) {
    const term = `%${search}%`;
    clauses.push('(m.email ILIKE $1 OR p.provider_reference ILIKE $1)');
    params.push(term);
  }

  if (status && VALID_STATUSES.includes(status)) {
    clauses.push('p.status = $' + (params.length + 1));
    params.push(status);
  }

  if (purpose && VALID_PURPOSES.includes(purpose)) {
    clauses.push('p.purpose = $' + (params.length + 1));
    params.push(purpose);
  }

  if (provider && VALID_PROVIDERS.includes(provider)) {
    clauses.push('p.provider = $' + (params.length + 1));
    params.push(provider);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `
    SELECT p.id, p.member_id, p.provider, p.provider_reference, p.amount, p.currency,
           p.purpose, p.status, p.metadata, p.paid_at, p.created_at, p.updated_at,
           m.email, m.first_name, m.last_name
    FROM payments p
    LEFT JOIN members m ON m.id = p.member_id
    ${where}
    ORDER BY p.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const result = await withDb((client) => client.query(sql, [...params, limit, offset]));
  return result.rows;
}

async function updatePaymentStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    return { ok: false, message: 'Invalid payment status.', status: 400 };
  }

  const result = await withDb(async (client) => {
    const payment = await client.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (!payment.rowCount) {
      return { ok: false, message: 'Payment not found.', status: 404 };
    }

    const updated = await client.query(
      'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    return { ok: true, payment: updated.rows[0] };
  });

  return result;
}

async function processRefund(id) {
  const result = await withDb(async (client) => {
    const payment = await client.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (!payment.rowCount) {
      return { ok: false, message: 'Payment not found.', status: 404 };
    }

    if (payment.rows[0].status !== 'paid' && payment.rows[0].status !== 'authorized') {
      return { ok: false, message: 'Only paid or authorized payments can be refunded.', status: 400 };
    }

    const updated = await client.query(
      'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['refunded', id]
    );

    return { ok: true, payment: updated.rows[0] };
  });

  return result;
}

async function getMemberPayments(memberId, limit, offset) {
  const sql = `
    SELECT id, provider, provider_reference, amount, currency, purpose, status,
           metadata, paid_at, created_at, updated_at
    FROM payments
    WHERE member_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await withDb((client) => client.query(sql, [memberId, limit, offset]));
  return result.rows;
}

export default async function handler(request) {
  const auth = requireAdmin(request, ['secretariat', 'council']);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  const url = new URL(request.url);
  const search = sanitizeSearch(url.searchParams.get('search'));
  const status = VALID_STATUSES.includes(url.searchParams.get('status')) ? url.searchParams.get('status') : null;
  const purpose = VALID_PURPOSES.includes(url.searchParams.get('purpose')) ? url.searchParams.get('purpose') : null;
  const provider = VALID_PROVIDERS.includes(url.searchParams.get('provider')) ? url.searchParams.get('provider') : null;
  const limit = parseLimit(url.searchParams.get('limit'));
  const offset = parseOffset(url.searchParams.get('offset'));

  // List payments
  if (request.method === 'GET') {
    const memberId = url.searchParams.get('member_id');

    if (memberId) {
      // Get payments for a specific member
      const items = await getMemberPayments(memberId, limit, offset);
      return jsonResponse({ ok: true, items, count: items.length, role: auth.role });
    }

    // Get all payments with filters
    const items = await getPayments(search, status, purpose, provider, limit, offset);
    return jsonResponse({ ok: true, items, count: items.length, role: auth.role });
  }

  if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
  if (auth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required to update payments.' }, 403);

  const body = await request.json().catch(() => ({}));

  // Update payment status
  if (body.action === 'update-status') {
    const result = await updatePaymentStatus(body.id, body.status);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Payment status updated.', payment: result.payment, role: auth.role });
  }

  // Process refund
  if (body.action === 'refund') {
    const result = await processRefund(body.id);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Payment refunded.', payment: result.payment, role: auth.role });
  }

  return jsonResponse({ ok: false, message: 'Unsupported admin action.' }, 400);
}
