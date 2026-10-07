import assert from 'node:assert/strict';
import test from 'node:test';

import { requireAdmin } from '../api/_auth.mjs';

test('member administration requires a configured Secretariat or Council role', () => {
  const previous = {
    secretariat: process.env.ADMIN_SECRETARIAT_KEY,
    council: process.env.ADMIN_COUNCIL_KEY,
  };
  process.env.ADMIN_SECRETARIAT_KEY = 'secretariat-test-key';
  process.env.ADMIN_COUNCIL_KEY = 'council-test-key';

  try {
    assert.equal(requireAdmin(new Request('https://example.com', {
      headers: { authorization: 'Bearer secretariat-test-key' },
    }), ['secretariat']).role, 'secretariat');
    assert.equal(requireAdmin(new Request('https://example.com', {
      headers: { authorization: 'Bearer council-test-key' },
    }), ['secretariat']).status, 401);
  } finally {
    if (previous.secretariat === undefined) delete process.env.ADMIN_SECRETARIAT_KEY;
    else process.env.ADMIN_SECRETARIAT_KEY = previous.secretariat;
    if (previous.council === undefined) delete process.env.ADMIN_COUNCIL_KEY;
    else process.env.ADMIN_COUNCIL_KEY = previous.council;
  }
});
