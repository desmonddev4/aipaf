import { createHmac, timingSafeEqual } from 'node:crypto';
import { jsonResponse } from '../_shared.mjs';
import { db } from '../db.mjs';
import { hashPassword, verifyPassword, generateVerificationCode, isVerificationCodeValid } from '../admin-auth.mjs';
import { sendVerificationEmail } from '../email.mjs';

const SESSION_COOKIE = 'aipaf_admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getSessionSecret() {
  return process.env.SESSION_SECRET || 'development-only-session-secret';
}

function sign(value) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('hex');
}

function parseSessionCookie(header) {
  if (!header || typeof header !== 'string') return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function createAdminSession(adminId, role) {
  const payload = JSON.stringify({ adminId, role, issuedAt: Date.now() });
  const signed = `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

export function verifyAdminSession(request) {
  const value = parseSessionCookie(request.headers.get('cookie') || '');
  if (!value) return { message: 'Authentication required.', status: 401 };

  const [payloadBase64, signature] = value.split('.');
  if (!payloadBase64 || !signature) return { message: 'Invalid session.', status: 401 };

  const payload = Buffer.from(payloadBase64, 'base64url').toString('utf8');
  const expected = sign(payload);
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return { message: 'Invalid session.', status: 401 };
  }

  try {
    const session = JSON.parse(payload);
    if (!session.adminId || !session.role || Date.now() - session.issuedAt > SESSION_TTL_MS) {
      return { message: 'Session expired.', status: 401 };
    }
    return { adminId: session.adminId, role: session.role };
  } catch {
    return { message: 'Invalid session.', status: 401 };
  }
}

export default async function handler(request) {
  if (request.method === 'GET') {
    const auth = verifyAdminSession(request);
    if (auth.status) {
      return jsonResponse({ ok: false, message: auth.message }, auth.status);
    }
    // Fetch admin details
    const admin = await db.query(
      'SELECT id, email, role, email_verified FROM admin_users WHERE id = $1',
      [auth.adminId]
    );
    if (!admin.rows[0]) {
      return jsonResponse({ ok: false, message: 'Admin not found.' }, 404);
    }
    return jsonResponse({ ok: true, admin: admin.rows[0] });
  }

  if (request.method === 'DELETE') {
    return new Response(JSON.stringify({ ok: true, message: 'Signed out.' }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'set-cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0`,
        'cache-control': 'no-store',
      },
    });
  }

  if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: 'Request body must be JSON.' }, 400);
  }

  const action = body.action;

  // LOGIN: Step 1 - Verify email and password
  if (action === 'login') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return jsonResponse({ ok: false, message: 'Email and password are required.' }, 400);
    }

    const result = await db.query(
      'SELECT id, email, password_hash, role, email_verified FROM admin_users WHERE email = $1',
      [email]
    );

    if (!result.rows[0]) {
      return jsonResponse({ ok: false, message: 'Invalid email or password.' }, 401);
    }

    const admin = result.rows[0];
    const passwordValid = await verifyPassword(password, admin.password_hash);

    if (!passwordValid) {
      return jsonResponse({ ok: false, message: 'Invalid email or password.' }, 401);
    }

    // Generate and send verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    await db.query(
      'UPDATE admin_users SET verification_code = $1, verification_expires_at = $2 WHERE id = $3',
      [verificationCode, expiresAt, admin.id]
    );

    // Send verification email
    try {
      await sendVerificationEmail({
        email: admin.email,
        code: verificationCode,
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return jsonResponse({ ok: false, message: 'Failed to send verification email. Please try again.' }, 500);
    }

    return jsonResponse({
      ok: true,
      message: 'Verification code sent to your email.',
      requiresVerification: true,
    });
  }

  // LOGIN: Step 2 - Verify code and create session
  if (action === 'verify') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!email || !code) {
      return jsonResponse({ ok: false, message: 'Email and verification code are required.' }, 400);
    }

    const result = await db.query(
      'SELECT id, email, role, verification_code, verification_expires_at FROM admin_users WHERE email = $1',
      [email]
    );

    if (!result.rows[0]) {
      return jsonResponse({ ok: false, message: 'Invalid email or code.' }, 401);
    }

    const admin = result.rows[0];

    if (!admin.verification_code || admin.verification_code !== code) {
      return jsonResponse({ ok: false, message: 'Invalid verification code.' }, 401);
    }

    if (!isVerificationCodeValid(admin.verification_expires_at)) {
      return jsonResponse({ ok: false, message: 'Verification code has expired. Please request a new one.' }, 401);
    }

    // Clear verification code and mark email as verified
    await db.query(
      'UPDATE admin_users SET verification_code = NULL, verification_expires_at = NULL, email_verified = TRUE, last_login_at = NOW() WHERE id = $1',
      [admin.id]
    );

    // Create session
    return new Response(JSON.stringify({ ok: true, message: 'Authenticated.' }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'set-cookie': createAdminSession(admin.id, admin.role),
        'cache-control': 'no-store',
      },
    });
  }

  // RESEND verification code
  if (action === 'resend') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return jsonResponse({ ok: false, message: 'Email is required.' }, 400);
    }

    const result = await db.query(
      'SELECT id, email FROM admin_users WHERE email = $1',
      [email]
    );

    if (!result.rows[0]) {
      return jsonResponse({ ok: false, message: 'Email not found.' }, 404);
    }

    const admin = result.rows[0];
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    await db.query(
      'UPDATE admin_users SET verification_code = $1, verification_expires_at = $2 WHERE id = $3',
      [verificationCode, expiresAt, admin.id]
    );

    try {
      await sendVerificationEmail({
        email: admin.email,
        code: verificationCode,
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return jsonResponse({ ok: false, message: 'Failed to send verification email. Please try again.' }, 500);
    }

    return jsonResponse({
      ok: true,
      message: 'New verification code sent to your email.',
    });
  }

  return jsonResponse({ ok: false, message: 'Invalid action.' }, 400);
}
