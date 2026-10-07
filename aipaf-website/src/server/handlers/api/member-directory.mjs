import { withDb } from './db.mjs';
import { jsonResponse } from './_shared.mjs';

export function normalizeDirectoryMember(input = {}) {
  if (!input.profile_public || input.membership_status !== 'active') {
    return { ok: false, message: 'Member profile is not publicly visible.' };
  }

  const id = String(input.id || '').trim();
  if (!id) return { ok: false, message: 'Member identifier is required.' };

  return {
    ok: true,
    member: {
      id,
      name: `${String(input.first_name || '').trim()} ${String(input.last_name || '').trim()}`.trim(),
      country: String(input.country || '').trim(),
      organisation: String(input.organisation || '').trim(),
      designation: String(input.designation || '').trim(),
      membership_grade: String(input.membership_grade || '').trim(),
      profile_public: true,
      public_email: String(input.public_email || '').trim(),
      bio: String(input.bio || '').trim(),
      website: String(input.website || '').trim(),
      linked_in: String(input.linked_in || '').trim(),
    },
  };
}

export default async function handler(request) {
  if (request.method !== 'GET') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);

  const url = new URL(request.url);
  const search = String(url.searchParams.get('search') || '').trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100);

  const rows = await withDb(async (client) => client.query(
    `SELECT m.id, m.first_name, m.last_name, m.country, m.organisation, m.designation, m.membership_grade, m.membership_status, m.profile_public,
            p.public_email, p.bio, p.website, p.linked_in
     FROM members m
     LEFT JOIN member_profiles p ON p.member_id = m.id
     WHERE m.profile_public = TRUE
       AND m.membership_status = 'active'
       AND (m.first_name ILIKE $1 OR m.last_name ILIKE $1 OR m.organisation ILIKE $1 OR m.designation ILIKE $1 OR m.country ILIKE $1)
     ORDER BY m.last_name ASC, m.first_name ASC
     LIMIT $2`,
    [`%${search}%`, limit],
  ));

  const items = rows.rows.map((row) => normalizeDirectoryMember(row)).filter((item) => item.ok).map((item) => item.member);
  return jsonResponse({ ok: true, items, count: items.length });
}
