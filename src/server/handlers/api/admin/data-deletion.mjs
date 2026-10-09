import { withDb } from '../db.mjs';
import { jsonResponse } from '../_shared.mjs';
import { requireAdmin } from '../_auth.mjs';

const VALID_STATUSES = ['pending', 'processing', 'completed', 'rejected'];
const VALID_TYPES = ['contact_message', 'membership_interest', 'member_account'];

function parseLimit(value) {
  return Math.min(Math.max(Number(value) || 25, 1), 250);
}

function parseOffset(value) {
  return Math.max(Number(value) || 0, 0);
}

async function getDeletionRequests(status, type, limit, offset) {
  const params = [];
  const clauses = [];

  if (status && VALID_STATUSES.includes(status)) {
    clauses.push('status = $1');
    params.push(status);
  }

  if (type && VALID_TYPES.includes(type)) {
    clauses.push('request_type = $' + (params.length + 1));
    params.push(type);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `
    SELECT id, request_type, email, name, status, admin_notes, processed_at, created_at
    FROM data_deletion_requests
    ${where}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const result = await withDb((client) => client.query(sql, [...params, limit, offset]));
  return result.rows;
}

async function updateDeletionRequestStatus(id, status, adminNotes) {
  if (!VALID_STATUSES.includes(status)) {
    return { ok: false, message: 'Invalid status.', status: 400 };
  }

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return { ok: false, message: 'Invalid request identifier.', status: 400 };
  }

  const result = await withDb(async (client) => {
    const updated = await client.query(
      `UPDATE data_deletion_requests
       SET status = $1,
           admin_notes = COALESCE($2, admin_notes),
           processed_at = CASE WHEN $1 IN ('completed', 'rejected') THEN NOW() ELSE processed_at END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, adminNotes || null, numericId]
    );

    if (!updated.rowCount) {
      return { ok: false, message: 'Deletion request not found.', status: 404 };
    }

    return { ok: true, request: updated.rows[0] };
  });

  return result;
}

async function processDeletionRequest(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return { ok: false, message: 'Invalid request identifier.', status: 400 };
  }

  const result = await withDb(async (client) => {
    const request = await client.query(
      'SELECT * FROM data_deletion_requests WHERE id = $1',
      [numericId]
    );

    if (!request.rowCount) {
      return { ok: false, message: 'Deletion request not found.', status: 404 };
    }

    const req = request.rows[0];

    if (req.status !== 'pending') {
      return { ok: false, message: 'Request has already been processed.', status: 400 };
    }

    // Update status to processing
    await client.query(
      'UPDATE data_deletion_requests SET status = $1, updated_at = NOW() WHERE id = $2',
      ['processing', numericId]
    );

    // Perform deletion based on type
    let deleted = 0;
    if (req.request_type === 'contact_message') {
      const result = await client.query(
        'DELETE FROM contact_messages WHERE email = $1 RETURNING id',
        [req.email]
      );
      deleted = result.rowCount;
    } else if (req.request_type === 'membership_interest') {
      const result = await client.query(
        'DELETE FROM membership_interests WHERE email = $1 RETURNING id',
        [req.email]
      );
      deleted = result.rowCount;
    } else if (req.request_type === 'member_account') {
      const result = await client.query(
        'DELETE FROM members WHERE email = $1 RETURNING id',
        [req.email]
      );
      deleted = result.rowCount;
    }

    // Update status to completed
    await client.query(
      `UPDATE data_deletion_requests
       SET status = $1, processed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      ['completed', numericId]
    );

    return { ok: true, deleted };
  });

  return result;
}

export default async function handler(request) {
  const auth = requireAdmin(request, ['secretariat', 'council']);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  const url = new URL(request.url);
  const status = VALID_STATUSES.includes(url.searchParams.get('status')) ? url.searchParams.get('status') : null;
  const type = VALID_TYPES.includes(url.searchParams.get('type')) ? url.searchParams.get('type') : null;
  const limit = parseLimit(url.searchParams.get('limit'));
  const offset = parseOffset(url.searchParams.get('offset'));

  if (request.method === 'GET') {
    const items = await getDeletionRequests(status, type, limit, offset);
    const format = url.searchParams.get('format');

    if (format === 'csv') {
      if (!items.length) return new Response('id\n', { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="data-deletion-requests.csv"' } });

      const columns = Object.keys(items[0]);
      const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
      const header = columns.join(',');
      const lines = items.map((row) => columns.map((key) => escape(row[key])).join(','));
      return new Response([header, ...lines].join('\n'), {
        status: 200,
        headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="data-deletion-requests.csv"' },
      });
    }

    return jsonResponse({ ok: true, items, count: items.length, role: auth.role });
  }

  if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
  if (auth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required to process deletion requests.' }, 403);

  const body = await request.json().catch(() => ({}));

  // Update request status
  if (body.action === 'update-status') {
    const result = await updateDeletionRequestStatus(body.id, body.status, body.adminNotes);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Deletion request updated.', request: result.request, role: auth.role });
  }

  // Process deletion request
  if (body.action === 'process') {
    const result = await processDeletionRequest(body.id);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: `Deleted ${result.deleted} record(s).`, deleted: result.deleted, role: auth.role });
  }

  return jsonResponse({ ok: false, message: 'Unsupported admin action.' }, 400);
}
