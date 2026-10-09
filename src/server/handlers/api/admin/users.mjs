import { jsonResponse } from '../_shared.mjs';
import { db } from '../db.mjs';
import { hashPassword } from '../admin-auth.mjs';
import { requireAdmin } from '../_auth.mjs';

export default async function handler(request) {
  const auth = requireAdmin(request, ['secretariat']);
  if (auth.status) {
    return jsonResponse({ ok: false, message: auth.message }, auth.status);
  }

  if (request.method === 'GET') {
    const result = await db.query(
      'SELECT id, email, role, email_verified, last_login_at, created_at FROM admin_users ORDER BY created_at DESC'
    );
    return jsonResponse({ ok: true, admins: result.rows });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, message: 'Request body must be JSON.' }, 400);
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role = typeof body.role === 'string' ? body.role : '';

    if (!email || !password || !role) {
      return jsonResponse({ ok: false, message: 'Email, password, and role are required.' }, 400);
    }

    if (!['secretariat', 'council'].includes(role)) {
      return jsonResponse({ ok: false, message: 'Role must be either secretariat or council.' }, 400);
    }

    if (password.length < 8) {
      return jsonResponse({ ok: false, message: 'Password must be at least 8 characters.' }, 400);
    }

    // Check if email already exists
    const existing = await db.query('SELECT id FROM admin_users WHERE email = $1', [email]);
    if (existing.rows[0]) {
      return jsonResponse({ ok: false, message: 'An admin with this email already exists.' }, 409);
    }

    const passwordHash = await hashPassword(password);

    const result = await db.query(
      'INSERT INTO admin_users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, email_verified, created_at',
      [email, passwordHash, role]
    );

    return jsonResponse({
      ok: true,
      message: 'Admin user created successfully.',
      admin: result.rows[0],
    });
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return jsonResponse({ ok: false, message: 'Admin ID is required.' }, 400);
    }

    // Prevent deleting yourself
    const auth = requireAdmin(request, ['secretariat']);
    if (auth.status) {
      return jsonResponse({ ok: false, message: auth.message }, auth.status);
    }

    // Get current admin's ID from session
    const sessionResult = await db.query(
      'SELECT id FROM admin_users WHERE id = $1',
      [auth.adminId]
    );

    if (sessionResult.rows[0]?.id === id) {
      return jsonResponse({ ok: false, message: 'You cannot delete your own account.' }, 400);
    }

    await db.query('DELETE FROM admin_users WHERE id = $1', [id]);

    return jsonResponse({ ok: true, message: 'Admin user deleted successfully.' });
  }

  return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
}
