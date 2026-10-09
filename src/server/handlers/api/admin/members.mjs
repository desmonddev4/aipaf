import { withDb } from '../db.mjs';
import { jsonResponse } from '../_shared.mjs';
import { requireAdmin } from '../_auth.mjs';
import { createPasswordHash } from '../member-core.mjs';
import { logAuditEntry } from '../../../middleware/audit-logger.mjs';

const ALLOWED_STATUSES = ['unverified', 'pending', 'active', 'suspended', 'expired'];
const ALLOWED_GRADES = ['student', 'affiliate', 'associate', 'member', 'fellow'];
const ALLOWED_ROLES = ['member', 'secretariat', 'council'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isMemberId = (value) => typeof value === 'string' && UUID_PATTERN.test(value);
const validIds = (ids) => ids.filter(isMemberId);

const SELECT_COLUMNS = 'id, email, first_name, last_name, country, organisation, designation, membership_grade, membership_status, role, email_verified, profile_public, admin_notes, last_login_at, created_at';

function parseLimit(value) {
  return Math.min(Math.max(Number(value) || 25, 1), 250);
}

function parseOffset(value) {
  return Math.max(Number(value) || 0, 0);
}

function sanitizeSearch(value) {
  return String(value || '').trim();
}

async function getMembers(search, status, limit, offset) {
  const params = [];
  const clauses = [];

  if (search) {
    const term = `%${search}%`;
    clauses.push('(email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR organisation ILIKE $1 OR designation ILIKE $1)');
    params.push(term);
  }

  if (status) {
    clauses.push('membership_status = $' + (params.length + 1));
    params.push(status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `SELECT ${SELECT_COLUMNS} FROM members ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  const result = await withDb((client) => client.query(sql, [...params, limit, offset]));
  return result.rows;
}

async function updateMemberStatus(id, status, authRole, request) {
  if (!ALLOWED_STATUSES.includes(status)) return { ok: false, message: 'Invalid membership status.', status: 400 };
  if (!isMemberId(id)) return { ok: false, message: 'Invalid member identifier.', status: 400 };

  const result = await withDb(async (client) => client.query(
    'UPDATE members SET membership_status = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
    [status, id],
  ));

  if (!result.rowCount) return { ok: false, message: 'Member not found.', status: 404 };

  // Log audit entry
  await logAuditEntry(authRole, 'update_member_status', 'member', id, { newStatus: status }, request);

  return { ok: true };
}

async function getMemberDetails(id) {
  const result = await withDb(async (client) => {
    const member = await client.query(
      `SELECT ${SELECT_COLUMNS} FROM members WHERE id = $1`,
      [id]
    );

    if (!member.rowCount) {
      return { ok: false, message: 'Member not found.', status: 404 };
    }

    const profile = await client.query(
      'SELECT * FROM member_profiles WHERE member_id = $1',
      [id]
    );

    // Get CPD records
    const cpdRecords = await client.query(
      `SELECT * FROM cpd_records WHERE member_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [id]
    );

    // Get examination history
    const examinations = await client.query(
      `SELECT er.*, e.name AS examination_name, e.code AS examination_code
       FROM examination_registrations er
       JOIN examinations e ON e.id = er.examination_id
       WHERE er.member_id = $1
       ORDER BY er.registered_at DESC
       LIMIT 50`,
      [id]
    );

    // Get payment history
    const payments = await client.query(
      `SELECT * FROM payments WHERE member_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [id]
    );

    // Get certificates
    const certificates = await client.query(
      `SELECT * FROM certificates WHERE member_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [id]
    );

    return {
      ok: true,
      member: member.rows[0],
      profile: profile.rows[0] || null,
      cpdRecords: cpdRecords.rows,
      examinations: examinations.rows,
      payments: payments.rows,
      certificates: certificates.rows
    };
  });

  return result;
}

