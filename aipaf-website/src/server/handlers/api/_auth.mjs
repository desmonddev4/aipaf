import { timingSafeEqual } from 'node:crypto';
import { verifyAdminSession } from './admin/session.mjs';

function getAdminKeys() {
  return {
    secretariat: process.env.ADMIN_SECRETARIAT_KEY || '',
    council: process.env.ADMIN_COUNCIL_KEY || '',
  };
}

function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export function requireAdmin(request, allowedRoles = ['secretariat', 'council']) {
  const token = getBearerToken(request);
  const session = token ? null : verifyAdminSession(request);
  if (!token && session.status) return { message: session.message, status: session.status };

  const activeToken = token || session.token;
  const adminKeys = getAdminKeys();
  const role = allowedRoles.find((name) => {
    const expected = adminKeys[name];
    if (!expected) return false;
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(activeToken);
    return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
  });

  if (!role) {
    return { message: 'Invalid credentials.', status: 401 };
  }

  return { role };
}

export function isConfiguredAdmin() {
  return Boolean(process.env.ADMIN_SECRETARIAT_KEY || process.env.ADMIN_COUNCIL_KEY);
}
