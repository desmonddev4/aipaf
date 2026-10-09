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
    // The submission is saved; a mail problem must not make the visitor resubmit.
    let emailStatus = 'failed';
    try {
      const emailResult = await sendSubmissionEmails({ kind: 'membership', data, recordId: record.id });
      emailStatus = emailResult.status === 'sent' ? 'sent' : 'failed';
    } catch (emailError) {
      console.error('Failed to email membership submission:', emailError);
    }
    await sendAcknowledgementEmail({ kind: 'membership', data }).catch((emailError) => console.error('Failed to send acknowledgement:', emailError));
    await markSubmissionStatus('membership_interests', record.id, emailStatus).catch(() => {});
    return jsonResponse({ ok: true, message: 'Your interest has been received.' });
  } catch (error) {
    const message = error.message.includes('DATABASE_URL')
      ? 'The form service is not configured. Please contact the Secretariat by email.'
      : 'We could not process that submission. Please try again.';
    return jsonResponse({ ok: false, message }, 503);
  }
}
