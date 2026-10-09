import { verifyAdminSession } from './admin/session.mjs';

function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export function requireAdmin(request, allowedRoles = ['secretariat', 'council']) {
  const token = getBearerToken(request);
  const session = token ? null : verifyAdminSession(request);
  if (!token && session.status) return { message: session.message, status: session.status };

  if (session.role) {
    // Session-based authentication
    if (!allowedRoles.includes(session.role)) {
      return { message: 'Insufficient permissions.', status: 403 };
    }
    return { role: session.role, adminId: session.adminId };
  }

  // Fallback to Bearer token (if still needed for some API calls)
  if (token) {
    // For now, return error - we're moving away from Bearer tokens
    return { message: 'Token-based authentication is deprecated. Use session-based auth.', status: 401 };
  }

  return { message: 'Authentication required.', status: 401 };
}

export function isConfiguredAdmin() {
  return Boolean(process.env.ADMIN_SECRETARIAT_KEY || process.env.ADMIN_COUNCIL_KEY);
}
