// Render-compatible Node.js server for AIPAF website
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '.');
const dist = join(root, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.webm': 'video/webm', '.xml': 'application/xml', '.txt': 'text/plain' };
const port = process.env.PORT || 3000;

// Build on startup for Render
console.log('Building static files...');
try {
  execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'inherit' });
  console.log('Build complete.');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // API routes - delegate to Vercel-style handler
  if (pathname.startsWith('/api/')) {
    handleApiRequest(req, res, pathname);
    return;
  }

  // Static file serving
  let p = decodeURIComponent(pathname);
  if (p === '/') p = '/index';
  let file = join(dist, p);
  if (!extname(file)) file += '.html';
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(readFileSync(join(dist, '404.html')));
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`AIPAF server running on port ${port}`));

async function handleApiRequest(req, res, pathname) {
  try {
    const apiPath = pathname.replace(/^\/api\//, '').replace(/^\/api$/, '');
    const routeMap = {
      'contact': () => import('./src/server/handlers/api/contact.mjs').then((module) => module.default),
      'membership-interest': () => import('./src/server/handlers/api/membership-interest.mjs').then((module) => module.default),
      'members': () => import('./src/server/handlers/api/members.mjs').then((module) => module.default),
      'member-profile': () => import('./src/server/handlers/api/member-profile.mjs').then((module) => module.default),
      'member-directory': () => import('./src/server/handlers/api/member-directory.mjs').then((module) => module.default),
      'member-records': () => import('./src/server/handlers/api/member-records.mjs').then((module) => module.default),
      'member-applications': () => import('./src/server/handlers/api/member-applications.mjs').then((module) => module.default),
      'member-invitations': () => import('./src/server/handlers/api/member-invitations.mjs').then((module) => module.default),
      'certificates': () => import('./src/server/handlers/api/certificates.mjs').then((module) => module.default),
      'cms': () => import('./src/server/handlers/api/cms.mjs').then((module) => module.default),
      'data-deletion': () => import('./src/server/handlers/api/data-deletion.mjs').then((module) => module.default),
      'health': () => import('./src/server/handlers/api/health.mjs').then((module) => module.default),
      'admin/session': () => import('./src/server/handlers/api/admin/session.mjs').then((module) => module.default),
      'admin/submissions': () => import('./src/server/handlers/api/admin/submissions.mjs').then((module) => module.default),
      'admin/members': () => import('./src/server/handlers/api/admin/members.mjs').then((module) => module.default),
      'admin/payments': () => import('./src/server/handlers/api/admin/payments.mjs').then((module) => module.default),
      'admin/examinations': () => import('./src/server/handlers/api/admin/examinations.mjs').then((module) => module.default),
      'admin/applications': () => import('./src/server/handlers/api/admin/applications.mjs').then((module) => module.default),
      'admin/records': () => import('./src/server/handlers/api/admin/records.mjs').then((module) => module.default),
      'admin/reports': () => import('./src/server/handlers/api/admin/reports.mjs').then((module) => module.default),
      'admin/data-deletion': () => import('./src/server/handlers/api/admin/data-deletion.mjs').then((module) => module.default),
      'admin/audit': () => import('./src/server/handlers/api/admin/audit.mjs').then((module) => module.default),
    };

    const route = routeMap[apiPath] || routeMap[apiPath.replace(/\/$/, '')];

    if (!route) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, message: 'Route not found.' }));
    }

    const handlerFunction = await route();
    
    // Convert Node.js request to Vercel-like Request object
    const url = new URL(req.url, `http://${req.headers.host}`);
    const body = await getRequestBody(req);
    
    const request = {
      url: url.toString(),
      method: req.method,
      headers: new Headers(req.headers),
      json: async () => JSON.parse(body),
      text: async () => body,
    };

    const response = await handlerFunction(request);
    
    // Convert Vercel-like Response to Node.js response
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    res.writeHead(response.status, headers);
    const responseBody = await response.text();
    res.end(responseBody);
  } catch (error) {
    console.error('API error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, message: 'Internal server error.' }));
  }
}

function getRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}
