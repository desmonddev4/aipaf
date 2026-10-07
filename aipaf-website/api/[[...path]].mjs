const routeMap = {
  'contact': () => import('../src/server/handlers/api/contact.mjs').then((module) => module.default),
  'membership-interest': () => import('../src/server/handlers/api/membership-interest.mjs').then((module) => module.default),
  'members': () => import('../src/server/handlers/api/members.mjs').then((module) => module.default),
  'member-profile': () => import('../src/server/handlers/api/member-profile.mjs').then((module) => module.default),
  'member-directory': () => import('../src/server/handlers/api/member-directory.mjs').then((module) => module.default),
  'member-records': () => import('../src/server/handlers/api/member-records.mjs').then((module) => module.default),
  'certificates': () => import('../src/server/handlers/api/certificates.mjs').then((module) => module.default),
  'cms': () => import('../src/server/handlers/api/cms.mjs').then((module) => module.default),
  'health': () => import('../src/server/handlers/api/health.mjs').then((module) => module.default),
  'admin/session': () => import('../src/server/handlers/api/admin/session.mjs').then((module) => module.default),
  'admin/submissions': () => import('../src/server/handlers/api/admin/submissions.mjs').then((module) => module.default),
  'admin/members': () => import('../src/server/handlers/api/admin/members.mjs').then((module) => module.default),
  'admin/records': () => import('../src/server/handlers/api/admin/records.mjs').then((module) => module.default),
  'admin/reports': () => import('../src/server/handlers/api/admin/reports.mjs').then((module) => module.default),
};

export default async function handler(request) {
  const path = new URL(request.url).pathname.replace(/^\/api\//, '').replace(/^\/api$/, '');
  const route = routeMap[path] || routeMap[path.replace(/\/$/, '')];

  if (!route) {
    return new Response(JSON.stringify({ ok: false, message: 'Route not found.' }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const handlerFunction = await route();
  return handlerFunction(request);
}
