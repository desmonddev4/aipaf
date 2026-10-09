import { randomBytes } from 'node:crypto';
import { withDb } from './db.mjs';
import { jsonResponse } from './_shared.mjs';
import { createPasswordHash, validateMemberRegistration, verifyPassword } from './member-core.mjs';
import { createSessionToken, createSignedSession } from './member-auth.mjs';
import { sendAcknowledgementEmail } from './email.mjs';

function parseJsonBody(request) {
  return request.json().catch(() => ({}));
}

function sessionCookie(token) {
  return `aipaf_session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=604800`;
}

function generateResetToken() {
  return randomBytes(32).toString('hex');
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export default async function handler(request) {
  if (request.method === 'POST') {
    const body = await parseJsonBody(request);
    if (body.action === 'logout') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'set-cookie': 'aipaf_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0',
        },
      });
    }

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

          // Create email verification token
          const verifyToken = generateResetToken();
          const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
          await client.query(
            `INSERT INTO email_verification_tokens (member_id, token, expires_at)
             VALUES ($1, $2, $3)`,
            [member.rows[0].id, verifyToken, expiresAt]
          );

          // Send verification email
          try {
            const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
            const verifyUrl = `${siteUrl}/member-verify-email?token=${verifyToken}`;
            await sendAcknowledgementEmail({
              kind: 'verify-email',
              data: { email: validation.data.email, verifyUrl }
            });
          } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
          }

          return { ok: true, member: member.rows[0] };
        });

        if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
        return jsonResponse({ ok: true, message: 'Account created. Please check your email to verify your account.', member: result.member });
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

          // Update last login
          await client.query('UPDATE members SET last_login_at = NOW() WHERE id = $1', [record.id]);

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

    if (body.action === 'request-password-reset') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return jsonResponse({ ok: false, message: 'Email is required.' }, 400);

      try {
        const result = await withDb(async (client) => {
          const member = await client.query('SELECT id, email FROM members WHERE email = $1', [email]);
          if (!member.rowCount) {
            // Don't reveal if email exists
            return { ok: true, message: 'If an account exists with that email, password reset instructions have been sent.' };
          }

          const record = member.rows[0];
          const resetToken = generateResetToken();
          const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

          // Delete any existing tokens for this member
          await client.query('DELETE FROM password_reset_tokens WHERE member_id = $1', [record.id]);

          // Create new token
          await client.query(
            `INSERT INTO password_reset_tokens (member_id, token, expires_at)
             VALUES ($1, $2, $3)`,
            [record.id, resetToken, expiresAt]
          );

          // Send reset email
          try {
            const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
            const resetUrl = `${siteUrl}/member-reset-password?token=${resetToken}`;
            await sendAcknowledgementEmail({
              kind: 'password-reset',
              data: { email: record.email, resetUrl }
            });
          } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
          }

          return { ok: true, message: 'If an account exists with that email, password reset instructions have been sent.' };
        });

        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ ok: false, message: 'Password reset request failed.', status: 503 });
      }
    }

    if (body.action === 'reset-password') {
      const token = String(body.token || '').trim();
      const newPassword = String(body.newPassword || '');

      if (!token || !newPassword) {
        return jsonResponse({ ok: false, message: 'Token and new password are required.' }, 400);
      }

      if (newPassword.length < 12) {
        return jsonResponse({ ok: false, message: 'Password must be at least 12 characters.' }, 400);
      }

      try {
        const result = await withDb(async (client) => {
          // Find valid token
          const tokenRecord = await client.query(
            `SELECT prt.member_id, prt.used_at, prt.expires_at, m.email
             FROM password_reset_tokens prt
             JOIN members m ON m.id = prt.member_id
             WHERE prt.token = $1`,
            [token]
          );

          if (!tokenRecord.rowCount) {
            return { ok: false, message: 'Invalid or expired reset token.', status: 400 };
          }

          const record = tokenRecord.rows[0];
          if (record.used_at) {
            return { ok: false, message: 'This reset token has already been used.', status: 400 };
          }

          if (new Date(record.expires_at) < new Date()) {
            return { ok: false, message: 'Reset token has expired.', status: 400 };
          }

          // Update password
          const passwordHash = createPasswordHash(newPassword);
          await client.query('UPDATE members SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, record.member_id]);

          // Mark token as used
          await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1', [token]);

          return { ok: true, message: 'Password has been reset successfully.' };
        });

        if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ ok: false, message: 'Password reset failed.', status: 503 });
      }
    }

    if (body.action === 'verify-email') {
      const token = String(body.token || '').trim();
      if (!token) return jsonResponse({ ok: false, message: 'Verification token is required.' }, 400);

      try {
        const result = await withDb(async (client) => {
          // Find valid token
          const tokenRecord = await client.query(
            `SELECT evt.member_id, evt.used_at, evt.expires_at, m.email
             FROM email_verification_tokens evt
             JOIN members m ON m.id = evt.member_id
             WHERE evt.token = $1`,
            [token]
          );

          if (!tokenRecord.rowCount) {
            return { ok: false, message: 'Invalid or expired verification token.', status: 400 };
          }

          const record = tokenRecord.rows[0];
          if (record.used_at) {
            return { ok: false, message: 'This verification token has already been used.', status: 400 };
          }

          if (new Date(record.expires_at) < new Date()) {
            return { ok: false, message: 'Verification token has expired.', status: 400 };
          }

          // Mark email as verified
          await client.query('UPDATE members SET email_verified = TRUE, updated_at = NOW() WHERE id = $1', [record.member_id]);

          // Mark token as used
          await client.query('UPDATE email_verification_tokens SET used_at = NOW() WHERE token = $1', [token]);

          return { ok: true, message: 'Email verified successfully.' };
        });

        if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ ok: false, message: 'Email verification failed.', status: 503 });
      }
    }
  }

  return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
}
