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

export async function sendAcknowledgementEmail({ kind, data }) {
  const transport = getTransporter();
  if (!transport || !data.email) return { status: 'skipped', reason: 'SMTP is not configured.' };

  const config = emailConfig();
  let subject, text;

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
  });
  return { status: 'sent' };
}
