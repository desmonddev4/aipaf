import { createHmac, timingSafeEqual } from 'node:crypto';
import { withDb } from './db.mjs';
import { jsonResponse } from './_shared.mjs';
import { requireAdmin } from './_auth.mjs';
import { parseSessionCookie, verifySignedSession } from './member-auth.mjs';

const CREDENTIAL_TYPES = ['professional', 'exam', 'cpd'];
const VALID_GRADES = ['student', 'affiliate', 'associate', 'member', 'fellow'];

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function buildCertificate(input = {}) {
  const certificate = {
    id: String(input.id || '').trim(),
    memberId: String(input.memberId || '').trim(),
    name: String(input.name || '').trim(),
    grade: String(input.grade || '').trim().toLowerCase(),
    issuer: String(input.issuer || 'AIPAF').trim() || 'AIPAF',
    issuedAt: String(input.issuedAt || '').trim(),
    expiresAt: String(input.expiresAt || '').trim(),
    type: String(input.type || 'professional').trim().toLowerCase(),
  };

  if (!certificate.id || !certificate.memberId || !certificate.name || !certificate.issuedAt) {
    return { ok: false, message: 'Certificate id, member, name, and issue date are required.' };
  }
  if (!VALID_GRADES.includes(certificate.grade)) {
    return { ok: false, message: 'Unsupported member grade.' };
  }
  if (!CREDENTIAL_TYPES.includes(certificate.type)) {
    return { ok: false, message: 'Unsupported certificate type.' };
  }

  return { ok: true, certificate };
}

export function createCertificateToken(certificate, secret) {
  const payload = base64UrlEncode(JSON.stringify(certificate));
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyCertificateToken(token, secret) {
  if (!token || !secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const parsed = JSON.parse(base64UrlDecode(payload));
    return parsed;
  } catch {
    return null;
  }
}

function getSessionFromRequest(request) {
  const cookie = parseSessionCookie(request.headers.get('cookie') || '');
  return cookie ? verifySignedSession(cookie) : null;
}

export default async function handler(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (request.method === 'GET' && action === 'verify') {
    const token = url.searchParams.get('token') || '';
    const certificate = verifyCertificateToken(token, process.env.CERTIFICATE_SECRET || '');
    if (!certificate) return jsonResponse({ ok: false, message: 'Invalid or expired certificate token.' }, 401);
    return jsonResponse({ ok: true, certificate });
  }

  if (request.method === 'POST' && action === 'issue') {
    const auth = requireAdmin(request);
    if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);
    if (auth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required.' }, 403);

    const body = await request.json().catch(() => ({}));
    const normalized = buildCertificate(body);
    if (!normalized.ok) return jsonResponse({ ok: false, message: normalized.message }, 400);

    const secret = process.env.CERTIFICATE_SECRET;
    if (!secret) return jsonResponse({ ok: false, message: 'Certificate signing is not configured.' }, 503);

    try {
      const result = await withDb(async (client) => client.query(
        `INSERT INTO certificates (id, member_id, name, grade, issuer, issued_at, expires_at, type, verification_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           member_id = EXCLUDED.member_id,
           name = EXCLUDED.name,
           grade = EXCLUDED.grade,
           issuer = EXCLUDED.issuer,
           issued_at = EXCLUDED.issued_at,
           expires_at = EXCLUDED.expires_at,
           type = EXCLUDED.type,
           verification_token = EXCLUDED.verification_token,
           updated_at = NOW()
         RETURNING id, member_id, name, grade, issuer, issued_at, expires_at, type, verification_token`,
        [normalized.certificate.id, normalized.certificate.memberId, normalized.certificate.name, normalized.certificate.grade, normalized.certificate.issuer, normalized.certificate.issuedAt, normalized.certificate.expiresAt || null, normalized.certificate.type, createCertificateToken(normalized.certificate, secret)],
      ));
      return jsonResponse({ ok: true, certificate: result.rows[0] });
    } catch {
      return jsonResponse({ ok: false, message: 'Unable to issue the certificate.' }, 503);
    }
  }

  if (request.method === 'GET' && action === 'my-certificates') {
    const session = getSessionFromRequest(request);
    if (!session?.memberId) return jsonResponse({ ok: false, message: 'Authentication required.' }, 401);
    const rows = await withDb(async (client) => client.query(
      `SELECT id, name, grade, issuer, issued_at, expires_at, type, verification_token
       FROM certificates WHERE member_id = $1 ORDER BY issued_at DESC`,
      [session.memberId],
    ));
    return jsonResponse({ ok: true, items: rows.rows });
  }

  return jsonResponse({ ok: false, message: 'Unsupported certificate action.' }, 400);
}
