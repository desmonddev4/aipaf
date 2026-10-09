// Tiny local preview server: builds, then serves dist/ with clean URLs. Usage: npm run dev
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'inherit' });
const dist = join(root, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.webm': 'video/webm', '.xml': 'application/xml', '.txt': 'text/plain' };
const port = process.env.PORT || 3000;

createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index';
  let file = join(dist, p);
  if (!extname(file)) file += '.html';
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(readFileSync(join(dist, '404.html')));
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`AIPAF site on http://localhost:${port}`));
