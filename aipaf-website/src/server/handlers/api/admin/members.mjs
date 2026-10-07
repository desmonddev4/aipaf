import { withDb } from '../db.mjs';
import { jsonResponse } from '../_shared.mjs';
import { requireAdmin } from '../_auth.mjs';

const ALLOWED_STATUSES = ['unverified', 'pending', 'active', 'suspended', 'expired'];
const SELECT_COLUMNS = 'id, email, first_name, last_name, country, organisation, designation, membership_grade, membership_status, role, email_verified, profile_public, last_login_at, created_at';

function parseLimit(value) {
  return Math.min(Math.max(Number(value) || 25, 1), 250);
}

function parseOffset(value) {
  return Math.max(Number(value) || 0, 0);
}

function sanitizeSearch(value) {
  return String(value || '').trim();
}

async function getMembers(search, status, limit, offset) {
  const params = [];
  const clauses = [];

  if (search) {
    const term = `%${search}%`;
    clauses.push('(email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR organisation ILIKE $1 OR designation ILIKE $1)');
    params.push(term);
  }

  if (status) {
    clauses.push('membership_status = $' + (params.length + 1));
    params.push(status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `SELECT ${SELECT_COLUMNS} FROM members ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  const result = await withDb((client) => client.query(sql, [...params, limit, offset]));
  return result.rows;
}

async function updateMemberStatus(id, status) {
  if (!ALLOWED_STATUSES.includes(status)) return { ok: false, message: 'Invalid membership status.', status: 400 };
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric <= 0) return { ok: false, message: 'Invalid member identifier.', status: 400 };

  const result = await withDb(async (client) => client.query(
    'UPDATE members SET membership_status = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
    [status, id],
  ));

  if (!result.rowCount) return { ok: false, message: 'Member not found.', status: 404 };
  return { ok: true };
}

export default async function handler(request) {
  const auth = requireAdmin(request, ['secretariat', 'council']);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  const url = new URL(request.url);
  const search = sanitizeSearch(url.searchParams.get('search'));
  const status = ALLOWED_STATUSES.includes(url.searchParams.get('status')) ? url.searchParams.get('status') : null;
  const limit = parseLimit(url.searchParams.get('limit'));
  const offset = parseOffset(url.searchParams.get('offset'));

  if (request.method === 'GET') {
    const items = await getMembers(search, status, limit, offset);
    return jsonResponse({ ok: true, items, count: items.length, role: auth.role });
  }

  if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
  if (auth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required to update members.' }, 403);

  const body = await request.json().catch(() => ({}));
  if (body.action !== 'update-status') return jsonResponse({ ok: false, message: 'Unsupported admin action.' }, 400);

  const result = await updateMemberStatus(body.id, body.status);
  if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
  return jsonResponse({ ok: true, message: 'Member status updated.', role: auth.role });
}
