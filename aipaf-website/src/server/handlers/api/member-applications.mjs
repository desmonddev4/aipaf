import { withDb } from './db.mjs';
import { jsonResponse } from './_shared.mjs';
import { requireAdmin } from './_auth.mjs';
import { parseSessionCookie, verifySignedSession } from './member-auth.mjs';

const VALID_GRADES = ['student', 'affiliate', 'associate', 'member', 'fellow'];
const VALID_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn'];

function getSessionFromRequest(request) {
  const cookie = parseSessionCookie(request.headers.get('cookie') || '');
  return cookie ? verifySignedSession(cookie) : null;
}

function normalizeApplication(input = {}) {
  const grade = String(input.grade || '').trim().toLowerCase();
  const submissionData = input.submissionData && typeof input.submissionData === 'object' ? input.submissionData : {};

  if (!VALID_GRADES.includes(grade)) {
    return { ok: false, message: 'Invalid membership grade.' };
  }

  return { ok: true, grade, submissionData };
}

export default async function handler(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Member actions
  if (request.method === 'POST' && action === 'create') {
    const session = getSessionFromRequest(request);
    if (!session?.memberId) return jsonResponse({ ok: false, message: 'Authentication required.' }, 401);

    const body = await request.json().catch(() => ({}));
    const normalized = normalizeApplication(body);
    if (!normalized.ok) return jsonResponse({ ok: false, message: normalized.message }, 400);

    try {
      const result = await withDb(async (client) => {
        // Check for existing draft or submitted application
        const existing = await client.query(
          `SELECT id, status FROM member_applications
           WHERE member_id = $1 AND status IN ('draft', 'submitted', 'under_review')
           ORDER BY created_at DESC LIMIT 1`,
          [session.memberId]
        );

        if (existing.rowCount && existing.rows[0].status !== 'draft') {
          return { ok: false, message: 'You already have an active application.', status: 409 };
        }

        if (existing.rowCount && existing.rows[0].status === 'draft') {
          // Update existing draft
          const updated = await client.query(
            `UPDATE member_applications
             SET grade = $1, submission_data = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING id, grade, status, submission_data, created_at`,
            [normalized.grade, normalized.submissionData, existing.rows[0].id]
          );
          return { ok: true, application: updated.rows[0] };
        }

        // Create new application
        const created = await client.query(
          `INSERT INTO member_applications (member_id, grade, submission_data, status)
           VALUES ($1, $2, $3, 'draft')
           RETURNING id, grade, status, submission_data, created_at`,
          [session.memberId, normalized.grade, normalized.submissionData]
        );
        return { ok: true, application: created.rows[0] };
      });

      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
      return jsonResponse({ ok: true, application: result.application });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to save application.', status: 503 });
    }
  }

  if (request.method === 'POST' && action === 'submit') {
    const session = getSessionFromRequest(request);
    if (!session?.memberId) return jsonResponse({ ok: false, message: 'Authentication required.' }, 401);

    try {
      const result = await withDb(async (client) => {
        const application = await client.query(
          `SELECT id, status FROM member_applications
           WHERE member_id = $1 AND status = 'draft'
           ORDER BY created_at DESC LIMIT 1`,
          [session.memberId]
        );

        if (!application.rowCount) {
          return { ok: false, message: 'No draft application found.', status: 404 };
        }

        const updated = await client.query(
          `UPDATE member_applications
           SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
           WHERE id = $1
           RETURNING id, grade, status, submitted_at`,
          [application.rows[0].id]
        );
        return { ok: true, application: updated.rows[0] };
      });

      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
      return jsonResponse({ ok: true, application: result.application });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to submit application.', status: 503 });
    }
  }

  if (request.method === 'GET' && action === 'my-applications') {
    const session = getSessionFromRequest(request);
    if (!session?.memberId) return jsonResponse({ ok: false, message: 'Authentication required.' }, 401);

    try {
      const rows = await withDb(async (client) => client.query(
        `SELECT id, grade, status, submission_data, reviewer_notes, submitted_at, reviewed_at, created_at
         FROM member_applications
         WHERE member_id = $1
         ORDER BY created_at DESC`,
        [session.memberId]
      ));
      return jsonResponse({ ok: true, items: rows.rows });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to load applications.', status: 503 });
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
        clauses.push('ma.status = $1');
        params.push(status);
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const sql = `
        SELECT ma.id, ma.member_id, m.email, m.first_name, m.last_name,
               ma.grade, ma.status, ma.submission_data, ma.reviewer_notes,
               ma.submitted_at, ma.reviewed_at, ma.created_at
        FROM member_applications ma
        JOIN members m ON m.id = ma.member_id
        ${where}
        ORDER BY ma.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const rows = await withDb(async (client) => client.query(sql, [...params, limit, offset]));
      return jsonResponse({ ok: true, items: rows.rows, count: rows.rows.length, role: auth.role });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to load applications.', status: 503 });
    }
  }

  if (request.method === 'POST' && action === 'review') {
    if (auth.role !== 'secretariat') {
      return jsonResponse({ ok: false, message: 'Secretariat access is required to review applications.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '').trim();
    const status = String(body.status || '').trim().toLowerCase();
    const notes = String(body.notes || '').trim();

    if (!id) return jsonResponse({ ok: false, message: 'Application ID is required.' }, 400);
    if (!['approved', 'rejected'].includes(status)) {
      return jsonResponse({ ok: false, message: 'Status must be approved or rejected.' }, 400);
    }

    try {
      const result = await withDb(async (client) => {
        const updated = await client.query(
          `UPDATE member_applications
           SET status = $1, reviewer_notes = $2, reviewed_at = NOW(), updated_at = NOW()
           WHERE id = $3
           RETURNING id, member_id, grade, status`,
          [status, notes || null, id]
        );

        if (!updated.rowCount) {
          return { ok: false, message: 'Application not found.', status: 404 };
        }

        // If approved, update member's membership grade
        if (status === 'approved') {
          await client.query(
            `UPDATE members
             SET membership_grade = $1, membership_status = 'active', updated_at = NOW()
             WHERE id = $2`,
            [updated.rows[0].grade, updated.rows[0].member_id]
          );
        }

        return { ok: true, application: updated.rows[0] };
      });

      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
      return jsonResponse({ ok: true, application: result.application });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to review application.', status: 503 });
    }
  }

  return jsonResponse({ ok: false, message: 'Unsupported action or method.' }, 400);
}
