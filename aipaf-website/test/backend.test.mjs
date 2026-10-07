import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildSubmission,
  checkSpamSignals,
  createRateLimiter,
  getValidationError,
} from '../src/server/handlers/api/_shared.mjs';
import { requireAdmin } from '../src/server/handlers/api/_auth.mjs';
import { createAdminSession } from '../src/server/handlers/api/admin/session.mjs';

const validContact = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  topic: 'Institutional partnership',
  message: 'Hello from the test suite.',
  _elapsedMs: 5000,
  _page: '/contact',
  consent: true,
};

test('valid contact submissions pass server-side validation', () => {
  assert.equal(getValidationError('contact', validContact), null);
  assert.deepEqual(buildSubmission('contact', validContact), {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    topic: 'Institutional partnership',
    message: 'Hello from the test suite.',
    _elapsedMs: 5000,
    _page: '/contact',
    consent: true,
  });
});

test('invalid email and empty fields fail validation', () => {
  const error = getValidationError('contact', {
    ...validContact,
    email: 'not-an-email',
    message: '',
  });

  assert.match(error.message, /valid email/i);
  assert.equal(error.status, 400);
});

test('contact submissions require explicit consent', () => {
  const error = getValidationError('contact', {
    ...validContact,
    consent: false,
  });

  assert.match(error.message, /consent/i);
  assert.equal(error.status, 400);
});

test('membership submissions require the expected fields', () => {
  const error = getValidationError('membership', {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    country: 'Ghana',
    registering_as: 'An individual professional',
    area_of_practice: 'Project assurance',
    message: 'Interested in joining.',
    _elapsedMs: 5000,
    _page: '/membership',
    consent: true,
  });

  assert.equal(error, null);
});

test('membership submissions require explicit consent', () => {
  const error = getValidationError('membership', {
    ...validContact,
    country: 'Ghana',
    registering_as: 'An individual professional',
    area_of_practice: 'Project assurance',
    message: 'Interested in joining.',
    _elapsedMs: 5000,
    _page: '/membership',
    consent: false,
  });

  assert.match(error.message, /consent/i);
  assert.equal(error.status, 400);
});

test('spam signals are rejected with a clear response', () => {
  const error = checkSpamSignals({ website: 'filled', _elapsedMs: 1000, ip: '203.0.113.10' });
  assert.equal(error.status, 403);
  assert.match(error.message, /honeypot|too quickly/i);
});

test('rate limiter allows a small burst and then blocks excess requests', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });

  assert.equal(limiter('203.0.113.20'), true);
  assert.equal(limiter('203.0.113.20'), true);
  assert.equal(limiter('203.0.113.20'), false);
});

test('rate limiter keeps different IP addresses independent', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

  assert.equal(limiter('203.0.113.30'), true);
  assert.equal(limiter('203.0.113.31'), true);
  assert.equal(limiter('203.0.113.31'), false);
});

test('admin auth recognizes configured roles and rejects unknown keys', { concurrency: false }, () => {
  const previous = {
    secretariat: process.env.ADMIN_SECRETARIAT_KEY,
    council: process.env.ADMIN_COUNCIL_KEY,
  };

  process.env.ADMIN_SECRETARIAT_KEY = 'secretariat-test-key';
  process.env.ADMIN_COUNCIL_KEY = 'council-test-key';

  try {
    assert.deepEqual(requireAdmin(new Request('https://example.com', {
      headers: { authorization: 'Bearer secretariat-test-key' },
    })).role, 'secretariat');
    assert.deepEqual(requireAdmin(new Request('https://example.com', {
      headers: { authorization: 'Bearer council-test-key' },
    })).role, 'council');
    assert.equal(requireAdmin(new Request('https://example.com', {
      headers: { authorization: 'Bearer wrong-key' },
    })).status, 401);
  } finally {
    if (previous.secretariat === undefined) delete process.env.ADMIN_SECRETARIAT_KEY;
    else process.env.ADMIN_SECRETARIAT_KEY = previous.secretariat;
    if (previous.council === undefined) delete process.env.ADMIN_COUNCIL_KEY;
    else process.env.ADMIN_COUNCIL_KEY = previous.council;
  }
});

test('admin cookie sessions are authenticated without exposing the key to JavaScript', () => {
  process.env.ADMIN_SECRETARIAT_KEY = 'secretariat-test-key';

  const cookie = createAdminSession('secretariat-test-key');
  const auth = requireAdmin(new Request('https://example.com', {
    headers: { cookie },
  }));

  assert.deepEqual(auth.role, 'secretariat');
});

test('admin page gate rejects unauthenticated requests', async () => {
  const handler = (await import('../src/server/handlers/api/admin/page.mjs')).default;
  const response = await handler(new Request('https://example.com/admin'));
  assert.equal(response.status, 401);
  assert.match(await response.text(), /Authentication required/);
});

test('council cannot mark submissions handled', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    process.env.ADMIN_SECRETARIAT_KEY = 'secretariat-test-key';
    process.env.ADMIN_COUNCIL_KEY = 'council-test-key';
    const handler = (await import('./src/server/handlers/api/admin/submissions.mjs')).default;
    const response = await handler(new Request('https://example.com/api/admin/submissions?table=contact', {
      method: 'POST',
      headers: {
        authorization: 'Bearer council-test-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'mark-handled', id: 1 }),
    }));
    const body = await response.json();
    console.log(JSON.stringify({ status: response.status, message: body.message }));
  `], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"status":403/);
  assert.match(result.stdout, /Secretariat access is required to update submissions/);
});
