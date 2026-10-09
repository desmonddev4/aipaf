import assert from 'node:assert/strict';
import test from 'node:test';

import { buildHealthStatus } from '../src/server/handlers/api/health.mjs';

test('health status reports service readiness and database availability', () => {
  const status = buildHealthStatus({
    uptime: 12.5,
    database: true,
    configured: true,
  });

  assert.equal(status.ok, true);
  assert.equal(status.database, true);
  assert.equal(status.uptimeSeconds, 12.5);
});

test('health status reports an unhealthy service when the database is unavailable', () => {
  const status = buildHealthStatus({
    uptime: 0,
    database: false,
    configured: true,
  });

  assert.equal(status.ok, false);
  assert.equal(status.database, false);
  assert.equal(status.uptimeSeconds, 0);
});