async function updateMemberDetails(id, data) {
  const { first_name, last_name, country, organisation, designation, profile_public } = data;

  const result = await withDb(async (client) => {
    const updated = await client.query(
      `UPDATE members
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           country = COALESCE($3, country),
           organisation = COALESCE($4, organisation),
           designation = COALESCE($5, designation),
           profile_public = COALESCE($6, profile_public),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [first_name, last_name, country, organisation, designation, profile_public, id]
    );

    if (!updated.rowCount) {
      return { ok: false, message: 'Member not found.', status: 404 };
    }

    return { ok: true, member: updated.rows[0] };
  });

  return result;
}

async function changeMemberGrade(id, grade, authRole, request) {
  if (!ALLOWED_GRADES.includes(grade)) {
    return { ok: false, message: 'Invalid membership grade.', status: 400 };
  }

  const result = await withDb(async (client) => {
    const updated = await client.query(
      'UPDATE members SET membership_grade = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [grade, id]
    );

    if (!updated.rowCount) {
      return { ok: false, message: 'Member not found.', status: 404 };
    }

    return { ok: true, member: updated.rows[0] };
  });

  if (result.ok) {
    await logAuditEntry(authRole, 'change_member_grade', 'member', id, { newGrade: grade }, request);
  }

  return result;
}

async function changeMemberRole(id, role) {
  if (!ALLOWED_ROLES.includes(role)) {
    return { ok: false, message: 'Invalid member role.', status: 400 };
  }

  const result = await withDb(async (client) => {
    const updated = await client.query(
      'UPDATE members SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [role, id]
    );

    if (!updated.rowCount) {
      return { ok: false, message: 'Member not found.', status: 404 };
    }

    return { ok: true, member: updated.rows[0] };
  });

  return result;
}

async function verifyMemberEmail(id) {
  const result = await withDb(async (client) => {
    const updated = await client.query(
      'UPDATE members SET email_verified = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );

    if (!updated.rowCount) {
      return { ok: false, message: 'Member not found.', status: 404 };
    }

    return { ok: true, member: updated.rows[0] };
  });

  return result;
}

async function resetMemberPassword(id, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters.', status: 400 };
  }

  const result = await withDb(async (client) => {
    const passwordHash = createPasswordHash(newPassword);
    const updated = await client.query(
      'UPDATE members SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [passwordHash, id]
    );

    if (!updated.rowCount) {
      return { ok: false, message: 'Member not found.', status: 404 };
    }

    return { ok: true };
  });

  return result;
}

async function deleteMemberAccount(id, authRole, request) {
  const result = await withDb(async (client) => {
    const deleted = await client.query('DELETE FROM members WHERE id = $1 RETURNING id', [id]);

    if (!deleted.rowCount) {
      return { ok: false, message: 'Member not found.', status: 404 };
    }

    return { ok: true };
  });

  if (result.ok) {
    await logAuditEntry(authRole, 'delete_member_account', 'member', id, {}, request);
  }

  return result;
}

async function bulkUpdateMemberStatus(ids, status, authRole, request) {
  if (!ALLOWED_STATUSES.includes(status)) return { ok: false, message: 'Invalid membership status.', status: 400 };
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, message: 'No member IDs provided.', status: 400 };

  const numericIds = validIds(ids);
  if (numericIds.length === 0) return { ok: false, message: 'Invalid member identifiers.', status: 400 };

  const result = await withDb(async (client) => {
    const updated = await client.query(
      `UPDATE members SET membership_status = $1, updated_at = NOW() WHERE id = ANY($2) RETURNING id`,
      [status, numericIds]
    );

    return { ok: true, updated: updated.rowCount };
  });

  if (result.ok) {
    await logAuditEntry(authRole, 'bulk_update_member_status', 'member', numericIds.join(','), { newStatus: status, count: result.updated }, request);
  }

  return result;
}

async function mergeMemberAccounts(sourceId, targetId, authRole, request) {
  const numericSource = sourceId;
  const numericTarget = targetId;

  if (!isMemberId(numericSource)) {
    return { ok: false, message: 'Invalid source member identifier.', status: 400 };
  }

  if (!isMemberId(numericTarget)) {
    return { ok: false, message: 'Invalid target member identifier.', status: 400 };
  }

  if (numericSource === numericTarget) {
    return { ok: false, message: 'Source and target member IDs cannot be the same.', status: 400 };
  }

  const result = await withDb(async (client) => {
    // Check both members exist
    const source = await client.query('SELECT * FROM members WHERE id = $1', [numericSource]);
    const target = await client.query('SELECT * FROM members WHERE id = $1', [numericTarget]);

    if (!source.rowCount) return { ok: false, message: 'Source member not found.', status: 404 };
    if (!target.rowCount) return { ok: false, message: 'Target member not found.', status: 404 };

    // Transfer related records from source to target
    await client.query('UPDATE member_profiles SET member_id = $1 WHERE member_id = $2', [numericTarget, numericSource]);
    await client.query('UPDATE payments SET member_id = $1 WHERE member_id = $2', [numericTarget, numericSource]);
    await client.query('UPDATE examination_registrations SET member_id = $1 WHERE member_id = $2', [numericTarget, numericSource]);
    await client.query('UPDATE cpd_records SET member_id = $1 WHERE member_id = $2', [numericTarget, numericSource]);
    await client.query('UPDATE certificates SET member_id = $1 WHERE member_id = $2', [numericTarget, numericSource]);
    await client.query('UPDATE member_applications SET member_id = $1 WHERE member_id = $2', [numericTarget, numericSource]);

    // Delete source member
    await client.query('DELETE FROM members WHERE id = $1', [numericSource]);

    return { ok: true, sourceEmail: source.rows[0].email, targetEmail: target.rows[0].email };
  });

  if (result.ok) {
    await logAuditEntry(authRole, 'merge_member_accounts', 'member', `${sourceId}->${targetId}`, { sourceId, targetId }, request);
  }

  return result;
}

async function exportMemberData(ids, authRole, request) {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, message: 'No member IDs provided.', status: 400 };

  const numericIds = validIds(ids);
  if (numericIds.length === 0) return { ok: false, message: 'Invalid member identifiers.', status: 400 };

  const result = await withDb(async (client) => {
    const members = await client.query(
      `SELECT id, email, first_name, last_name, country, organisation, designation, membership_grade, membership_status, role, email_verified, profile_public, admin_notes, last_login_at, created_at
       FROM members WHERE id = ANY($1)`,
      [numericIds]
    );

    const profiles = await client.query(
      'SELECT * FROM member_profiles WHERE member_id = ANY($1)',
      [numericIds]
    );

    return { ok: true, members: members.rows, profiles: profiles.rows };
  });

  if (result.ok) {
    await logAuditEntry(authRole, 'export_member_data', 'member', numericIds.join(','), { count: numericIds.length }, request);
  }

  return result;
}

async function updateAdminNotes(id, notes, authRole, request) {
  const numericId = id;
  if (!isMemberId(numericId)) {
    return { ok: false, message: 'Invalid member identifier.', status: 400 };
  }

  const result = await withDb(async (client) => {
    const updated = await client.query(
      'UPDATE members SET admin_notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [notes || null, numericId]
    );

    if (!updated.rowCount) {
      return { ok: false, message: 'Member not found.', status: 404 };
    }

    return { ok: true, member: updated.rows[0] };
  });

  if (result.ok) {
    await logAuditEntry(authRole, 'update_admin_notes', 'member', id, { notes }, request);
  }

  return result;
}

export default async function handler(request) {
  const auth = requireAdmin(request, ['secretariat', 'council']);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  const url = new URL(request.url);
  const search = sanitizeSearch(url.searchParams.get('search'));
  const status = ALLOWED_STATUSES.includes(url.searchParams.get('status')) ? url.searchParams.get('status') : null;
  const limit = parseLimit(url.searchParams.get('limit'));
  const offset = parseOffset(url.searchParams.get('offset'));
  const memberId = url.searchParams.get('id');

  if (request.method === 'GET') {
    if (memberId) {
      // Get member details
      const result = await getMemberDetails(memberId);
      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
      return jsonResponse({ ok: true, ...result, role: auth.role });
    }

    // List members
    const items = await getMembers(search, status, limit, offset);
    return jsonResponse({ ok: true, items, count: items.length, role: auth.role });
  }

  if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
  if (auth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required to update members.' }, 403);

  const body = await request.json().catch(() => ({}));

  // Update member status
  if (body.action === 'update-status') {
    const result = await updateMemberStatus(body.id, body.status, auth.role, request);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Member status updated.', role: auth.role });
  }

  // Update member details
  if (body.action === 'update-details') {
    const result = await updateMemberDetails(body.id, body);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Member details updated.', member: result.member, role: auth.role });
  }

  // Change member grade
  if (body.action === 'change-grade') {
    const result = await changeMemberGrade(body.id, body.grade, auth.role, request);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Member grade changed.', member: result.member, role: auth.role });
  }

  // Change member role
  if (body.action === 'change-role') {
    const result = await changeMemberRole(body.id, body.role);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Member role changed.', member: result.member, role: auth.role });
  }

  // Verify member email
  if (body.action === 'verify-email') {
    const result = await verifyMemberEmail(body.id);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Email verified.', member: result.member, role: auth.role });
  }

  // Reset member password
  if (body.action === 'reset-password') {
    const result = await resetMemberPassword(body.id, body.newPassword);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Password reset successfully.', role: auth.role });
  }

  // Delete member account
  if (body.action === 'delete-account') {
    const result = await deleteMemberAccount(body.id, auth.role, request);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Member account deleted.', role: auth.role });
  }

  // Bulk update member status
  if (body.action === 'bulk-update-status') {
    const result = await bulkUpdateMemberStatus(body.ids, body.status, auth.role, request);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: `Updated ${result.updated} members.`, updated: result.updated, role: auth.role });
  }

  // Merge member accounts
  if (body.action === 'merge-accounts') {
    const result = await mergeMemberAccounts(body.sourceId, body.targetId, auth.role, request);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: `Merged account ${result.sourceEmail} into ${result.targetEmail}.`, role: auth.role });
  }

  // Export member data
  if (body.action === 'export-data') {
    const result = await exportMemberData(body.ids, auth.role, request);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, members: result.members, profiles: result.profiles, role: auth.role });
  }

  // Update admin notes
  if (body.action === 'update-admin-notes') {
    const result = await updateAdminNotes(body.id, body.notes, auth.role, request);
    if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
    return jsonResponse({ ok: true, message: 'Admin notes updated.', member: result.member, role: auth.role });
  }

  return jsonResponse({ ok: false, message: 'Unsupported admin action.' }, 400);
}
