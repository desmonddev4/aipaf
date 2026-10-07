import { withDb } from './db.mjs';
import { jsonResponse } from './_shared.mjs';
import { requireAdmin } from './_auth.mjs';
import { validateCmsContent } from './member-core.mjs';

const CONTENT_TYPES = ['page', 'news', 'publication', 'event', 'download'];

function parseJsonBody(request) {
  return request.json().catch(() => ({}));
}

async function listContent(type, status = 'published') {
  return withDb(async (client) => {
    const result = await client.query(
      `SELECT id, type, slug, title, summary, body, status, published_at, metadata, created_at
       FROM cms_content
       WHERE type = $1 AND status = $2
       ORDER BY published_at DESC NULLS LAST, created_at DESC`,
      [type, status],
    );
    return result.rows;
  });
}

async function getContentBySlug(slug) {
  const result = await withDb(async (client) => client.query(
    'SELECT id, type, slug, title, summary, body, status, published_at, metadata, created_at FROM cms_content WHERE slug = $1',
    [slug],
  ));
  return result.rows[0] || null;
}

async function deleteContent(slug) {
  const result = await withDb(async (client) => client.query(
    'DELETE FROM cms_content WHERE slug = $1 RETURNING id',
    [slug],
  ));
  return result.rowCount > 0;
}

async function saveContent(body, authorMemberId) {
  const data = validateCmsContent(body);
  if (!data.ok) throw new Error(data.message);

  const status = data.data.status || 'draft';
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

  await withDb(async (client) => {
    await client.query(
      `INSERT INTO cms_content (type, slug, title, summary, body, status, published_at, metadata, author_member_id)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 = 'published' THEN NOW() ELSE NULL END, $7, $8)
       ON CONFLICT (slug) DO UPDATE SET
         type = EXCLUDED.type,
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         body = EXCLUDED.body,
         status = EXCLUDED.status,
         published_at = CASE WHEN EXCLUDED.status = 'published' THEN COALESCE(cms_content.published_at, NOW()) ELSE NULL END,
         metadata = EXCLUDED.metadata,
         author_member_id = EXCLUDED.author_member_id,
         updated_at = NOW()`,
      [data.data.type, data.data.slug, data.data.title, data.data.summary, data.data.body, status, metadata, authorMemberId || null],
    );
  });
}

export default async function handler(request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const status = url.searchParams.get('status') || 'published';
  const slug = url.searchParams.get('slug');

  const auth = status !== 'published' || slug ? requireAdmin(request) : null;
  if (request.method === 'GET') {
    if (slug) {
      if (auth?.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);
      const item = await getContentBySlug(slug);
      if (!item) return jsonResponse({ ok: false, message: 'Content not found.' }, 404);
      if (item.status !== 'published' && (!auth || auth.role !== 'secretariat')) {
        return jsonResponse({ ok: false, message: 'Content is not published.' }, 404);
      }
      return jsonResponse({ ok: true, item });
    }

    if (!type || !CONTENT_TYPES.includes(type)) {
      return jsonResponse({ ok: false, message: 'Unsupported content type.' }, 400);
    }
    if (auth?.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);
    const requestedStatus = status === 'draft' || status === 'archived' ? status : 'published';
    return jsonResponse({ ok: true, items: await listContent(type, requestedStatus) });
  }

  if (request.method === 'DELETE') {
    const deleteAuth = requireAdmin(request);
    if (deleteAuth.status) return jsonResponse({ ok: false, message: deleteAuth.message }, deleteAuth.status);
    if (deleteAuth.role !== 'secretariat') return jsonResponse({ ok: false, message: 'Secretariat access is required to delete content.' }, 403);
    if (!slug) return jsonResponse({ ok: false, message: 'Content slug is required.' }, 400);
    const deleted = await deleteContent(slug);
    if (!deleted) return jsonResponse({ ok: false, message: 'Content not found.' }, 404);
    return jsonResponse({ ok: true, message: 'Content deleted.' });
  }

  if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);

  const postAuth = requireAdmin(request);
  if (postAuth.status) return jsonResponse({ ok: false, message: postAuth.message }, postAuth.status);
  if (postAuth.role !== 'secretariat') {
    return jsonResponse({ ok: false, message: 'Secretariat access is required to update content.' }, 403);
  }

  const body = await parseJsonBody(request);
  try {
    await saveContent(body, null);
    return jsonResponse({ ok: true, message: 'Content saved.' });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message || 'Unable to save content.' }, 400);
  }
}
