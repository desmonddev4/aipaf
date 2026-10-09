// Render API-only server for AIPAF backend
// Frontend is deployed separately on Vercel
import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = process.env.PORT || 3000;
// Allow multiple frontend origins
const ALLOWED_ORIGINS = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['https://www.aipafgh.org', 'https://aipafgh.org', 'http://localhost:3000', '*'];

console.log('AIPAF API server starting...');

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const origin = req.headers.origin;

  // Determine the allowed origin for CORS
  const allowedOrigin = ALLOWED_ORIGINS.includes('*') 
    ? '*' 
    : (origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    const preflightHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': allowedOrigin !== '*' ? 'true' : 'false',
      'Access-Control-Max-Age': '86400',
    };
    if (allowedOrigin !== '*') {
      preflightHeaders['Vary'] = 'Origin';
    }
    res.writeHead(204, preflightHeaders);
    return res.end();
  }

  // Only handle API routes
  if (!pathname.startsWith('/api/')) {
    const errorHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': allowedOrigin !== '*' ? 'true' : 'false',
    };
    if (allowedOrigin !== '*') {
      errorHeaders['Vary'] = 'Origin';
    }
    res.writeHead(404, errorHeaders);
    return res.end(JSON.stringify({ ok: false, message: 'API only server. Frontend is on Vercel.' }));
  }

  try {
    await handleApiRequest(req, res, pathname, req.headers.origin);
  } catch (error) {
    console.error('API error:', error);
    const errorHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': allowedOrigin !== '*' ? 'true' : 'false',
    };
    if (allowedOrigin !== '*') {
      errorHeaders['Vary'] = 'Origin';
    }
    res.writeHead(500, errorHeaders);
    res.end(JSON.stringify({ ok: false, message: 'Internal server error.' }));
  }
}).listen(port, () => console.log(`AIPAF API server running on port ${port}`));

async function handleApiRequest(req, res, pathname, origin) {
  const apiPath = pathname.replace(/^\/api\//, '').replace(/^\/api$/, '');
  
  // Determine the allowed origin for CORS
  const allowedOrigin = ALLOWED_ORIGINS.includes('*') 
    ? '*' 
    : (origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);

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
    'admin/users': () => import('./src/server/handlers/api/admin/users.mjs').then((module) => module.default),
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
    const errorHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': allowedOrigin !== '*' ? 'true' : 'false',
    };
    if (allowedOrigin !== '*') {
      errorHeaders['Vary'] = 'Origin';
    }
    res.writeHead(404, errorHeaders);
    return res.end(JSON.stringify({ ok: false, message: 'Route not found.' }));
  }

  const handlerFunction = await route();
  
  // Convert Node.js request to Vercel-like Request object
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

  // Add CORS headers for Vercel frontend
  headers['Access-Control-Allow-Origin'] = allowedOrigin;
  headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cookie';
  headers['Access-Control-Allow-Credentials'] = allowedOrigin !== '*' ? 'true' : 'false';
  if (allowedOrigin !== '*') {
    headers['Vary'] = 'Origin';
  }
  
  res.writeHead(response.status, headers);
  const responseBody = await response.text();
  res.end(responseBody);
}

function getRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}
