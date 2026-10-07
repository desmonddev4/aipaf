import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAdmin } from '../_auth.mjs';

const root = join(fileURLToPath(new URL('../../../..', import.meta.url)), 'src', 'admin', 'pages');

export default function handler(request) {
  const auth = requireAdmin(request);
  if (auth.status) {
    return new Response(JSON.stringify({ ok: false, message: auth.message }), {
      status: auth.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const pageName = new URL(request.url).pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  const filePath = join(root, `${pageName === 'cms-admin' ? 'cms-admin' : 'admin'}.html`);
  const html = readFileSync(filePath, 'utf8');

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
