import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return transporter;
}

function emailConfig() {
  return {
    from: process.env.EMAIL_FROM || 'AIPAF Website <noreply@aipafgh.org>',
    to: process.env.SECRETARIAT_EMAIL || 'info@aipafgh.org',
  };
}

export async function sendSubmissionEmails({ kind, data, recordId }) {
  const transport = getTransporter();
  if (!transport) return { status: 'skipped', reason: 'SMTP is not configured.' };

  const config = emailConfig();
  const subject = kind === 'contact'
    ? `Website contact: ${data.topic}`
    : 'New founding membership interest';
  const text = [
    `Submission ID: ${recordId}`,
    '',
    ...Object.entries(data).filter(([key]) => !key.startsWith('_')).map(([key, value]) => `${key}: ${value}`),
  ].join('\n');

  const result = await transport.sendMail({
    from: config.from,
    to: config.to,
    replyTo: data.email,
    subject,
    text,
  });

  return { status: 'sent', id: result.messageId || null };
}

export async function sendVerificationEmail({ email, code }) {
  const transport = getTransporter();
  if (!transport) return { status: 'skipped', reason: 'SMTP is not configured.' };

  const config = emailConfig();
  const subject = 'Your AIPAF Admin Verification Code';
  const text = [
    'Your verification code is:',
    '',
    code,
    '',
    'This code will expire in 10 minutes.',
    '',
    'If you did not request this code, you can safely ignore this email.',
    'Do not reply to this automated message.',
  ].join('\n');

  await transport.sendMail({
    from: config.from,
    to: email,
    subject,
    text,
  });
  return { status: 'sent' };
}

export async function sendAcknowledgementEmail({ kind, data }) {
  const transport = getTransporter();
  if (!transport || !data.email) return { status: 'skipped', reason: 'SMTP is not configured.' };

  const config = emailConfig();
  let subject, text, html;

  if (kind === 'contact') {
    subject = 'Your message has been received';
    text = [
      'Thank you for contacting the African Institute of Project Assurance and Forensics.',
      '',
      'The Secretariat has received your message and will reply by email when possible.',
      'Do not reply to this automated message.',
    ].join('\n');
  } else if (kind === 'membership') {
    subject = 'Your founding membership interest has been received';
    text = [
      'Thank you for your interest in joining the African Institute of Project Assurance and Forensics.',
      '',
      'The Secretariat has received your interest and will follow up by email when possible.',
      'Do not reply to this automated message.',
    ].join('\n');
  } else if (kind === 'password-reset') {
    subject = 'Reset your AIPAF password';
    text = [
      'You requested a password reset for your AIPAF member account.',
      '',
      `Click the link below to reset your password:`,
      '',
      data.resetUrl,
      '',
      'This link will expire in 1 hour.',
      '',
      'If you did not request this password reset, you can safely ignore this email.',
      'Do not reply to this automated message.',
    ].join('\n');
  } else if (kind === 'verify-email') {
    subject = 'Verify your AIPAF email address';
    text = [
      'Thank you for creating an account with the African Institute of Project Assurance and Forensics.',
      '',
      'Please verify your email address by clicking the link below:',
      '',
      data.verifyUrl,
      '',
      'This link will expire in 24 hours.',
      '',
      'If you did not create this account, you can safely ignore this email.',
      'Do not reply to this automated message.',
    ].join('\n');
  } else if (kind === 'member-invitation') {
    subject = 'Invitation to Join the African Institute of Project Assurance and Forensics';
    const gradeDisplay = data.grade.charAt(0).toUpperCase() + data.grade.slice(1);
    text = [
      `Dear ${data.fullName},`,
      '',
      'On behalf of the African Institute of Project Assurance and Forensics (AIPAF), we are pleased to invite you to join our professional community.',
      '',
      `You have been invited to join as a ${gradeDisplay} of the Institute.`,
      '',
      data.qualification ? `Qualification: ${data.qualification}` : '',
      '',
      'AIPAF is a Pan-African professional body dedicated to advancing project assurance and forensics across the continent. Our members are practitioners, scholars, and leaders committed to improving project delivery, assurance, and investigation.',
      '',
      'To accept this invitation:',
      '',
      '1. Click the link below',
      '2. Create your password',
      '3. Complete your profile',
      '',
      data.acceptUrl,
      '',
      'This invitation link will expire in 30 days.',
      '',
      'If you have any questions about the invitation or the Institute, please contact the Secretariat.',
      '',
      'We look forward to welcoming you as a member.',
      '',
      'Yours sincerely,',
      'The Secretariat',
      'African Institute of Project Assurance and Forensics',
      '',
      'Do not reply to this automated message.',
    ].filter(line => line !== '').join('\n');
    html = invitationHtml(data, gradeDisplay);
  } else {
    subject = 'AIPAF Notification';
    text = [
      'Thank you for contacting the African Institute of Project Assurance and Forensics.',
      '',
      'Do not reply to this automated message.',
    ].join('\n');
  }

  await transport.sendMail({
    from: config.from,
    to: data.email,
    subject,
    text,
    ...(html ? { html } : {}),
  });
  return { status: 'sent' };
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);

