import { withDb } from '../handlers/api/db.mjs';

export async function logAuditEntry(role, actionType, entityType, entityId, details, request) {
  try {
    const ipAddress = request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      request?.headers?.get('x-real-ip') ||
                      'unknown';
    const userAgent = request?.headers?.get('user-agent') || 'unknown';

    await withDb(async (client) => {
      await client.query(
        `INSERT INTO audit_log (admin_role, action_type, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [role, actionType, entityType, entityId || null, JSON.stringify(details || {}), ipAddress, userAgent]
      );
    });
  } catch (error) {
    console.error('Failed to log audit entry:', error);
    // Don't throw - audit logging failures shouldn't break the main operation
  }
}

export function createAuditLogger(actionType, entityType) {
  return async (role, entityId, details, request) => {
    await logAuditEntry(role, actionType, entityType, entityId, details, request);
  };
}
