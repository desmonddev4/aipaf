import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAdmin } from '../_auth.mjs';

const siteRoot = fileURLToPath(new URL('../../../../../frontend', import.meta.url));
const pageRoot = join(siteRoot, 'src', 'admin', 'pages');

function renderAdminPage(request, pageName) {
  // Map paths to HTML files
  const pageMap = {
    'admin': 'admin',
    'admin-members': 'admin-members',
    'admin-payments': 'admin-payments',
    'admin-examinations': 'admin-examinations',
    'admin-certificates': 'admin-certificates',
    'admin-invitations': 'admin-invitations',
    'admin-applications': 'admin-applications',
    'admin-records': 'admin-records',
    'admin-data-deletion': 'admin-data-deletion',
    'admin-audit': 'admin-audit',
    'cms-admin': 'cms-admin',
  };

  const page = pageMap[pageName] || 'admin';
  const raw = readFileSync(join(pageRoot, `${page}.html`), 'utf8');
  const metadataMatch = raw.match(/^<!--(\{[\s\S]*?\})-->/);
  const metadata = metadataMatch ? JSON.parse(metadataMatch[1]) : {
    title: (raw.match(/<title>([^<]+)<\/title>/i) || [null, 'Admin'])[1].trim(),
    description: (raw.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) || [null, 'Administrative access for AIPAF.'])[1].trim(),
    nav: 'admin',
    bodyClass: 'page-inner',
    noindex: true,
  };

  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1].trim() : raw.trim();
  const header = readFileSync(join(siteRoot, 'src', 'partials', 'Navbar.html'), 'utf8')
    .replace(/\{\{cur:([a-z-]+)\}\}/g, (_, slug) => (slug === metadata.nav ? 'aria-current="page"' : ''));
  const footer = readFileSync(join(siteRoot, 'src', 'partials', 'footer.html'), 'utf8');
  const url = new URL(request.url);
  const canonical = `${url.origin}/${pageName}`;

  let html = readFileSync(join(siteRoot, 'src', 'partials', 'layout.html'), 'utf8')
    .replace('{{header}}', header)
    .replace('{{footer}}', footer)
    .replace('{{content}}', content)
    .replaceAll('{{title}}', metadata.title)
    .replaceAll('{{description}}', metadata.description)
    .replaceAll('{{canonical}}', canonical)
    .replaceAll('{{siteUrl}}', url.origin)
    .replaceAll('{{bodyClass}}', metadata.bodyClass || 'page-inner')
    .replaceAll('{{robots}}', metadata.noindex ? 'noindex, follow' : 'index, follow')
    .replaceAll('{{year}}', String(new Date().getFullYear()));

  if (pageName === 'admin' || pageName.startsWith('admin-') || pageName === 'cms-admin') {
    html = html.replace('</head>', '  <link rel="stylesheet" href="/css/admin.css">\n</head>');
  }

  return html;
}

export default function handler(request) {
  const pageName = new URL(request.url).pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  const auth = requireAdmin(request);
  if (auth.status) {
    if (pageName === 'admin') {
      return new Response(null, {
        status: 302,
        headers: { location: '/admin-login', 'cache-control': 'no-store' },
      });
    }
    return new Response(JSON.stringify({ ok: false, message: auth.message }), {
      status: auth.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const html = renderAdminPage(request, pageName);

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