// Table layout with inline styles only, since email clients ignore <style> and modern CSS.
function invitationHtml(data, gradeDisplay) {
  const url = escapeHtml(data.acceptUrl);
  const row = (label, value) => `<tr><td style="padding:10px 0;border-top:1px solid #1f4a32;color:#a9c4b4;font-size:12px;letter-spacing:.06em;text-transform:uppercase;">${label}</td><td style="padding:10px 0;border-top:1px solid #1f4a32;color:#ffffff;font-weight:600;text-align:right;">${value}</td></tr>`;
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#03140a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#03140a;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0a2c16;border:1px solid #24573a;border-radius:20px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e8f3ec;">
<tr><td style="padding:28px 32px 0;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:.1em;color:#ffffff;font-weight:bold;">AIPAF</div>
<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#f2ac1f;font-weight:bold;margin-top:2px;">Membership invitation</div>
</td></tr>
<tr><td style="padding:24px 32px 0;">
<h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;font-weight:normal;color:#ffffff;">You are invited to join AIPAF</h1>
<p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#c9ddd1;">Dear ${escapeHtml(data.fullName)},<br>On behalf of the African Institute of Project Assurance and Forensics, we are pleased to invite you to join our professional community.</p>
</td></tr>
<tr><td style="padding:22px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #f2ac1f;background:#0e3a1e;border-radius:12px;padding:4px 16px;font-size:14px;">
<tr><td colspan="2" style="padding:0;height:4px;"></td></tr>
${row('Invited as', escapeHtml(gradeDisplay))}
${data.qualification ? row('Qualification', escapeHtml(data.qualification)) : ''}
${row('Link valid for', '30 days')}
<tr><td colspan="2" style="padding:0;height:4px;"></td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:28px 32px 8px;">
<a href="${url}" style="display:inline-block;padding:14px 32px;border-radius:999px;background:#f2ac1f;color:#2c1b00;font-weight:bold;font-size:15px;text-decoration:none;">Accept invitation</a>
</td></tr>
<tr><td style="padding:12px 32px 0;font-size:13px;line-height:1.6;color:#a9c4b4;">
<strong style="color:#ffffff;">What happens next</strong><br>1. Open the link and create your password<br>2. Complete your member profile
</td></tr>
<tr><td style="padding:18px 32px 0;font-size:12px;line-height:1.6;color:#8fb09d;word-break:break-all;">Button not working? Copy this link into your browser:<br><a href="${url}" style="color:#f2ac1f;">${url}</a></td></tr>
<tr><td style="padding:24px 32px 28px;font-size:12px;line-height:1.6;color:#8fb09d;border-top:0;">
Yours sincerely,<br><strong style="color:#c9ddd1;">The Secretariat</strong><br>African Institute of Project Assurance and Forensics<br><br>This is an automated message. Please do not reply.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
