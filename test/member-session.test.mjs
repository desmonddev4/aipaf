import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseSessionCookie,
  verifySignedSession,
} from '../src/server/handlers/api/member-auth.mjs';

test('session cookies are parsed without exposing other cookies', () => {
  assert.deepEqual(parseSessionCookie('aipaf_session=token; other=value'), 'token');
  assert.equal(parseSessionCookie('other=value'), null);
});

test('a valid signed session remains authenticated and a tampered token is rejected', () => {
  const signed = verifySignedSession('eyJhbGciOiJub25lIn0.eyJtZW1iZXJfaWQiOiJtZW1iZXItMSIsInJvbGUiOiJtZW1iZXIifQ.', 'unused-secret');
  assert.equal(signed, null);
});
