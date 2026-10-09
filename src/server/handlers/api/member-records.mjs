import { createHmac, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';

import { withDb } from './db.mjs';
import { jsonResponse } from './_shared.mjs';
import { requireAdmin } from './_auth.mjs';
import { parseSessionCookie, verifySignedSession } from './member-auth.mjs';

const PAYMENT_PURPOSES = ['membership', 'examination', 'subscription', 'other'];
const PROVIDERS = ['paystack', 'flutterwave', 'manual'];
const CPD_CATEGORIES = ['education', 'practice', 'research', 'service', 'other'];

function getSessionFromRequest(request) {
  const cookie = parseSessionCookie(request.headers.get('cookie') || '');
  if (!cookie) return null;
  return verifySignedSession(cookie);
}

export function verifyPaymentWebhook(payload, signature, secret, provider = 'generic') {
  if (!payload || !signature || !secret) return false;
  const algorithm = provider === 'paystack' ? 'sha512' : 'sha256';
  const expected = createHmac(algorithm, secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function normalizePayment(input = {}) {
  const amount = Number(input.amount);
  const provider = String(input.provider || 'paystack').trim().toLowerCase();
  const currency = String(input.currency || 'GHS').trim().toUpperCase();
  const purpose = PAYMENT_PURPOSES.includes(input.purpose) ? input.purpose : 'other';
  const reference = String(input.reference || '').trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (!PROVIDERS.includes(provider)) {
    throw new Error('Unsupported payment provider.');
  }

  return {
    amount: Math.round(amount * 100) / 100,
    currency,
    purpose,
    provider,
    providerReference: reference || null,
  };
}

export function normalizeExaminationRegistration(input = {}) {
  const examinationId = String(input.examinationId || '').trim();
  const memberId = String(input.memberId || '').trim();
  const validUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  if (!validUuid(examinationId) || !validUuid(memberId)) {
    return { ok: false, message: 'A valid examination and member reference is required.' };
  }

  return { ok: true, examinationId, memberId };
}

export function normalizeExamination(input = {}) {
  const code = String(input.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const name = String(input.name || '').trim().slice(0, 180);
  const description = String(input.description || '').trim().slice(0, 2000);
  const status = ['draft', 'open', 'closed', 'archived'].includes(input.status) ? input.status : null;

  if (!code || !name) return { ok: false, message: 'Examination code and name are required.' };
  if (status === null) return { ok: false, message: 'Unsupported examination status.' };

  return { ok: true, code, name, description, status };
}

export function normalizeCpdStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (!['pending', 'approved', 'rejected', 'withdrawn'].includes(status)) {
    return { ok: false, message: 'Unsupported CPD status.' };
  }
  return { ok: true, status };
}

export function normalizeCpdRecord(input = {}) {
  const title = String(input.title || '').trim();
  const hours = Number(input.hours);
  const completionDate = String(input.completionDate || '').trim();
  const category = CPD_CATEGORIES.includes(input.category) ? input.category : 'other';

  if (!title || title.length > 180) return { ok: false, message: 'A valid CPD title is required.' };
  if (!Number.isFinite(hours) || hours <= 0) return { ok: false, message: 'CPD hours must be positive.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(completionDate)) return { ok: false, message: 'A valid completion date is required.' };

  return { ok: true, title, category, hours, completionDate };
}

export default async function handler(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (request.method === 'POST' && action === 'webhook') {
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature') || request.headers.get('x-webhook-signature') || '';
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || '';
    if (!secret) return jsonResponse({ ok: false, message: 'Webhook is not configured.' }, 503);
    if (!verifyPaymentWebhook(body, signature, secret, 'paystack')) return jsonResponse({ ok: false, message: 'Invalid webhook signature.' }, 401);

    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return jsonResponse({ ok: false, message: 'Invalid webhook payload.' }, 400);
    }

    const eventName = String(event.event || '').trim();
    const reference = String(event.data?.reference || '').trim();
    const status = String(event.data?.status || '').trim().toLowerCase();
    const provider = String(event.data?.gateway_response || '').toLowerCase().includes('paystack') ? 'paystack' : 'paystack';
    if (!reference || !['charge.success', 'charge.failed', 'charge.dispute', 'transfer.failed'].includes(eventName) || !['success', 'failed', 'abandoned'].includes(status)) {
      return jsonResponse({ ok: false, message: 'Unsupported webhook event.' }, 400);
    }

    try {
      const result = await withDb(async (client) => {
        const existing = await client.query(
          `SELECT id, status FROM payments WHERE provider_reference = $1 AND provider = $2`,
          [reference, String(event.provider || 'manual').trim().toLowerCase() || 'manual'],
        );
        if (!existing.rowCount) return { ok: false, message: 'Payment not found.', status: 404 };

        const row = existing.rows[0];
        if (row.status === 'paid' || row.status === 'failed' || row.status === 'refunded' || row.status === 'cancelled') {
          return { ok: true, payment: row, duplicate: true };
        }

        const nextStatus = status === 'success' ? 'paid' : 'cancelled';
        await client.query(
          `UPDATE payments
           SET status = $1,
               paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END,
               metadata = COALESCE(metadata, '{}'::jsonb) || $2,
               updated_at = NOW()
           WHERE id = $3`,
          [nextStatus, { event, webhook: { provider } }, row.id],
        );
        return { ok: true, payment: { ...row, status: nextStatus }, duplicate: false };
      });
      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
      return jsonResponse({ ok: true, payment: result.payment, duplicate: result.duplicate });
    } catch {
      return jsonResponse({ ok: false, message: 'Unable to reconcile payment.' }, 503);
    }
  }

  // Actions a signed-in member may use; each one re-checks the member session itself.
  const memberActions = new Set([
    'GET:examinations', 'GET:my-examinations', 'GET:my-cpd',
    'POST:checkout', 'POST:register-examination', 'POST:cpd',
  ]);
  const auth = requireAdmin(request);
  if (auth.status && !memberActions.has(`${request.method}:${action}`)) {
    return jsonResponse({ ok: false, message: auth.message }, auth.status);
  }

  if (request.method === 'GET' && action === 'payments') {
    if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);
    if (auth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required.' }, 403);
    const memberId = url.searchParams.get('memberId');
    const rows = await withDb(async (client) => client.query(
      `SELECT id, member_id, provider, provider_reference, amount, currency, purpose, status, paid_at, created_at
       FROM payments ${memberId ? 'WHERE member_id = $1' : ''}
       ORDER BY created_at DESC`,
      memberId ? [memberId] : [],
    ));
    return jsonResponse({ ok: true, items: rows.rows });
  }

  if (request.method === 'POST' && action === 'checkout') {
    const session = getSessionFromRequest(request);
    if (!session?.memberId) return jsonResponse({ ok: false, message: 'Authentication required.' }, 401);
    const body = await request.json().catch(() => ({}));
    try {
      const payment = normalizePayment({ ...body, provider: 'paystack' });
      const reference = randomUUID();
      const row = await withDb(async (client) => client.query(
        `INSERT INTO payments (member_id, provider, provider_reference, amount, currency, purpose, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
         RETURNING id, member_id, provider, provider_reference, amount, currency, purpose, status, paid_at, created_at`,
        [session.memberId, payment.provider, reference, payment.amount, payment.currency, payment.purpose, { provider: payment.provider, checkout: true }],
      ));

      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (!secret) return jsonResponse({ ok: true, payment: row.rows[0], checkout: { provider: payment.provider, reference, amount: payment.amount, currency: payment.currency, purpose: payment.purpose, authorizationUrl: null } });

      const callbackUrl = new URL('/member-profile', process.env.SITE_URL || 'http://localhost:3000');
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(payment.amount * 100),
          currency: payment.currency,
          email: body.email || '',
          reference,
          callback_url: callbackUrl.toString(),
          metadata: {
            memberId: session.memberId,
            purpose: payment.purpose,
            provider: payment.provider,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.data?.authorization_url) {
        return jsonResponse({ ok: false, message: result.message || 'Paystack checkout could not be initialized.' }, 502);
      }

      await withDb((client) => client.query(
        `UPDATE payments SET metadata = COALESCE(metadata, '{}'::jsonb) || $1 WHERE provider_reference = $2`,
        [{ paystackAuthorizationUrl: result.data.authorization_url }, reference],
      ));

      return jsonResponse({ ok: true, payment: row.rows[0], checkout: { provider: payment.provider, reference, amount: payment.amount, currency: payment.currency, purpose: payment.purpose, authorizationUrl: result.data.authorization_url } });
    } catch (error) {
      return jsonResponse({ ok: false, message: error.message }, 400);
    }
  }

  if (request.method === 'GET' && action === 'examinations') {
    if (auth.status && !getSessionFromRequest(request)?.memberId) return jsonResponse({ ok: false, message: 'Authentication required.' }, 401);
    const rows = await withDb(async (client) => client.query(
      `SELECT id, code, name, description, status, opens_at, closes_at, published_at, created_at
       FROM examinations ORDER BY published_at DESC NULLS LAST, created_at DESC`,
    ));
    return jsonResponse({ ok: true, items: rows.rows });
  }

  if (request.method === 'POST' && action === 'examinations') {
    const auth = requireAdmin(request);
    if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);
    if (auth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required.' }, 403);
    const body = await request.json().catch(() => ({}));
    const normalized = normalizeExamination(body);
    if (!normalized.ok) return jsonResponse({ ok: false, message: normalized.message }, 400);

    const row = await withDb(async (client) => client.query(
      `INSERT INTO examinations (code, name, description, status, opens_at, closes_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, code, name, description, status, opens_at, closes_at`,
      [normalized.code, normalized.name, normalized.description || null, normalized.status, body.opensAt || null, body.closesAt || null],
    ));
    return jsonResponse({ ok: true, examination: row.rows[0] });
  }

  if (request.method === 'POST' && action === 'register-examination') {
    const session = getSessionFromRequest(request);
    if (!session?.memberId) return jsonResponse({ ok: false, message: 'Authentication required.' }, 401);
    const body = await request.json().catch(() => ({}));
    const normalized = normalizeExaminationRegistration({ examinationId: body.examinationId, memberId: session.memberId });
    if (!normalized.ok) return jsonResponse({ ok: false, message: normalized.message }, 400);

    const row = await withDb(async (client) => {
      const examination = await client.query('SELECT id, status, closes_at FROM examinations WHERE id = $1', [normalized.examinationId]);
      if (!examination.rowCount) return { ok: false, message: 'Examination not found.', status: 404 };
      if (examination.rows[0].status !== 'open') return { ok: false, message: 'This examination is not accepting registrations.', status: 409 };

      const registration = await client.query(
        `INSERT INTO examination_registrations (examination_id, member_id, status)
         VALUES ($1, $2, 'registered')
         ON CONFLICT (examination_id, member_id) DO UPDATE SET updated_at = NOW()
         RETURNING id, status`,
        [normalized.examinationId, normalized.memberId],
      );
      return { ok: true, registration: registration.rows[0] };
    });
    if (!row.ok) return jsonResponse({ ok: false, message: row.message }, row.status);
    return jsonResponse({ ok: true, registration: row.registration });
  }

  if (request.method === 'GET' && action === 'my-examinations') {
    const session = getSessionFromRequest(request);
    if (!session?.memberId) return jsonResponse({ ok: false, message: 'Authentication required.' }, 401);
    const rows = await withDb(async (client) => client.query(
      `SELECT er.id, er.status, er.registered_at, er.result_score, er.result_status,
              e.id AS examination_id, e.code, e.name, e.status AS examination_status
       FROM examination_registrations er
       JOIN examinations e ON e.id = er.examination_id
       WHERE er.member_id = $1
       ORDER BY er.registered_at DESC`,
      [session.memberId],
    ));
    return jsonResponse({ ok: true, items: rows.rows });
  }

  if (request.method === 'POST' && action === 'cpd') {
    const session = getSessionFromRequest(request);
    if (!session?.memberId) return jsonResponse({ ok: false, message: 'Authentication required.' }, 401);
    const body = await request.json().catch(() => ({}));
    const normalized = normalizeCpdRecord(body);
    if (!normalized.ok) return jsonResponse({ ok: false, message: normalized.message }, 400);

    const row = await withDb(async (client) => client.query(
      `INSERT INTO cpd_records (member_id, category, title, provider, completion_date, hours, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id, status`,
      [session.memberId, normalized.category, normalized.title, body.provider || null, normalized.completionDate, normalized.hours],
    ));
    return jsonResponse({ ok: true, cpd: row.rows[0] });
  }

  if (request.method === 'GET' && action === 'my-cpd') {
    const session = getSessionFromRequest(request);
    if (!session?.memberId) return jsonResponse({ ok: false, message: 'Authentication required.' }, 401);
    const rows = await withDb(async (client) => client.query(
      `SELECT id, category, title, provider, completion_date, hours, status, created_at
       FROM cpd_records WHERE member_id = $1 ORDER BY completion_date DESC`,
      [session.memberId],
    ));
    return jsonResponse({ ok: true, items: rows.rows });
  }

  if (request.method === 'POST' && action === 'cpd-status') {
    const auth = requireAdmin(request);
    if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);
    if (auth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required.' }, 403);
    const body = await request.json().catch(() => ({}));
    const normalized = normalizeCpdStatus(body.status);
    if (!normalized.ok) return jsonResponse({ ok: false, message: normalized.message }, 400);
    const id = String(body.id || '').trim();
    if (!id) return jsonResponse({ ok: false, message: 'CPD record is required.' }, 400);

    const row = await withDb(async (client) => client.query(
      `UPDATE cpd_records SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status`,
      [normalized.status, id],
    ));
    if (!row.rowCount) return jsonResponse({ ok: false, message: 'CPD record not found.' }, 404);
    return jsonResponse({ ok: true, cpd: row.rows[0] });
  }

  return jsonResponse({ ok: false, message: 'Unsupported member record action.' }, 400);
}
