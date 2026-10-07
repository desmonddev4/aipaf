import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function emailConfig() {
  return {
    from: process.env.EMAIL_FROM || 'AIPAF Website <noreply@aipaf.africa>',
    to: process.env.SECRETARIAT_EMAIL || 'info@aipaf.africa',
  };
}

export async function sendSubmissionEmails({ kind, data, recordId }) {
  if (!resend) return { status: 'skipped', reason: 'RESEND_API_KEY is not configured.' };

  const config = emailConfig();
  const subject = kind === 'contact'
    ? `Website contact: ${data.topic}`
    : 'New founding membership interest';
  const text = [
    `Submission ID: ${recordId}`,
    '',
    ...Object.entries(data).filter(([key]) => !key.startsWith('_')).map(([key, value]) => `${key}: ${value}`),
  ].join('\n');

  const result = await resend.emails.send({
    from: config.from,
    to: config.to,
    replyTo: data.email,
    subject,
    text,
  });

  if (result.error) throw new Error(result.error.message || 'Email delivery failed.');
  return { status: 'sent', id: result.data?.id || null };
}

export async function sendAcknowledgementEmail({ kind, data }) {
  if (!resend || !data.email) return { status: 'skipped', reason: 'RESEND_API_KEY is not configured.' };

  const config = emailConfig();
  const subject = kind === 'contact'
    ? 'Your message has been received'
    : 'Your founding membership interest has been received';

  await resend.emails.send({
    from: config.from,
    to: [data.email],
    subject,
    text: [
      'Thank you for contacting the African Institute of Project Assurance and Forensics.',
      '',
      'The Secretariat has received your message and will reply by email when possible.',
      'Do not reply to this automated message.',
    ].join('\n'),
  });
  return { status: 'sent' };
}
