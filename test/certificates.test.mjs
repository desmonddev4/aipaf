import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';

import handler, { createCertificateToken, verifyCertificateToken, buildCertificate } from '../src/server/handlers/api/certificates.mjs';

test('certificates create a signed token and verify only the matching credential', () => {
  const secret = 'test-certificate-secret';
  const certificate = {
    id: 'cert-123',
    memberId: 'member-456',
    name: 'Professional Certificate',
    grade: 'member',
    issuedAt: '2026-10-07',
    expiresAt: '2027-10-07',
  };

  const token = createCertificateToken(certificate, secret);
  const verified = verifyCertificateToken(token, secret);
  const wrongSecret = verifyCertificateToken(token, 'wrong-secret');

  assert.deepEqual(verified, certificate);
  assert.equal(wrongSecret, null);
});

test('the public verification route accepts valid tokens and rejects invalid ones', async () => {
  const secret = 'test-certificate-secret';
  const certificate = {
    id: 'cert-public-123',
    memberId: 'member-456',
    name: 'Professional Certificate',
    grade: 'member',
    issuer: 'AIPAF',
    issuedAt: '2026-10-07',
    expiresAt: '2027-10-07',
    type: 'professional',
  };
  const token = createCertificateToken(certificate, secret);
  const originalSecret = process.env.CERTIFICATE_SECRET;
  process.env.CERTIFICATE_SECRET = secret;

  try {
    const valid = await handler(new Request(`http://localhost/api/certificates?action=verify&token=${encodeURIComponent(token)}`));
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { ok: true, certificate });

    const invalid = await handler(new Request('http://localhost/api/certificates?action=verify&token=not-a-token'));
    assert.equal(invalid.status, 401);
    assert.deepEqual(await invalid.json(), { ok: false, message: 'Invalid or expired certificate token.' });
  } finally {
    if (originalSecret === undefined) delete process.env.CERTIFICATE_SECRET;
    else process.env.CERTIFICATE_SECRET = originalSecret;
  }
});

test('certificate data is normalized before issuance', () => {
  const result = buildCertificate({
    id: 'cert-123',
    memberId: 'member-456',
    name: '  Professional Certificate  ',
    grade: 'member',
    issuer: 'AIPAF',
    issuedAt: '2026-10-07',
    expiresAt: '2027-10-07',
  });

  assert.equal(result.ok, true);
  assert.equal(result.certificate.name, 'Professional Certificate');
  assert.equal(result.certificate.grade, 'member');
  assert.equal(result.certificate.issuer, 'AIPAF');
  assert.equal(buildCertificate({ name: '', grade: 'member' }).ok, false);
});
