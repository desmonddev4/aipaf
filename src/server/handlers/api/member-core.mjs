import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateMemberRegistration({ firstName, lastName, email, password }) {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  const address = String(email || '').trim().toLowerCase();
  const pass = String(password || '');

  if (!first || first.length > 100) return { ok: false, message: 'First name is required.' };
  if (!last || last.length > 100) return { ok: false, message: 'Last name is required.' };
  if (!EMAIL_RE.test(address)) return { ok: false, message: 'Enter a valid email address.' };
  if (pass.length < PASSWORD_MIN_LENGTH) return { ok: false, message: 'Password must be at least 8 characters.' };

  return {
    ok: true,
    data: {
      firstName: first,
      lastName: last,
      email: address,
      password,
    },
  };
}

export function validateMemberPasswordChange({ currentPassword, newPassword }) {
  const current = String(currentPassword || '');
  const next = String(newPassword || '');

  if (!current) return { ok: false, message: 'Current password is required.' };
  if (next.length < PASSWORD_MIN_LENGTH) return { ok: false, message: 'Password must be at least 8 characters.' };
  if (current === next) return { ok: false, message: 'New password must be different from the current password.' };

  return { ok: true, data: { currentPassword: current, newPassword: next } };
}

export function createPasswordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, hashValue) {
  if (!hashValue || typeof hashValue !== 'string') return false;
  const [salt, expected] = hashValue.split(':');
  if (!salt || !expected) return false;
  const candidate = scryptSync(password, salt, 64).toString('hex');
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(candidate, 'hex'));
}

function normalizeUrl(value, fieldName) {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
    return url.toString();
  } catch {
    return { ok: false, message: `Enter a valid ${fieldName}.` };
  }
}

function sanitizeProfileHtml(value) {
  const raw = String(value || '').trim();
  const cleaned = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/<\/?(?:script|iframe|object|embed|svg|math)[^>]*>/gi, '');

  return cleaned
    .replace(/<(?!\/?(?:p|br|strong|em|ul|ol|li|a)\b)[^>]+>/gi, '')
    .replace(/<\/?(p|br|strong|em|ul|ol|li|a)(?:\s+[^>]*)?>/gi, (tag) => tag)
    .slice(0, 2000);
}

export function validateMemberProfile(input = {}) {
  const firstName = String(input.firstName || '').trim();
  const lastName = String(input.lastName || '').trim();
  const country = String(input.country || '').trim().slice(0, 80);
  const organisation = String(input.organisation || '').trim().slice(0, 150);
  const designation = String(input.designation || '').trim().slice(0, 150);
  const bio = sanitizeProfileHtml(input.bio);
  const phone = String(input.phone || '').trim().slice(0, 40);
  const websiteResult = normalizeUrl(input.website, 'website');
  const linkedInResult = normalizeUrl(input.linkedIn, 'LinkedIn profile');
  const publicEmail = String(input.publicEmail || '').trim().toLowerCase();

  if (firstName.length > 100) return { ok: false, message: 'First name is too long.' };
  if (lastName.length > 100) return { ok: false, message: 'Last name is too long.' };
  if (country && country.length < 2) return { ok: false, message: 'Country must contain at least two characters.' };
  if (organisation.length > 150) return { ok: false, message: 'Organisation is too long.' };
  if (designation.length > 150) return { ok: false, message: 'Designation is too long.' };
  if (phone && phone.length < 6) return { ok: false, message: 'Phone number is too short.' };
  if (websiteResult && websiteResult.ok === false) return websiteResult;
  if (linkedInResult && linkedInResult.ok === false) return linkedInResult;
  if (publicEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(publicEmail)) return { ok: false, message: 'Enter a valid public email address.' };

  return {
    ok: true,
    data: {
      firstName,
      lastName,
      country,
      organisation,
      designation,
      bio,
      phone,
      website: websiteResult && websiteResult.ok === false ? null : websiteResult,
      linkedIn: linkedInResult && linkedInResult.ok === false ? null : linkedInResult,
      publicEmail,
    },
  };
}

export function sanitizeCmsInput(input = {}) {
  const type = ['page', 'news', 'publication', 'event', 'download'].includes(input.type) ? input.type : 'page';
  const slug = String(input.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  const title = String(input.title || '').trim().slice(0, 180);
  const summary = String(input.summary || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim().slice(0, 500);
  const body = String(input.body || '').replace(/<script[\s\S]*?<\/script>/gi, '').trim();

  return { type, slug, title, summary, body };
}

export function validateCmsContent(input = {}) {
  const requestedType = String(input.type || '').trim().toLowerCase();
  const content = sanitizeCmsInput({ ...input, type: requestedType });
  const status = ['draft', 'published', 'archived'].includes(input.status) ? input.status : null;

  if (!content.slug || !content.title) return { ok: false, message: 'Slug and title are required.' };
  if (!['page', 'news', 'publication', 'event', 'download'].includes(requestedType)) {
    return { ok: false, message: 'Unsupported content type.' };
  }
  if (status === null && input.status !== undefined) {
    return { ok: false, message: 'Unsupported content status.' };
  }

  return { ok: true, data: { ...content, status } };
}
