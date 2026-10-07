import { withDb } from '../db.mjs';
import { jsonResponse } from '../_shared.mjs';
import { requireAdmin } from '../_auth.mjs';

const TABLES = {
  contact: 'contact_messages',
  membership: 'membership_interests',
};
const SELECT_COLUMNS = {
  contact: 'id, name, email, topic, message, elapsed_ms, page, email_status, handled_at, created_at',
  membership: 'id, name, email, organisation, country, registering_as, area_of_practice, message, elapsed_ms, page, email_status, handled_at, created_at',
};

function sanitizeTable(value) {
  return TABLES[value] || null;
}

function formatCsv(rows, table) {
  if (!rows.length) return 'id\n';
  const columns = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const header = columns.join(',');
  const lines = rows.map((row) => columns.map((key) => escape(row[key])).join(','));
  return [header, ...lines].join('\n');
}

async function getSubmissions(table, query) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 250);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const status = query.status && ['pending', 'sent', 'failed'].includes(query.status) ? query.status : null;
  const search = String(query.search || '').trim();
  const where = [];
  const params = [];

  if (status) {
    where.push('email_status = $1');
    params.push(status);
  }

  if (search) {
    const keyword = `%${search}%`;
    where.push('(name ILIKE $1 OR email ILIKE $1 OR message ILIKE $1 OR country ILIKE $1 OR topic ILIKE $1 OR registering_as ILIKE $1)');
    params.push(keyword);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT ${SELECT_COLUMNS[table]} FROM ${table} ${whereSql} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const result = await withDb(async (client) => client.query(sql, [...params, limit, offset]));
  return result.rows;
}

async function markHandled(table, id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return { ok: false, message: 'Invalid submission identifier.', status: 400 };
  }

  await withDb(async (client) => {
    await client.query(`UPDATE ${table} SET handled_at = NOW(), email_status = 'sent', updated_at = NOW() WHERE id = $1;`, [numericId]);
  });
  return { ok: true };
}

export default async function handler(request) {
  const auth = requireAdmin(request);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
  }

  const url = new URL(request.url);
  const table = sanitizeTable(url.searchParams.get('table'));
  if (!table) return jsonResponse({ ok: false, message: 'Invalid table.' }, 400);

  if (request.method === 'POST' && auth.role !== 'secretariat') {
    return jsonResponse({ ok: false, message: 'Secretariat access is required to update submissions.' }, 403);
  }

  if (request.method === 'GET') {
    const rows = await getSubmissions(table, Object.fromEntries(url.searchParams));
    const format = url.searchParams.get('format');
    if (format === 'csv') {
      return new Response(formatCsv(rows, table), {
        status: 200,
        headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${table}.csv"`, 'cache-control': 'no-store' },
      });
    }
    return jsonResponse({ ok: true, items: rows, count: rows.length, role: auth.role });
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (body.action !== 'mark-handled') {
      return jsonResponse({ ok: false, message: 'Unsupported admin action.' }, 400);
    }

    const result = await markHandled(table, body.id);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Submission marked as handled.', role: auth.role });
  }
}
