import { withDb } from '../db.mjs';
import { jsonResponse } from '../_shared.mjs';
import { requireAdmin } from '../_auth.mjs';

const VALID_ROLES = ['secretariat', 'council'];

function parseLimit(value) {
  return Math.min(Math.max(Number(value) || 25, 1), 250);
}

function parseOffset(value) {
  return Math.max(Number(value) || 0, 0);
}

async function getAuditLogs(role, actionType, startDate, endDate, limit, offset) {
  const params = [];
  const clauses = [];

  if (role && VALID_ROLES.includes(role)) {
    clauses.push('admin_role = $1');
    params.push(role);
  }

  if (actionType) {
    clauses.push('action_type ILIKE $' + (params.length + 1));
    params.push(`%${actionType}%`);
  }

  if (startDate) {
    clauses.push('created_at >= $' + (params.length + 1));
    params.push(startDate);
  }

  if (endDate) {
    clauses.push('created_at <= $' + (params.length + 1));
    params.push(endDate);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `
    SELECT id, admin_role, action_type, entity_type, entity_id, details, ip_address, user_agent, created_at
    FROM audit_log
    ${where}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const result = await withDb((client) => client.query(sql, [...params, limit, offset]));
  return result.rows;
}

export default async function handler(request) {
  const auth = requireAdmin(request, ['secretariat', 'council']);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  const url = new URL(request.url);
  const role = VALID_ROLES.includes(url.searchParams.get('role')) ? url.searchParams.get('role') : null;
  const actionType = url.searchParams.get('actionType');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const limit = parseLimit(url.searchParams.get('limit'));
  const offset = parseOffset(url.searchParams.get('offset'));

  if (request.method === 'GET') {
    const items = await getAuditLogs(role, actionType, startDate, endDate, limit, offset);
    const format = url.searchParams.get('format');

    if (format === 'csv') {
      if (!items.length) return new Response('id\n', { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="audit-log.csv"' } });

      const columns = Object.keys(items[0]);
      const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
      const header = columns.join(',');
      const lines = items.map((row) => columns.map((key) => escape(row[key])).join(','));
      return new Response([header, ...lines].join('\n'), {
        status: 200,
        headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="audit-log.csv"' },
      });
    }

    return jsonResponse({ ok: true, items, count: items.length, role: auth.role });
  }

  return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
}
