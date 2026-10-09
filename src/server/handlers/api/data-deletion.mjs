import { withDb } from './db.mjs';
import { jsonResponse } from './_shared.mjs';
import { requireAdmin } from './_auth.mjs';
import { parseSessionCookie, verifySignedSession } from './member-auth.mjs';

const VALID_REQUEST_TYPES = ['contact_message', 'membership_interest', 'member_account'];
const VALID_STATUSES = ['pending', 'processing', 'completed', 'rejected'];

function getSessionFromRequest(request) {
  const cookie = parseSessionCookie(request.headers.get('cookie') || '');
  return cookie ? verifySignedSession(cookie) : null;
}

function normalizeDeletionRequest(input = {}) {
  const requestType = String(input.requestType || '').trim().toLowerCase();
  const email = String(input.email || '').trim().toLowerCase();
  const referenceId = String(input.referenceId || '').trim();

  if (!VALID_REQUEST_TYPES.includes(requestType)) {
    return { ok: false, message: 'Invalid request type.' };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, message: 'A valid email address is required.' };
  }

  if (requestType === 'contact_message' || requestType === 'membership_interest') {
    if (!referenceId) {
      return { ok: false, message: 'Reference ID is required for this request type.' };
    }
  }

  return { ok: true, requestType, email, referenceId };
}

export default async function handler(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Public/member action: request deletion
  if (request.method === 'POST' && action === 'request') {
    const body = await request.json().catch(() => ({}));
    const normalized = normalizeDeletionRequest(body);
    if (!normalized.ok) return jsonResponse({ ok: false, message: normalized.message }, 400);

    try {
      const result = await withDb(async (client) => {
        // Verify the reference exists
        if (normalized.requestType === 'contact_message') {
          const exists = await client.query(
            'SELECT id FROM contact_messages WHERE id = $1 AND email = $2',
            [normalized.referenceId, normalized.email]
          );
          if (!exists.rowCount) {
            return { ok: false, message: 'Contact message not found or email does not match.', status: 404 };
          }
        } else if (normalized.requestType === 'membership_interest') {
          const exists = await client.query(
            'SELECT id FROM membership_interests WHERE id = $1 AND email = $2',
            [normalized.referenceId, normalized.email]
          );
          if (!exists.rowCount) {
            return { ok: false, message: 'Membership interest not found or email does not match.', status: 404 };
          }
        } else if (normalized.requestType === 'member_account') {
          const exists = await client.query(
            'SELECT id FROM members WHERE email = $1',
            [normalized.email]
          );
          if (!exists.rowCount) {
            return { ok: false, message: 'Member account not found.', status: 404 };
          }
        }

        // Create deletion request
        const created = await client.query(
          `INSERT INTO data_deletion_requests (email, request_type, reference_id, status)
           VALUES ($1, $2, $3, 'pending')
           RETURNING id, email, request_type, reference_id, status, created_at`,
          [normalized.email, normalized.requestType, normalized.referenceId || null]
        );

        return { ok: true, request: created.rows[0] };
      });

      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
      return jsonResponse({ ok: true, message: 'Deletion request submitted. The Secretariat will review your request.', request: result.request });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to submit deletion request.', status: 503 });
    }
  }

  // Admin actions
  const auth = requireAdmin(request);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  if (request.method === 'GET' && action === 'list') {
    const status = url.searchParams.get('status');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 250);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

    try {
      const params = [];
      const clauses = [];

      if (status && VALID_STATUSES.includes(status)) {
        clauses.push('status = $1');
        params.push(status);
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const sql = `
        SELECT id, email, request_type, reference_id, status, notes, processed_at, created_at
        FROM data_deletion_requests
        ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const rows = await withDb(async (client) => client.query(sql, [...params, limit, offset]));
      return jsonResponse({ ok: true, items: rows.rows, count: rows.rows.length, role: auth.role });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to load deletion requests.', status: 503 });
    }
  }

  if (request.method === 'POST' && action === 'process') {
    if (auth.role !== 'secretariat') {
      return jsonResponse({ ok: false, message: 'Secretariat access is required to process deletion requests.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '').trim();
    const status = String(body.status || '').trim().toLowerCase();
    const notes = String(body.notes || '').trim();

    if (!id) return jsonResponse({ ok: false, message: 'Request ID is required.' }, 400);
    if (!['completed', 'rejected'].includes(status)) {
      return jsonResponse({ ok: false, message: 'Status must be completed or rejected.' }, 400);
    }

    try {
      const result = await withDb(async (client) => {
        // Get the deletion request
        const requestRecord = await client.query(
          'SELECT * FROM data_deletion_requests WHERE id = $1',
          [id]
        );

        if (!requestRecord.rowCount) {
          return { ok: false, message: 'Deletion request not found.', status: 404 };
        }

        const req = requestRecord.rows[0];

        if (status === 'completed') {
          // Perform the actual deletion
          if (req.request_type === 'contact_message') {
            await client.query('DELETE FROM contact_messages WHERE id = $1', [req.reference_id]);
          } else if (req.request_type === 'membership_interest') {
            await client.query('DELETE FROM membership_interests WHERE id = $1', [req.reference_id]);
          } else if (req.request_type === 'member_account') {
            // Delete member and all related data (cascade should handle most)
            await client.query('DELETE FROM members WHERE email = $1', [req.email]);
          }
        }

        // Update request status
        const updated = await client.query(
          `UPDATE data_deletion_requests
           SET status = $1, notes = $2, processed_at = NOW(), updated_at = NOW()
           WHERE id = $3
           RETURNING id, email, request_type, status`,
          [status, notes || null, id]
        );

        return { ok: true, request: updated.rows[0] };
      });

      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
      return jsonResponse({ ok: true, request: result.request });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to process deletion request.', status: 503 });
    }
  }

  return jsonResponse({ ok: false, message: 'Unsupported action or method.' }, 400);
}
