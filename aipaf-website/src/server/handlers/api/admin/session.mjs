import { createHmac, timingSafeEqual } from 'node:crypto';
import { jsonResponse } from '../_shared.mjs';

const SESSION_COOKIE = 'aipaf_admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

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

function isConfiguredKey(token, role) {
  const expected = process.env[role === 'secretariat' ? 'ADMIN_SECRETARIAT_KEY' : 'ADMIN_COUNCIL_KEY'];
  if (!expected) return false;
  return Buffer.from(expected).length === Buffer.from(token).length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function createAdminSession(token) {
  const payload = JSON.stringify({ token, issuedAt: Date.now() });
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
    if (!session.token || Date.now() - session.issuedAt > SESSION_TTL_MS) {
      return { message: 'Session expired.', status: 401 };
    }
    return { token: session.token };
  } catch {
    return { message: 'Invalid session.', status: 401 };
  }
}

export default async function handler(request) {
  if (request.method === 'GET') {
    const auth = verifyAdminSession(request);
    return auth.status ? jsonResponse({ ok: false, message: auth.message }, auth.status) : jsonResponse({ ok: true, message: 'Authenticated.' });
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

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return jsonResponse({ ok: false, message: 'API key is required.' }, 400);

  const valid = isConfiguredKey(token, 'secretariat') || isConfiguredKey(token, 'council');
  if (!valid) return jsonResponse({ ok: false, message: 'Invalid credentials.' }, 401);

  return new Response(JSON.stringify({ ok: true, message: 'Authenticated.' }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': createAdminSession(token),
      'cache-control': 'no-store',
    },
  });
}
