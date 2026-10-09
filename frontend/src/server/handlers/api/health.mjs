import { pingDatabase } from './db.mjs';
import { jsonResponse } from './_shared.mjs';

export function buildHealthStatus({ uptime = 0, database = false, configured = false } = {}) {
  return {
    ok: Boolean(configured && database),
    status: configured && database ? 'ok' : 'degraded',
    configured,
    database,
    uptimeSeconds: Number(uptime) || 0,
    timestamp: new Date().toISOString(),
  };
}

export default async function handler(request) {
  if (request.method !== 'GET') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);

  const configured = Boolean(process.env.DATABASE_URL);
  const database = configured ? await pingDatabase() : false;
  const health = buildHealthStatus({
    uptime: process.uptime(),
    database,
    configured,
  });

  return jsonResponse(health, health.ok ? 200 : 503);
}
