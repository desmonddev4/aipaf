const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_FIELDS = {
  contact: { name: 100, email: 254, topic: 120, message: 2000, _page: 200 },
  membership: {
    name: 100,
    email: 254,
    organisation: 150,
    country: 80,
    registering_as: 120,
    area_of_practice: 120,
    message: 2000,
    _page: 200,
  },
};

const FIELD_RULES = {
  contact: [
    ['name', 'string', 2, 100],
    ['email', 'email'],
    ['topic', 'string', 1, 120],
    ['message', 'string', 20, 2000],
  ],
  membership: [
    ['name', 'string', 2, 100],
    ['email', 'email'],
    ['country', 'string', 2, 80],
    ['registering_as', 'string', 2, 120],
    ['area_of_practice', 'string', 0, 120],
    ['message', 'string', 0, 2000],
  ],
};

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function strictString(value) {
  return normalizeText(value).slice(0, 5000);
}

function validateField(name, value, rule) {
  const clean = normalizeText(value);
  if (rule[1] === 'email') {
    if (!EMAIL_RE.test(clean)) return `${name} must be a valid email address.`;
    return null;
  }
  if (rule[1] === 'string') {
    if (clean.length < rule[2] || clean.length > rule[3]) return `${name} must be ${rule[2]} to ${rule[3]} characters.`;
    return null;
  }
  return null;
}

export function buildSubmission(kind, raw) {
  const fields = { ...(raw || {}) };
  const max = MAX_FIELDS[kind] || {};
  const submission = {};

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'website' || key.startsWith('_')) {
      submission[key] = value;
      continue;
    }
    if (key === 'consent') {
      submission.consent = value === true || value === 'true';
      continue;
    }
    const clean = strictString(value);
    submission[key] = max[key] ? clean.slice(0, max[key]) : clean;
  }

  return submission;
}

export function getValidationError(kind, raw) {
  if (!kind || !FIELD_RULES[kind]) return { message: 'Unsupported form type.', status: 400 };

  const submission = buildSubmission(kind, raw);
  const rules = FIELD_RULES[kind];
  for (const rule of rules) {
    const [name, type, min, max] = rule;
    const value = submission[name] ?? '';
    const error = validateField(name, value, rule);
    if (error) return { message: error, status: 400 };
    if (type === 'string' && value.length > max) {
      return { message: `${name} must be ${min} to ${max} characters.`, status: 400 };
    }
  }

  const email = submission.email?.toLowerCase();
  if (email && !EMAIL_RE.test(email)) return { message: 'Email must be a valid email address.', status: 400 };
  if (submission.consent !== true) return { message: 'You must consent to the privacy notice before submitting.', status: 400 };

  const elapsed = Number(raw?._elapsedMs);
  if (!Number.isFinite(elapsed) || elapsed < 2000) {
    return { message: 'Submission was too quick. Please try again.', status: 400 };
  }

  const page = normalizeText(raw?._page);
  if (!page || page.length > 200 || !/^\/?[A-Za-z0-9/_#?&=-]*$/.test(page)) {
    return { message: 'Invalid page reference.', status: 400 };
  }

  submission.email = email;
  submission._elapsedMs = Math.max(0, Math.min(elapsed, 60_000));
  submission._page = page;
  return null;
}

export function checkSpamSignals({ website, _elapsedMs, ip } = {}) {
  if (website && String(website).trim()) {
    return { message: 'The honeypot was triggered.', status: 403 };
  }
  if (Number(_elapsedMs) < 2000) {
    return { message: 'Submission was too quick. Please try again.', status: 403 };
  }
  if (!ip) return null;
  return null;
}

export function createRateLimiter({ limit = 5, windowMs = 60_000 } = {}) {
  const requests = new Map();
  return (ip) => {
    const now = Date.now();
    const key = String(ip || 'unknown');
    const previous = requests.get(key) || [];
    const current = previous.filter((time) => now - time < windowMs);
    current.push(now);
    requests.set(key, current);
    if (current.length > limit) {
      current.shift();
      return false;
    }
    return true;
  };
}

export function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || 'unknown';
}

export function jsonResponse(body, status = 200) {
  const httpStatus = Number.isInteger(status) ? status : 200;
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function corsResponse(handler) {
  return handler;
}
