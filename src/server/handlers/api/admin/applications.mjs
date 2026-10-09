import { withDb } from '../db.mjs';
import { jsonResponse } from '../_shared.mjs';
import { requireAdmin } from '../_auth.mjs';

const VALID_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn'];
const VALID_GRADES = ['student', 'affiliate', 'associate', 'member', 'fellow'];

function parseLimit(value) {
  return Math.min(Math.max(Number(value) || 25, 1), 250);
}

function parseOffset(value) {
  return Math.max(Number(value) || 0, 0);
}

async function getApplications(status, grade, limit, offset) {
  const params = [];
  const clauses = [];

  if (status && VALID_STATUSES.includes(status)) {
    clauses.push('status = $1');
    params.push(status);
  }

  if (grade && VALID_GRADES.includes(grade)) {
    clauses.push('grade = $' + (params.length + 1));
    params.push(grade);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `
    SELECT a.id, a.member_id, a.grade, a.status, a.submission_data, a.reviewer_notes, a.submitted_at, a.reviewed_at, a.created_at, a.updated_at,
           m.email, m.first_name, m.last_name
    FROM member_applications a
    LEFT JOIN members m ON m.id = a.member_id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const result = await withDb((client) => client.query(sql, [...params, limit, offset]));
  return result.rows;
}

async function updateApplicationStatus(id, status, notes) {
  if (!VALID_STATUSES.includes(status)) {
    return { ok: false, message: 'Invalid application status.', status: 400 };
  }

  const result = await withDb(async (client) => {
    const updated = await client.query(
      `UPDATE member_applications
       SET status = $1, reviewer_notes = $2, reviewed_at = CASE WHEN $1 IN ('approved', 'rejected') THEN NOW() ELSE reviewed_at END, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, notes || null, id]
    );

    if (!updated.rowCount) {
      return { ok: false, message: 'Application not found.', status: 404 };
    }

    // If approved, update member grade
    if (status === 'approved') {
      const app = updated.rows[0];
      if (app.member_id) {
        await client.query(
          'UPDATE members SET membership_grade = $1, membership_status = $2, updated_at = NOW() WHERE id = $3',
          [app.grade, 'active', app.member_id]
        );
      }
    }

    return { ok: true, application: updated.rows[0] };
  });

  return result;
}

async function getApplicationDetails(id) {
  const result = await withDb(async (client) => {
    const application = await client.query(
      `SELECT a.*, m.email, m.first_name, m.last_name, m.membership_grade AS current_grade
       FROM member_applications a
       LEFT JOIN members m ON m.id = a.member_id
       WHERE a.id = $1`,
      [id]
    );

    if (!application.rowCount) {
      return { ok: false, message: 'Application not found.', status: 404 };
    }

    return { ok: true, application: application.rows[0] };
  });

  return result;
}

export default async function handler(request) {
  const auth = requireAdmin(request, ['secretariat', 'council']);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  const url = new URL(request.url);
  const status = VALID_STATUSES.includes(url.searchParams.get('status')) ? url.searchParams.get('status') : null;
  const grade = VALID_GRADES.includes(url.searchParams.get('grade')) ? url.searchParams.get('grade') : null;
  const limit = parseLimit(url.searchParams.get('limit'));
  const offset = parseOffset(url.searchParams.get('offset'));

  // List applications
  if (request.method === 'GET') {
    const applicationId = url.searchParams.get('id');
    if (applicationId) {
      const result = await getApplicationDetails(applicationId);
      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
      return jsonResponse({ ok: true, application: result.application, role: auth.role });
    }

    const items = await getApplications(status, grade, limit, offset);
    const format = url.searchParams.get('format');

    if (format === 'csv') {
      if (!items.length) return new Response('id\n', { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="applications.csv"' } });

      const columns = Object.keys(items[0]);
      const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
      const header = columns.join(',');
      const lines = items.map((row) => columns.map((key) => escape(row[key])).join(','));
      return new Response([header, ...lines].join('\n'), {
        status: 200,
        headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="applications.csv"' },
      });
    }

    return jsonResponse({ ok: true, items, count: items.length, role: auth.role });
  }

  if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
  if (auth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required to manage applications.' }, 403);

  const body = await request.json().catch(() => ({}));

  // Update application status
  if (body.action === 'update-status') {
    const result = await updateApplicationStatus(body.id, body.status, body.notes);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Application status updated.', application: result.application, role: auth.role });
  }

  return jsonResponse({ ok: false, message: 'Unsupported admin action.' }, 400);
}
