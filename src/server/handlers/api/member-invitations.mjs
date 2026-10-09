import { randomBytes } from 'node:crypto';
import { withDb } from './db.mjs';
import { jsonResponse } from './_shared.mjs';
import { requireAdmin } from './_auth.mjs';
import { sendAcknowledgementEmail } from './email.mjs';
import { createPasswordHash, validateMemberRegistration } from './member-core.mjs';
import { createSessionToken, createSignedSession } from './member-auth.mjs';

const VALID_GRADES = ['fellow', 'member', 'associate', 'affiliate', 'graduate'];
const VALID_STATUSES = ['pending', 'sent', 'accepted', 'declined', 'expired'];

function generateInvitationToken() {
  return randomBytes(32).toString('hex');
}

function sessionCookie(token) {
  return `aipaf_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`;
}

export default async function handler(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Public action: Check invitation status
  if (request.method === 'GET' && action === 'check') {
    const token = url.searchParams.get('token');
    if (!token) return jsonResponse({ ok: false, message: 'Invitation token is required.' }, 400);

    try {
      const result = await withDb(async (client) => {
        const invitation = await client.query(
          `SELECT id, email, full_name, proposed_grade, qualification, affiliation, status, expires_at
           FROM member_invitations
           WHERE invitation_token = $1`,
          [token]
        );

        if (!invitation.rowCount) {
          return { ok: false, message: 'Invalid invitation token.' };
        }

        const inv = invitation.rows[0];
        
        if (inv.status === 'accepted') {
          return { ok: false, message: 'This invitation has already been accepted.' };
        }

        if (inv.status === 'declined') {
          return { ok: false, message: 'This invitation was declined.' };
        }

        if (new Date(inv.expires_at) < new Date()) {
          // Mark as expired
          await client.query('UPDATE member_invitations SET status = $1 WHERE id = $2', ['expired', inv.id]);
          return { ok: false, message: 'This invitation has expired.' };
        }

        return { ok: true, invitation: { fullName: inv.full_name, grade: inv.proposed_grade, qualification: inv.qualification } };
      });

      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, 400);
      return jsonResponse(result);
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to check invitation.' }, 503);
    }
  }

  // Public action: Accept invitation
  if (request.method === 'POST' && action === 'accept') {
    const body = await request.json().catch(() => ({}));
    const token = body.token;
    const password = body.password;
    const confirmPassword = body.confirmPassword;

    if (!token || !password) {
      return jsonResponse({ ok: false, message: 'Token and password are required.' }, 400);
    }

    if (password.length < 8) {
      return jsonResponse({ ok: false, message: 'Password must be at least 8 characters.' }, 400);
    }

    if (password !== confirmPassword) {
      return jsonResponse({ ok: false, message: 'Passwords do not match.' }, 400);
    }

    try {
      const result = await withDb(async (client) => {
        const invitation = await client.query(
          `SELECT id, email, full_name, proposed_grade, qualification, affiliation, status, expires_at
           FROM member_invitations
           WHERE invitation_token = $1`,
          [token]
        );

        if (!invitation.rowCount) {
          return { ok: false, message: 'Invalid invitation token.' };
        }

        const inv = invitation.rows[0];

        if (inv.status !== 'pending' && inv.status !== 'sent') {
          return { ok: false, message: 'This invitation cannot be accepted.' };
        }

        if (new Date(inv.expires_at) < new Date()) {
          await client.query('UPDATE member_invitations SET status = $1 WHERE id = $2', ['expired', inv.id]);
          return { ok: false, message: 'This invitation has expired.' };
        }

        // Check if member already exists
        const existingMember = await client.query('SELECT id FROM members WHERE email = $1', [inv.email]);
        if (existingMember.rowCount) {
          return { ok: false, message: 'An account with this email already exists.' };
        }

        // Parse name
        const nameParts = inv.full_name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Create member account
        const passwordHash = createPasswordHash(password);
        const member = await client.query(
          `INSERT INTO members (email, password_hash, first_name, last_name, membership_grade, membership_status, email_verified)
           VALUES ($1, $2, $3, $4, $5, 'active', TRUE)
           RETURNING id, email, first_name, last_name, membership_grade`,
          [inv.email, passwordHash, firstName, lastName, inv.proposed_grade === 'graduate' ? 'student' : inv.proposed_grade]
        );

        // Update invitation status
        await client.query(
          `UPDATE member_invitations 
           SET status = 'accepted', accepted_at = NOW(), member_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [member.rows[0].id, inv.id]
        );

        // Create session
        const sessionToken = createSessionToken();
        const session = createSignedSession({ memberId: member.rows[0].id, role: 'member', token: sessionToken });

        return { ok: true, member: member.rows[0], session };
      });

      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, 400);

      return new Response(JSON.stringify({ ok: true, member: result.member }), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'set-cookie': sessionCookie(result.session),
        },
      });
    } catch (error) {
      console.error('Accept invitation failed:', error);
      return jsonResponse({ ok: false, message: 'Unable to accept invitation.' }, 503);
    }
  }

  // Admin actions
  const auth = requireAdmin(request);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  // List invitations
  if (request.method === 'GET' && action === 'list') {
    const status = url.searchParams.get('status');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 250);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

    try {
      const params = [];
      const clauses = [];

      if (status && VALID_STATUSES.includes(status)) {
        clauses.push('status = $1');
        params.push(status);
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const sql = `
        SELECT id, email, full_name, proposed_grade, qualification, affiliation, source, status, sent_at, accepted_at, expires_at, created_at
        FROM member_invitations
        ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const rows = await withDb(async (client) => client.query(sql, [...params, limit, offset]));
      return jsonResponse({ ok: true, items: rows.rows, count: rows.rows.length, role: auth.role });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to load invitations.' }, 503);
    }
  }

  // Send invitation email
  if (request.method === 'POST' && action === 'send') {
    if (auth.role !== 'secretariat') {
      return jsonResponse({ ok: false, message: 'Secretariat access is required to send invitations.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const id = body.id;

    if (!id) return jsonResponse({ ok: false, message: 'Invitation ID is required.' }, 400);

    try {
      const result = await withDb(async (client) => {
        const invitation = await client.query(
          'SELECT * FROM member_invitations WHERE id = $1',
          [id]
        );

        if (!invitation.rowCount) {
          return { ok: false, message: 'Invitation not found.' };
        }

        const inv = invitation.rows[0];

        if (inv.status !== 'pending') {
          return { ok: false, message: 'Invitation has already been sent.' };
        }

        const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
        const acceptUrl = `${siteUrl}/accept-invitation?token=${inv.invitation_token}`;

        // Send email
        try {
          await sendAcknowledgementEmail({
            kind: 'member-invitation',
            data: {
              email: inv.email,
              fullName: inv.full_name,
              grade: inv.proposed_grade,
              qualification: inv.qualification,
              acceptUrl
            }
          });
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError);
        }

        // Update status
        await client.query(
          'UPDATE member_invitations SET status = $1, sent_at = NOW(), updated_at = NOW() WHERE id = $2',
          ['sent', id]
        );

        return { ok: true, message: 'Invitation sent successfully.' };
      });

      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, 400);
      return jsonResponse(result);
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to send invitation.' }, 503);
    }
  }

  // Create manual invitation
  if (request.method === 'POST' && action === 'create') {
    if (auth.role !== 'secretariat') {
      return jsonResponse({ ok: false, message: 'Secretariat access is required to create invitations.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const { email, fullName, grade, qualification, affiliation } = body;

    if (!email || !fullName || !grade) {
      return jsonResponse({ ok: false, message: 'Email, full name, and grade are required.' }, 400);
    }

    if (!VALID_GRADES.includes(grade)) {
      return jsonResponse({ ok: false, message: 'Invalid grade.' }, 400);
    }

    try {
      const token = generateInvitationToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const result = await withDb(async (client) => {
        const existing = await client.query('SELECT id FROM member_invitations WHERE email = $1', [email]);
        if (existing.rowCount) {
          return { ok: false, message: 'An invitation for this email already exists.' };
        }

        await client.query(
          `INSERT INTO member_invitations 
           (email, full_name, proposed_grade, qualification, affiliation, invitation_token, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [email, fullName, grade, qualification || null, affiliation || null, token, expiresAt]
        );

        return { ok: true, token };
      });

      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, 400);
      return jsonResponse({ ok: true, message: 'Invitation created successfully.', token: result.token });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to create invitation.' }, 503);
    }
  }

  // Bulk send invitation emails
  if (request.method === 'POST' && action === 'bulk-send') {
    if (auth.role !== 'secretariat') {
      return jsonResponse({ ok: false, message: 'Secretariat access is required to send invitations.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const ids = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return jsonResponse({ ok: false, message: 'Invitation IDs are required.' }, 400);
    }

    try {
      const result = await withDb(async (client) => {
        const invitations = await client.query(
          'SELECT * FROM member_invitations WHERE id = ANY($1) AND status = $2',
          [ids, 'pending']
        );

        if (!invitations.rowCount) {
          return { ok: false, message: 'No pending invitations found.' };
        }

        const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
        let sent = 0;

        for (const inv of invitations.rows) {
          const acceptUrl = `${siteUrl}/accept-invitation?token=${inv.invitation_token}`;

          try {
            await sendAcknowledgementEmail({
              kind: 'member-invitation',
              data: {
                email: inv.email,
                fullName: inv.full_name,
                grade: inv.proposed_grade,
                qualification: inv.qualification,
                acceptUrl
              }
            });
          } catch (emailError) {
            console.error('Failed to send invitation email:', emailError);
            continue;
          }

          await client.query(
            'UPDATE member_invitations SET status = $1, sent_at = NOW(), updated_at = NOW() WHERE id = $2',
            ['sent', inv.id]
          );
          sent++;
        }

        return { ok: true, sent };
      });

      if (!result.ok) return jsonResponse({ ok: false, message: result.message }, 400);
      return jsonResponse({ ok: true, message: `Sent ${result.sent} invitations.`, sent: result.sent });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to send invitations.' }, 503);
    }
  }

  // Bulk update invitation status
  if (request.method === 'POST' && action === 'bulk-update-status') {
    if (auth.role !== 'secretariat') {
      return jsonResponse({ ok: false, message: 'Secretariat access is required to update invitations.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const { ids, status } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return jsonResponse({ ok: false, message: 'Invitation IDs are required.' }, 400);
    }

    if (!VALID_STATUSES.includes(status)) {
      return jsonResponse({ ok: false, message: 'Invalid status.' }, 400);
    }

    try {
      const result = await withDb(async (client) => {
        const updated = await client.query(
          `UPDATE member_invitations SET status = $1, updated_at = NOW() WHERE id = ANY($2) RETURNING id`,
          [status, ids]
        );

        return { ok: true, updated: updated.rowCount };
      });

      return jsonResponse({ ok: true, message: `Updated ${result.updated} invitations.`, updated: result.updated });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to update invitations.' }, 503);
    }
  }

  // Delete invitations that have not been accepted (accepted ones stay as a record of how the member joined)
  if (request.method === 'POST' && action === 'delete') {
    if (auth.role !== 'secretariat') {
      return jsonResponse({ ok: false, message: 'Secretariat access is required to delete invitations.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
    if (ids.length === 0 || ids.length > 500 || !ids.every((id) => typeof id === 'string' && uuid.test(id))) {
      return jsonResponse({ ok: false, message: 'Valid invitation IDs are required.' }, 400);
    }

    try {
      const deleted = await withDb((client) => client.query(
        `DELETE FROM member_invitations WHERE id = ANY($1::uuid[]) AND status <> 'accepted' RETURNING id`,
        [ids]
      ));
      if (deleted.rowCount === 0) {
        return jsonResponse({ ok: false, message: 'Nothing was deleted. Accepted invitations cannot be deleted.' }, 400);
      }
      return jsonResponse({ ok: true, message: `Deleted ${deleted.rowCount} invitation${deleted.rowCount === 1 ? '' : 's'}.`, deleted: deleted.rowCount });
    } catch (error) {
      return jsonResponse({ ok: false, message: 'Unable to delete invitations.' }, 503);
    }
  }

  return jsonResponse({ ok: false, message: 'Unsupported action or method.' }, 400);
}
