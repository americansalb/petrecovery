import nodemailer from 'nodemailer';
import { Resend } from 'resend';

/**
 * Outbound email with a provider chain:
 *   1. Resend  - when RESEND_API_KEY is set (recommended; verify the domain
 *                in the Resend dashboard, then set EMAIL_FROM to match it)
 *   2. SMTP    - nodemailer with EMAIL_SERVICE/EMAIL_USER/EMAIL_PASSWORD
 *   3. No-op   - logs loudly so dev/preview environments still show what
 *                WOULD have been sent instead of erroring
 *
 * Every email in the app goes through sendEmail(), so configuring one env
 * var (RESEND_API_KEY) turns on verification, password reset, share invites,
 * conversation notifications - all of it.
 */

const FROM_FALLBACK = 'ReunitePets <onboarding@resend.dev>'; // Resend's shared test sender

let resendClient = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

let smtpTransporter = null;
function getSmtp() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return null;
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
  return smtpTransporter;
}

export async function sendEmail({ to, subject, html }) {
  const from = process.env.EMAIL_FROM
    || (process.env.EMAIL_USER ? `PetRecovery <${process.env.EMAIL_USER}>` : FROM_FALLBACK);

  try {
    const resend = getResend();
    if (resend) {
      const { data, error } = await resend.emails.send({ from, to, subject, html });
      if (error) {
        console.error('❌ Email error (resend):', error);
        return { success: false, error: error.message || String(error) };
      }
      console.log(`✅ Email sent to ${to} via Resend (${data?.id || 'no id'})`);
      return { success: true, id: data?.id };
    }

    const smtp = getSmtp();
    if (smtp) {
      await smtp.sendMail({ from, to, subject, html });
      console.log(`✅ Email sent to ${to} via SMTP`);
      return { success: true };
    }

    console.warn(`✉️  EMAIL NOT CONFIGURED - would have sent "${subject}" to ${to}. ` +
      'Set RESEND_API_KEY (recommended) or EMAIL_USER/EMAIL_PASSWORD.');
    return { success: false, skipped: true, error: 'EMAIL_NOT_CONFIGURED' };
  } catch (error) {
    console.error('❌ Email error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send verification email helper
 */
export async function sendVerificationEmail(email, firstName, verifyUrl) {
  const emailHtml = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Verify Your Email</h1>
        </div>

        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hi ${firstName || 'there'},</p>

          <p>Welcome to PetRecovery.org! Please verify your email address to activate your account.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}"
               style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Verify My Email
            </a>
          </div>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Note:</strong> This link will expire in <strong>24 hours</strong>.</p>
          </div>

          <p>If you didn't create an account with PetRecovery.org, you can safely ignore this email.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            If the button above doesn't work, copy and paste this link into your browser:<br>
            <a href="${verifyUrl}" style="color: #10b981; word-break: break-all;">${verifyUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            <strong>PetRecovery.org</strong> - Reuniting Lost Pets with Their Families
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Verify Your PetRecovery Email',
    html: emailHtml
  });
}
