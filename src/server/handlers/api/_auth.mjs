import { verifyAdminSession } from './admin/session.mjs';

export function requireAdmin(request, allowedRoles = ['secretariat', 'council']) {
  const authorization = request.headers.get('authorization');
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const token = match[1].trim();
      const role = token === process.env.ADMIN_SECRETARIAT_KEY ? 'secretariat' :
        token === process.env.ADMIN_COUNCIL_KEY ? 'council' : null;

      if (!role) {
        return { message: 'Invalid admin key.', status: 401 };
      }

      if (!allowedRoles.includes(role)) {
        return { message: 'Insufficient permissions.', status: 403 };
      }

      return { role, adminId: token };
    }
  }

  const session = verifyAdminSession(request);
  if (session.status) return { message: session.message, status: session.status };

  if (!allowedRoles.includes(session.role)) {
    return { message: 'Insufficient permissions.', status: 403 };
  }

  return { role: session.role, adminId: session.adminId };
}

export function isConfiguredAdmin() {
  return Boolean(process.env.ADMIN_SECRETARIAT_KEY || process.env.ADMIN_COUNCIL_KEY);
}
