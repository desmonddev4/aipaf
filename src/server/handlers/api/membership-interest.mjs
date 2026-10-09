import { saveMembershipSubmission, markSubmissionStatus } from './db.mjs';
import { sendAcknowledgementEmail, sendSubmissionEmails } from './email.mjs';
import {
  checkSpamSignals,
  createRateLimiter,
  getIp,
  getValidationError,
  jsonResponse,
} from './_shared.mjs';

const rateLimit = createRateLimiter({ limit: 5, windowMs: 60_000 });

export default async function handler(request) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);

  const ip = getIp(request);
  const body = await request.json().catch(() => ({}));
  const spamError = checkSpamSignals({ website: body.website, _elapsedMs: body._elapsedMs, ip });
  if (spamError) return jsonResponse({ ok: false, message: spamError.message }, spamError.status);
  if (!rateLimit(ip)) return jsonResponse({ ok: false, message: 'Too many requests. Please try again later.' }, 429);

  const validationError = getValidationError('membership', body);
  if (validationError) return jsonResponse({ ok: false, message: validationError.message }, validationError.status);

  const data = body;
  try {
    const record = await saveMembershipSubmission(data);
    const emailResult = await sendSubmissionEmails({ kind: 'membership', data, recordId: record.id });
    await sendAcknowledgementEmail({ kind: 'membership', data });
    await markSubmissionStatus('membership_interests', record.id, emailResult.status === 'sent' ? 'sent' : 'failed');
    return jsonResponse({ ok: true, message: 'Your interest has been received.' });
  } catch (error) {
    const message = error.message.includes('DATABASE_URL')
      ? 'The form service is not configured. Please contact the Secretariat by email.'
      : 'We could not process that submission. Please try again.';
    return jsonResponse({ ok: false, message }, 503);
  }
}
