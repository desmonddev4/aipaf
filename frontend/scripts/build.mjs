// Zero-dependency static build for Vercel.
// Wraps every file in src/pages/ with src/partials/layout.html and copies public/ to dist/.
// Page metadata is the JSON comment on the first line of each page file.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE_URL = process.env.SITE_URL || 'https://aipafgh.org'; // TODO: set SITE_URL in Vercel once the domain is final
const API_BASE_URL = process.env.API_BASE_URL || 'https://aipaf-website.onrender.com'; // Render backend URL

const read = (p) => readFileSync(join(root, p), 'utf8');
const partial = (name) => read(`src/partials/${name}.html`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });

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
const year = new Date().getFullYear();

// Process pages from src/pages (require metadata and layout)
const pageDirectory = 'src/pages';
const pages = readdirSync(join(root, pageDirectory))
  .filter((file) => file.endsWith('.html'))
  .map((file) => ({ file, directory: pageDirectory }));
const sitemap = [];

for (const page of pages) {
  const raw = read(`${page.directory}/${page.file}`);
  const m = raw.match(/^<!--(\{[\s\S]*?\})-->/);
  if (!m) throw new Error(`${page.file}: missing JSON metadata comment on first line`);
  const meta = JSON.parse(m[1]);
  const content = raw.slice(m[0].length);
  const slug = page.file.replace(/\.html$/, '');
  const urlPath = slug === 'index' ? '/' : `/${slug}`;

  const nav = header.replace(/\{\{cur:([a-z-]+)\}\}/g, (_, s) => (s === meta.nav ? 'aria-current="page"' : ''));

  const html = layout
    .replace('{{header}}', nav)
    .replace('{{footer}}', footer)
    .replace('{{content}}', content)
    .replaceAll('{{title}}', meta.title)
    .replaceAll('{{description}}', meta.description)
    .replaceAll('{{canonical}}', SITE_URL + (urlPath === '/' ? '' : urlPath))
    .replaceAll('{{siteUrl}}', SITE_URL)
    .replaceAll('{{bodyClass}}', meta.bodyClass || 'page-inner')
    .replaceAll('{{robots}}', meta.noindex ? 'noindex, follow' : 'index, follow')
    .replaceAll('{{year}}', String(year));

  writeFileSync(join(dist, page.file), html);
  if (!meta.noindex) sitemap.push(SITE_URL + (urlPath === '/' ? '/' : urlPath));
}

// Copy admin pages as-is (standalone HTML files)
const adminDir = 'src/admin/pages';
if (existsSync(join(root, adminDir))) {
  const adminPages = readdirSync(join(root, adminDir))
    .filter((file) => file.endsWith('.html'));
  for (const file of adminPages) {
    const raw = read(`${adminDir}/${file}`);
    writeFileSync(join(dist, file), raw);
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
