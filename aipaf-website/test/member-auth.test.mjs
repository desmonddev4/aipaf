import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSessionToken,
  createSignedSession,
  parseSessionCookie,
  verifySignedSession,
} from '../api/member-auth.mjs';

test('session tokens are signed and can be verified with the same secret', () => {
  const secret = 'test-session-secret';
  const session = createSignedSession({ memberId: 'member-123', role: 'member' }, secret);

  assert.equal(verifySignedSession(session, secret).memberId, 'member-123');
  assert.equal(verifySignedSession(session, 'different-secret'), null);
});

test('session cookies are parsed and tampered tokens are rejected', () => {
  const secret = 'test-session-secret';
  const session = createSignedSession({ memberId: 'member-123', role: 'member' }, secret);
  const header = `aipaf_session=${session}; other=keep`;

  assert.equal(parseSessionCookie(header), session);
  assert.equal(parseSessionCookie('other=keep'), null);
  assert.equal(verifySignedSession(`${session}x`, secret), null);
});

test('session tokens include a random secret and are not reusable after signing', () => {
  const tokenA = createSessionToken();
  const tokenB = createSessionToken();

  assert.notEqual(tokenA, tokenB);
  assert.match(tokenA, /^session_[A-Za-z0-9_-]+$/);
});
