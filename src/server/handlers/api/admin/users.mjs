import { jsonResponse } from '../_shared.mjs';
import { db } from '../db.mjs';
import { hashPassword } from '../admin-auth.mjs';
import { requireAdmin } from '../_auth.mjs';
import { sendAdminWelcomeEmail } from '../email.mjs';
import { logAuditEntry } from '../../../middleware/audit-logger.mjs';

const ROLES = ['secretariat', 'council'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function lastSecretariat(id) {
  const result = await db.query("SELECT COUNT(*)::int AS n FROM admin_users WHERE role = 'secretariat' AND id <> $1", [id]);
  return result.rows[0].n === 0;
}

export default async function handler(request) {
  const auth = requireAdmin(request, ['secretariat']);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  try {
    if (request.method === 'GET') {
      const result = await db.query(
        'SELECT id, email, role, email_verified, last_login_at, created_at FROM admin_users ORDER BY created_at DESC',
      );
      return jsonResponse({ ok: true, admins: result.rows, currentAdminId: auth.adminId });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body) return jsonResponse({ ok: false, message: 'Request body must be JSON.' }, 400);

      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const role = typeof body.role === 'string' ? body.role : '';

      if (!email || !password || !role) return jsonResponse({ ok: false, message: 'Email, password, and role are required.' }, 400);
      if (!EMAIL_PATTERN.test(email)) return jsonResponse({ ok: false, message: 'Enter a valid email address.' }, 400);
      if (!ROLES.includes(role)) return jsonResponse({ ok: false, message: 'Role must be either secretariat or council.' }, 400);
      if (password.length < 8) return jsonResponse({ ok: false, message: 'Password must be at least 8 characters.' }, 400);

      const existing = await db.query('SELECT id FROM admin_users WHERE email = $1', [email]);
      if (existing.rows[0]) return jsonResponse({ ok: false, message: 'An admin with this email already exists.' }, 409);

      const passwordHash = await hashPassword(password);
      const result = await db.query(
        'INSERT INTO admin_users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, email_verified, created_at',
        [email, passwordHash, role],
      );
      const admin = result.rows[0];
      await logAuditEntry(auth.role, 'create', 'admin_user', admin.id, { email, role }, request);

      let emailed = false;
      if (body.notify !== false) {
        try { emailed = (await sendAdminWelcomeEmail({ email, role })).status === 'sent'; } catch (error) { console.error('Admin welcome email failed:', error); }
      }
      return jsonResponse({ ok: true, message: 'Admin user created.', admin, emailed });
    }

    if (request.method === 'PUT') {
      const body = await request.json().catch(() => null);
      if (!body || !body.id) return jsonResponse({ ok: false, message: 'Admin ID is required.' }, 400);
      const target = await db.query('SELECT id, email, role FROM admin_users WHERE id = $1', [body.id]);
      if (!target.rows[0]) return jsonResponse({ ok: false, message: 'Admin user not found.' }, 404);

      if (body.action === 'reset-password') {
        const password = typeof body.password === 'string' ? body.password : '';
        if (password.length < 8) return jsonResponse({ ok: false, message: 'Password must be at least 8 characters.' }, 400);
        await db.query('UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [await hashPassword(password), body.id]);
        await logAuditEntry(auth.role, 'update', 'admin_user', body.id, { email: target.rows[0].email, change: 'password reset' }, request);
        return jsonResponse({ ok: true, message: 'Password reset.' });
      }

      if (body.action === 'set-role') {
        if (!ROLES.includes(body.role)) return jsonResponse({ ok: false, message: 'Role must be either secretariat or council.' }, 400);
        if (body.id === auth.adminId) return jsonResponse({ ok: false, message: 'You cannot change your own role.' }, 400);
        if (target.rows[0].role === 'secretariat' && body.role !== 'secretariat' && await lastSecretariat(body.id)) {
          return jsonResponse({ ok: false, message: 'There must be at least one secretariat admin.' }, 400);
        }
        await db.query('UPDATE admin_users SET role = $1, updated_at = NOW() WHERE id = $2', [body.role, body.id]);
        await logAuditEntry(auth.role, 'update', 'admin_user', body.id, { email: target.rows[0].email, role: body.role }, request);
        return jsonResponse({ ok: true, message: 'Role updated.' });
      }

      return jsonResponse({ ok: false, message: 'Unknown action.' }, 400);
    }

    if (request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id');
      if (!id) return jsonResponse({ ok: false, message: 'Admin ID is required.' }, 400);
      if (id === auth.adminId) return jsonResponse({ ok: false, message: 'You cannot delete your own account.' }, 400);

      const target = await db.query('SELECT id, email, role FROM admin_users WHERE id = $1', [id]);
      if (!target.rows[0]) return jsonResponse({ ok: false, message: 'Admin user not found.' }, 404);
      if (target.rows[0].role === 'secretariat' && await lastSecretariat(id)) {
        return jsonResponse({ ok: false, message: 'There must be at least one secretariat admin.' }, 400);
      }
      await db.query('DELETE FROM admin_users WHERE id = $1', [id]);
      await logAuditEntry(auth.role, 'delete', 'admin_user', id, { email: target.rows[0].email }, request);
      return jsonResponse({ ok: true, message: 'Admin user deleted.' });
    }

    return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
  } catch (error) {
    console.error('Admin users error:', error);
    return jsonResponse({ ok: false, message: 'Admin users are unavailable right now.' }, 503);
  }
}
