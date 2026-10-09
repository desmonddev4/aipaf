import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_SESSION_SECRET = process.env.SESSION_SECRET || 'local-development-secret-change-me';

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function createSessionToken() {
  return `session_${base64UrlEncode(randomBytes(32))}`;
}

function signedPayload(payload, secret = DEFAULT_SESSION_SECRET) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function createSignedSession(payload, secret = DEFAULT_SESSION_SECRET) {
  return signedPayload(payload, secret);
}

export function parseSessionCookie(header) {
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/(?:^|;\s*)aipaf_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function verifySignedSession(token, secret = DEFAULT_SESSION_SECRET) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  try {
    const [payload, signature] = parts;
    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return null;
    return JSON.parse(base64UrlDecode(payload));
  } catch {
    return null;
  }
}
