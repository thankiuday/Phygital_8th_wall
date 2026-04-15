'use strict';

const nodemailer = require('nodemailer');

/**
 * createTransporter — builds a Nodemailer transporter.
 *
 * In development: uses Ethereal (fake SMTP) — no real emails sent.
 * In production: configure SMTP_HOST/PORT/USER/PASS in .env.
 */
const createTransporter = async () => {
  if (process.env.NODE_ENV !== 'production') {
    // Ethereal test account — credentials logged to console
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * sendPasswordResetEmail — sends the password reset link.
 */
const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const transporter = await createTransporter();

  const info = await transporter.sendMail({
    from: `"Phygital8ThWall" <${process.env.SMTP_FROM || 'noreply@phygital8thwall.com'}>`,
    to,
    subject: 'Reset your Phygital8ThWall password',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #0f172a; color: #f8fafc; border-radius: 16px;">
        <h1 style="font-size: 24px; font-weight: 800; background: linear-gradient(135deg,#7c3aed,#06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 8px;">
          Phygital8ThWall
        </h1>
        <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 16px; color: #f8fafc;">
          Reset your password
        </h2>
        <p style="color: #94a3b8; line-height: 1.6; margin: 0 0 24px;">
          Hi ${name}, we received a request to reset your password.
          Click the button below — this link expires in <strong style="color:#f8fafc;">15 minutes</strong>.
        </p>
        <a href="${resetUrl}" style="display:inline-block; background: linear-gradient(135deg,#7c3aed,#6d28d9); color:#fff; text-decoration:none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
          Reset Password
        </a>
        <p style="color: #475569; font-size: 12px; margin: 24px 0 0;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  // In dev, log the Ethereal preview URL to console
  if (process.env.NODE_ENV !== 'production') {
    console.info('Preview email URL:', nodemailer.getTestMessageUrl(info));
  }
};

module.exports = { sendPasswordResetEmail };
