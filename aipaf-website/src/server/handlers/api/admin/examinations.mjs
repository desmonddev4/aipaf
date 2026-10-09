import { withDb } from '../db.mjs';
import { jsonResponse } from '../_shared.mjs';
import { requireAdmin } from '../_auth.mjs';

const VALID_STATUSES = ['draft', 'open', 'closed', 'archived'];

async function getExaminations(status, limit, offset) {
  const params = [];
  const clauses = [];

  if (status && VALID_STATUSES.includes(status)) {
    clauses.push('status = $1');
    params.push(status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `
    SELECT e.id, e.code, e.name, e.description, e.status, e.opens_at, e.closes_at, e.published_at, e.created_at, e.updated_at,
           COUNT(er.id) AS registration_count
    FROM examinations e
    LEFT JOIN examination_registrations er ON er.examination_id = e.id
    ${where}
    GROUP BY e.id
    ORDER BY e.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const result = await withDb((client) => client.query(sql, [...params, limit, offset]));
  return result.rows;
}

async function createExamination(data) {
  const { code, name, description, opens_at, closes_at } = data;

  if (!code || !name) {
    return { ok: false, message: 'Code and name are required.', status: 400 };
  }

  try {
    const result = await withDb(async (client) => {
      const existing = await client.query('SELECT id FROM examinations WHERE code = $1', [code]);
      if (existing.rowCount) {
        return { ok: false, message: 'Examination code already exists.', status: 400 };
      }

      const created = await client.query(
        `INSERT INTO examinations (code, name, description, opens_at, closes_at, status)
         VALUES ($1, $2, $3, $4, $5, 'draft')
         RETURNING *`,
        [code, name, description || null, opens_at || null, closes_at || null]
      );

      return { ok: true, examination: created.rows[0] };
    });

    return result;
  } catch (error) {
    console.error('Error creating examination:', error);
    return { ok: false, message: 'Failed to create examination.', status: 500 };
  }
}

async function updateExamination(id, data) {
  const { code, name, description, opens_at, closes_at, status } = data;

  if (!code || !name) {
    return { ok: false, message: 'Code and name are required.', status: 400 };
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return { ok: false, message: 'Invalid examination status.', status: 400 };
  }

  try {
    const result = await withDb(async (client) => {
      const existing = await client.query('SELECT id FROM examinations WHERE code = $1 AND id != $2', [code, id]);
      if (existing.rowCount) {
        return { ok: false, message: 'Examination code already exists.', status: 400 };
      }

      const updated = await client.query(
        `UPDATE examinations
         SET code = $1, name = $2, description = $3, opens_at = $4, closes_at = $5, status = $6,
             published_at = CASE WHEN $6 = 'open' AND published_at IS NULL THEN NOW() ELSE published_at END,
             updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [code, name, description || null, opens_at || null, closes_at || null, status || 'draft', id]
      );

      if (!updated.rowCount) {
        return { ok: false, message: 'Examination not found.', status: 404 };
      }

      return { ok: true, examination: updated.rows[0] };
    });

    return result;
  } catch (error) {
    console.error('Error updating examination:', error);
    return { ok: false, message: 'Failed to update examination.', status: 500 };
  }
}

async function deleteExamination(id) {
  try {
    const result = await withDb(async (client) => {
      const registrations = await client.query(
        'SELECT COUNT(*) AS count FROM examination_registrations WHERE examination_id = $1',
        [id]
      );

      if (parseInt(registrations.rows[0].count) > 0) {
        return { ok: false, message: 'Cannot delete examination with existing registrations.', status: 400 };
      }

      const deleted = await client.query('DELETE FROM examinations WHERE id = $1 RETURNING id', [id]);

      if (!deleted.rowCount) {
        return { ok: false, message: 'Examination not found.', status: 404 };
      }

      return { ok: true };
    });

    return result;
  } catch (error) {
    console.error('Error deleting examination:', error);
    return { ok: false, message: 'Failed to delete examination.', status: 500 };
  }
}

export default async function handler(request) {
  const auth = requireAdmin(request, ['secretariat', 'council']);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  const url = new URL(request.url);
  const status = VALID_STATUSES.includes(url.searchParams.get('status')) ? url.searchParams.get('status') : null;
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 250);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  // List examinations
  if (request.method === 'GET') {
    const items = await getExaminations(status, limit, offset);
    return jsonResponse({ ok: true, items, count: items.length, role: auth.role });
  }

  if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
  if (auth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required to manage examinations.' }, 403);

  const body = await request.json().catch(() => ({}));

  // Create examination
  if (body.action === 'create') {
    const result = await createExamination(body);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Examination created.', examination: result.examination, role: auth.role });
  }

  // Update examination
  if (body.action === 'update') {
    const result = await updateExamination(body.id, body);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Examination updated.', examination: result.examination, role: auth.role });
  }

  // Delete examination
  if (body.action === 'delete') {
    const result = await deleteExamination(body.id);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Examination deleted.', role: auth.role });
  }

  return jsonResponse({ ok: false, message: 'Unsupported admin action.' }, 400);
}
