import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPasswordHash,
  sanitizeCmsInput,
  validateMemberPasswordChange,
  validateMemberProfile,
  verifyPassword,
  validateMemberRegistration,
} from '../src/server/handlers/api/member-core.mjs';

test('member registration validates required identity and password fields', () => {
  const result = validateMemberRegistration({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    password: 'StrongPass!2026',
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.email, 'ada@example.com');

  assert.equal(validateMemberRegistration({
    firstName: '',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    password: 'StrongPass!2026',
  }).ok, false);

  assert.equal(validateMemberRegistration({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'not-an-email',
    password: 'StrongPass!2026',
  }).ok, false);

  assert.equal(validateMemberRegistration({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    password: 'weak',
  }).ok, false);
});

test('password hashes are unique and can be verified', () => {
  const hashA = createPasswordHash('StrongPass!2026');
  const hashB = createPasswordHash('StrongPass!2026');

  assert.notEqual(hashA, hashB);
  assert.equal(verifyPassword('StrongPass!2026', hashA), true);
  assert.equal(verifyPassword('WrongPass!2026', hashA), false);
});

test('CMS content is sanitized for safe publication', () => {
  const result = sanitizeCmsInput({
    type: 'news',
    slug: '  test-story  ',
    title: '  Test story  ',
    summary: '<script>alert(1)</script>Safe summary',
    body: '<p>Allowed <strong>content</strong>.</p>',
  });

  assert.deepEqual(result, {
    type: 'news',
    slug: 'test-story',
    title: 'Test story',
    summary: 'Safe summary',
    body: '<p>Allowed <strong>content</strong>.</p>',
  });
});

test('member profile updates reject unsafe content and validate country and website fields', () => {
  const result = validateMemberProfile({
    firstName: 'Ada',
    lastName: 'Lovelace',
    country: 'Ghana',
    organisation: 'AIPAF',
    designation: 'Director',
    bio: '<script>alert(1)</script><p>Research lead</p>',
    phone: '+233 20 000 0000',
    website: 'https://example.org/profile',
    linkedIn: 'https://www.linkedin.com/in/ada-lovelace',
    publicEmail: 'ada@example.com',
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.bio, '<p>Research lead</p>');

  const invalid = validateMemberProfile({ website: 'not-a-url' });
  assert.equal(invalid.ok, false);
  assert.match(invalid.message, /valid website/i);
});

test('password changes require a current password and a sufficiently strong replacement', () => {
  const valid = validateMemberPasswordChange({ currentPassword: 'OldPass!2026', newPassword: 'NewStrongPass!2026' });
  assert.equal(valid.ok, true);

  const missing = validateMemberPasswordChange({ currentPassword: '', newPassword: 'NewStrongPass!2026' });
  assert.equal(missing.ok, false);
  assert.match(missing.message, /current password/i);

  const weak = validateMemberPasswordChange({ currentPassword: 'OldPass!2026', newPassword: 'weak' });
  assert.equal(weak.ok, false);
  assert.match(weak.message, /8 characters/i);

  const same = validateMemberPasswordChange({ currentPassword: 'SamePass!2026', newPassword: 'SamePass!2026' });
  assert.equal(same.ok, false);
  assert.match(same.message, /different/i);
});
