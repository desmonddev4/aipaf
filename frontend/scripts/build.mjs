// Zero-dependency static build for Vercel.
// Wraps page and admin fragments with src/partials/layout.html and copies public/ to dist/.
// Page metadata is the JSON comment on the first line of each page file.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE_URL = process.env.SITE_URL || 'https://aipafgh.org'; // TODO: set SITE_URL in Vercel once the domain is final
const API_BASE_URL = process.env.API_BASE_URL || 'https://aipaf-backend.onrender.com'; // Render backend URL

const read = (p) => readFileSync(join(root, p), 'utf8');
const partial = (name) => read(`src/partials/${name}.html`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });
cpSync(join(root, 'src/admin/js'), join(dist, 'js/admin'), { recursive: true });

// Update API_BASE_URL in config.js for production
const configPath = join(dist, 'js', 'config.js');
const configContent = readFileSync(configPath, 'utf8');
const updatedConfig = configContent.replace(
  /export const API_BASE_URL = '[^']*';/,
  `export const API_BASE_URL = '${API_BASE_URL}';`
);
writeFileSync(configPath, updatedConfig, 'utf8');

const layout = partial('layout');
const header = partial('Navbar');
const footer = partial('footer');
const memberHeader = partial('member-nav');
const adminSidebar = read('src/admin/partials/sidebar.html').trim();
const sidebarMarker = '<!--ADMIN_SIDEBAR-->';
const year = new Date().getFullYear();

function renderPage(raw, meta, slug) {
  const isMemberPage = meta.layout === 'member';
  const nav = (isMemberPage ? memberHeader : header).replace(/\{\{cur:([a-z-]+)\}\}/g, (_, item) => (item === (isMemberPage ? slug : meta.nav) ? 'aria-current="page"' : ''));
  const isAdminPage = /^(admin(?:-|$)|cms-admin$)/.test(slug);
  const content = isAdminPage
    ? raw
      .replace(/<main(?=[\s>])/g, '<div')
      .replace(/<\/main>/g, '</div>')
      .replaceAll('class="admin-content"', 'class="admin-content admin-main"')
    : raw;
  return layout
    .replace('{{header}}', isAdminPage ? '' : nav)
    .replace('{{footer}}', isAdminPage || isMemberPage ? '' : footer)
    .replace('{{content}}', content)
    .replaceAll('{{title}}', meta.title)
    .replaceAll('{{description}}', meta.description)
    .replaceAll('{{canonical}}', SITE_URL + (slug === 'index' ? '' : `/${slug}`))
    .replaceAll('{{siteUrl}}', SITE_URL)
    .replaceAll('{{bodyClass}}', meta.bodyClass || 'page-inner')
    .replaceAll('{{robots}}', meta.noindex ? 'noindex, follow' : 'index, follow')
    .replaceAll('{{year}}', String(year));
}

// Process pages from src/pages (require metadata and layout)
const pageDirectory = 'src/pages';
const pages = readdirSync(join(root, pageDirectory))
  .filter((file) => file.endsWith('.html'))
  .map((file) => ({ file, directory: pageDirectory }));
const sitemap = [];

for (const page of pages) {
  const raw = read(`${page.directory}/${page.file}`);
  if (/^\s*<!doctype html>/i.test(raw)) { writeFileSync(join(dist, page.file), raw); continue; }
  const m = raw.match(/^<!--(\{[\s\S]*?\})-->/);
  if (!m) throw new Error(`${page.file}: missing JSON metadata comment on first line`);
  const meta = JSON.parse(m[1]);
  const content = raw.slice(m[0].length);
  const slug = page.file.replace(/\.html$/, '');
  const urlPath = slug === 'index' ? '/' : `/${slug}`;
  writeFileSync(join(dist, page.file), renderPage(content, meta, slug));
  if (!meta.noindex) sitemap.push(SITE_URL + (urlPath === '/' ? '/' : urlPath));
}

// Admin pages are standalone documents that embed their own CSS. Pages containing
// <!--ADMIN_SIDEBAR--> get the sidebar partial (markup + its own CSS) injected.
// The CMS page is still a layout fragment.
const adminDir = 'src/admin/pages';
if (existsSync(join(root, adminDir))) {
  const adminPages = readdirSync(join(root, adminDir))
    .filter((file) => file.endsWith('.html'));
  for (const file of adminPages) {
    const raw = read(`${adminDir}/${file}`);
    if (/^\s*<!doctype html>/i.test(raw)) {
      if (raw.includes(sidebarMarker)) writeFileSync(join(dist, file), raw.replace(sidebarMarker, () => adminSidebar));
      else writeFileSync(join(dist, file), raw);
      continue;
    }

    const metadataMatch = raw.match(/^<!--(\{[\s\S]*?\})-->/);
    if (!metadataMatch) throw new Error(`${file}: missing JSON metadata comment on first line`);
    const meta = JSON.parse(metadataMatch[1]);
    const slug = file.replace(/\.html$/, '');
    let content = raw.slice(metadataMatch[0].length);
    writeFileSync(join(dist, file), renderPage(content, meta, slug));
  }
}

writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`
);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Built ${pages.length} pages to dist/`);
