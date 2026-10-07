import { timingSafeEqual } from 'node:crypto';

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
  if (!token) return { message: 'Authentication required.', status: 401 };

  const adminKeys = getAdminKeys();
  const role = allowedRoles.find((name) => {
    const expected = adminKeys[name];
    if (!expected) return false;
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(token);
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
