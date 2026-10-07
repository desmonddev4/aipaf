import { withDb } from '../db.mjs';
import { jsonResponse } from '../_shared.mjs';
import { requireAdmin } from '../_auth.mjs';

const VALID_EXAM_STATUSES = ['pass', 'fail', 'pending', 'withheld'];
const VALID_CPD_STATUSES = ['approved', 'rejected', 'pending', 'withdrawn'];

export function normalizeExaminationResult(input = {}) {
  const id = String(input.id || '').trim();
  const status = String(input.status || '').trim().toLowerCase();
  const rawScore = String(input.score ?? '').trim();

  if (!id) return { ok: false, message: 'Examination registration is required.' };
  if (!VALID_EXAM_STATUSES.includes(status)) return { ok: false, message: 'Unsupported examination result status.' };
  if (!rawScore) return { ok: false, message: 'Examination score is required.' };

  const score = Number(rawScore);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return { ok: false, message: 'Examination score must be between 0 and 100.' };
  }

  return { ok: true, id, score, status };
}

export function normalizeCpdDecision(input = {}) {
  const id = String(input.id || '').trim();
  const status = String(input.status || '').trim().toLowerCase();

  if (!id) return { ok: false, message: 'CPD record is required.' };
  if (!VALID_CPD_STATUSES.includes(status)) return { ok: false, message: 'Unsupported CPD status.' };

  return { ok: true, id, status };
}

export default async function handler(request) {
  const auth = requireAdmin(request);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);
  if (auth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required.' }, 403);

  const url = new URL(request.url);
  if (request.method === 'GET') {
    const params = Object.fromEntries(url.searchParams);
    const type = params.type === 'cpd' ? 'cpd' : 'examination';
    const rows = await withDb(async (client) => {
      if (type === 'cpd') {
        return client.query(
          `SELECT c.id, c.member_id, m.email, c.title, c.category, c.hours, c.status, c.created_at
           FROM cpd_records c
           JOIN members m ON m.id = c.member_id
           ORDER BY c.created_at DESC LIMIT $1`,
          [Math.min(Math.max(Number(params.limit) || 100, 1), 250)],
        );
      }

      return client.query(
        `SELECT er.id, er.member_id, m.email, e.name AS examination_name, e.code, er.status, er.result_score, er.result_status, er.registered_at
         FROM examination_registrations er
         JOIN members m ON m.id = er.member_id
         JOIN examinations e ON e.id = er.examination_id
         ORDER BY er.registered_at DESC LIMIT $1`,
        [Math.min(Math.max(Number(params.limit) || 100, 1), 250)],
      );
    });

    return jsonResponse({ ok: true, items: rows.rows });
  }

  if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);

  const body = await request.json().catch(() => ({}));
  if (body.action === 'update-examination-result') {
    const normalized = normalizeExaminationResult(body);
    if (!normalized.ok) return jsonResponse({ ok: false, message: normalized.message }, 400);

    const row = await withDb(async (client) => client.query(
      `UPDATE examination_registrations
       SET result_score = $1, result_status = $2, status = CASE WHEN $2 = 'pass' THEN 'completed' WHEN $2 = 'fail' THEN 'completed' ELSE status END, updated_at = NOW()
       WHERE id = $3
       RETURNING id, result_score, result_status, status`,
      [normalized.score, normalized.status, normalized.id],
    ));

    if (!row.rowCount) return jsonResponse({ ok: false, message: 'Examination registration not found.' }, 404);
    return jsonResponse({ ok: true, item: row.rows[0] });
  }

  if (body.action === 'update-cpd-status') {
    const normalized = normalizeCpdDecision(body);
    if (!normalized.ok) return jsonResponse({ ok: false, message: normalized.message }, 400);

    const row = await withDb(async (client) => client.query(
      `UPDATE cpd_records SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status`,
      [normalized.status, normalized.id],
    ));

    if (!row.rowCount) return jsonResponse({ ok: false, message: 'CPD record not found.' }, 404);
    return jsonResponse({ ok: true, item: row.rows[0] });
  }

  return jsonResponse({ ok: false, message: 'Unsupported admin action.' }, 400);
}
