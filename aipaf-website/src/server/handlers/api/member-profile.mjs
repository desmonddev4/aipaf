import { withDb } from './db.mjs';
import { jsonResponse } from './_shared.mjs';
import { parseSessionCookie, verifySignedSession } from './member-auth.mjs';
import { createPasswordHash, validateMemberPasswordChange, validateMemberProfile, verifyPassword } from './member-core.mjs';

function getSessionFromRequest(request) {
  const cookie = parseSessionCookie(request.headers.get('cookie') || '');
  if (!cookie) return null;
  return verifySignedSession(cookie);
}

async function getMember(client, memberId) {
  return client.query(
    `SELECT m.id, m.email, m.first_name, m.last_name, m.country, m.organisation, m.designation,
            m.membership_grade, m.membership_status, m.email_verified, m.last_login_at,
            m.created_at,
            p.bio, p.phone, p.website, p.linked_in, p.preferred_name, p.public_email, p.avatar_url
     FROM members m
     LEFT JOIN member_profiles p ON p.member_id = m.id
     WHERE m.id = $1`,
    [memberId],
  );
}

export default async function handler(request) {
  const session = getSessionFromRequest(request);
  if (!session?.memberId) return jsonResponse({ ok: false, message: 'Authentication required.' }, 401);

  if (request.method === 'GET') {
    try {
      const result = await withDb((client) => getMember(client, session.memberId));
      if (!result.rowCount) return jsonResponse({ ok: false, message: 'Member not found.' }, 404);
      return jsonResponse({ ok: true, member: result.rows[0] });
    } catch {
      return jsonResponse({ ok: false, message: 'Unable to load the profile.' }, 503);
    }
  }

  if (request.method !== 'PUT') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);

  try {
    const body = await request.json().catch(() => ({}));

    if (body.action === 'change-password') {
      const validation = validateMemberPasswordChange(body);
      if (!validation.ok) return jsonResponse({ ok: false, message: validation.message }, 400);

      const result = await withDb(async (client) => {
        const record = await client.query(
          'SELECT password_hash FROM members WHERE id = $1',
          [session.memberId],
        );
        if (!record.rowCount) return { ok: false, message: 'Member not found.', status: 404 };
        if (!verifyPassword(validation.data.currentPassword, record.rows[0].password_hash)) {
          return { ok: false, message: 'Current password is incorrect.', status: 401 };
        }

        const passwordHash = createPasswordHash(validation.data.newPassword);
        await client.query('UPDATE members SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, session.memberId]);
        return { ok: true };
      });

      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
      return jsonResponse({ ok: true, message: 'Password updated.' });
    }

    const validation = validateMemberProfile(body);
    if (!validation.ok) return jsonResponse({ ok: false, message: validation.message }, 400);

    const profile = validation.data;
    const result = await withDb(async (client) => {
      const member = await client.query(
        `UPDATE members
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             country = NULLIF($3, ''),
             organisation = NULLIF($4, ''),
             designation = NULLIF($5, '')
         WHERE id = $6
         RETURNING id`,
        [profile.firstName || null, profile.lastName || null, profile.country || null, profile.organisation || null, profile.designation || null, session.memberId],
      );

      if (!member.rowCount) return { ok: false, message: 'Member not found.', status: 404 };

      await client.query(
        `INSERT INTO member_profiles (member_id, bio, phone, website, linked_in, public_email, preferred_name, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (member_id) DO UPDATE SET
           bio = EXCLUDED.bio,
           phone = EXCLUDED.phone,
           website = EXCLUDED.website,
           linked_in = EXCLUDED.linked_in,
           public_email = EXCLUDED.public_email,
           preferred_name = EXCLUDED.preferred_name,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = NOW()`,
        [session.memberId, profile.bio || null, profile.phone || null, profile.website || null, profile.linkedIn || null, profile.publicEmail || null, null, null],
      );

      return {
        ok: true,
        member: (await getMember(client, session.memberId)).rows[0],
      };
    });

    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Profile updated.', member: result.member });
  } catch {
    return jsonResponse({ ok: false, message: 'Unable to update the profile.' }, 503);
  }
}
