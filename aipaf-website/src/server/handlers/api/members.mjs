import { withDb } from './db.mjs';
import { jsonResponse } from './_shared.mjs';
import { createPasswordHash, validateMemberRegistration, verifyPassword } from './member-core.mjs';
import { createSessionToken, createSignedSession } from './member-auth.mjs';

function parseJsonBody(request) {
  return request.json().catch(() => ({}));
}

function sessionCookie(token) {
  return `aipaf_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`;
}

export default async function handler(request) {
  if (request.method === 'POST') {
    const body = await parseJsonBody(request);
    if (body.action === 'register') {
      const validation = validateMemberRegistration(body);
      if (!validation.ok) return jsonResponse({ ok: false, message: validation.message }, 400);

      try {
        const result = await withDb(async (client) => {
          const existing = await client.query('SELECT id FROM members WHERE email = $1', [validation.data.email]);
          if (existing.rowCount) return { ok: false, message: 'An account with that email already exists.', status: 409 };

          const passwordHash = createPasswordHash(validation.data.password);
          const member = await client.query(
            `INSERT INTO members (
              email, password_hash, first_name, last_name, country, organisation, designation
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, email, first_name, last_name, role, membership_grade, membership_status, email_verified`,
            [
              validation.data.email,
              passwordHash,
              validation.data.firstName,
              validation.data.lastName,
              body.country || null,
              body.organisation || null,
              body.designation || null,
            ],
          );

          return { ok: true, member: member.rows[0] };
        });

        if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
        return jsonResponse({ ok: true, message: 'Account created.', member: result.member });
      } catch (error) {
        return jsonResponse({ ok: false, message: 'Account creation is unavailable.', status: 503 });
      }
    }

    if (body.action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!email || !password) return jsonResponse({ ok: false, message: 'Email and password are required.' }, 400);

      try {
        const result = await withDb(async (client) => {
          const member = await client.query(
            `SELECT id, email, password_hash, first_name, last_name, role, membership_grade, membership_status, email_verified
             FROM members WHERE email = $1`,
            [email],
          );
          if (!member.rowCount) return { ok: false, message: 'Invalid email or password.', status: 401 };

          const record = member.rows[0];
          if (!verifyPassword(password, record.password_hash)) {
            return { ok: false, message: 'Invalid email or password.', status: 401 };
          }

          const sessionToken = createSessionToken();
          const session = createSignedSession({ memberId: record.id, role: record.role, token: sessionToken });
          return { ok: true, member: { id: record.id, email: record.email, firstName: record.first_name, lastName: record.last_name, role: record.role, membershipGrade: record.membership_grade, membershipStatus: record.membership_status, emailVerified: record.email_verified }, session };
        });

        if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
        return new Response(JSON.stringify({ ok: true, member: result.member }), {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'set-cookie': sessionCookie(result.session),
          },
        });
      } catch (error) {
        return jsonResponse({ ok: false, message: 'Login is unavailable.', status: 503 });
      }
    }
  }

  return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
}
