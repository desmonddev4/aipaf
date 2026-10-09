import { verifyAdminSession } from './admin/session.mjs';

export function requireAdmin(request, allowedRoles = ['secretariat', 'council']) {
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
