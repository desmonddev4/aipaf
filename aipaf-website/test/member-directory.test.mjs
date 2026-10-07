import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeDirectoryMember } from '../api/member-directory.mjs';

test('member directory keeps only public, active profile data', () => {
  const member = normalizeDirectoryMember({
    id: 'member-1',
    first_name: 'Ada',
    last_name: 'Lovelace',
    country: 'Ghana',
    organisation: 'AIPAF',
    designation: 'Engineer',
    membership_grade: 'member',
    membership_status: 'active',
    profile_public: true,
    public_email: 'ada@example.com',
    bio: 'Project professional',
    website: 'https://example.com',
    linked_in: 'https://linkedin.com/in/ada',
    email: 'private@example.com',
  });

  assert.equal(member.ok, true);
  assert.deepEqual(member.member, {
    id: 'member-1',
    name: 'Ada Lovelace',
    country: 'Ghana',
    organisation: 'AIPAF',
    designation: 'Engineer',
    membership_grade: 'member',
    profile_public: true,
    public_email: 'ada@example.com',
    bio: 'Project professional',
    website: 'https://example.com',
    linked_in: 'https://linkedin.com/in/ada',
  });

  assert.equal(normalizeDirectoryMember({ profile_public: false }).ok, false);
});
