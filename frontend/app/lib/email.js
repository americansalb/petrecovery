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
 * Branded, email-client-safe HTML layout (tables + inline styles).
 * Midnight header, white card, flash-yellow CTA. Use for every outbound
 * email so the brand is consistent from the first touch.
 */
export function renderBrandedEmail({ preheader = '', heading, bodyHtml, ctaLabel, ctaUrl, footnote = '' }) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f1f5f9;">
    <span style="display:none; max-height:0; overflow:hidden; color:#f1f5f9;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%;">
            <tr>
              <td style="background-color:#0f172a; border-radius:16px 16px 0 0; padding:22px 32px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <span style="font-size:20px; font-weight:800; color:#ffffff;">Reunite<span style="color:#facc15;">Pets</span></span>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff; border-radius:0 0 16px 16px; padding:36px 32px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#334155; font-size:16px; line-height:1.6;">
                <h1 style="margin:0 0 16px; font-size:24px; line-height:1.3; color:#0f172a;">${heading}</h1>
                ${bodyHtml}
                ${ctaLabel && ctaUrl ? `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 8px;">
                  <tr>
                    <td style="border-radius:12px; background-color:#facc15;">
                      <a href="${ctaUrl}" style="display:inline-block; padding:14px 36px; font-size:16px; font-weight:700; color:#0f172a; text-decoration:none; border-radius:12px;">${ctaLabel}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0; font-size:13px; color:#94a3b8; text-align:center; word-break:break-all;">
                  Button not working? Copy this link: <a href="${ctaUrl}" style="color:#64748b;">${ctaUrl}</a>
                </p>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.6; color:#94a3b8; text-align:center;">
                <strong style="color:#64748b;">ReunitePets</strong> &middot; Reuniting lost pets with their families
                ${footnote ? `<br>${footnote}` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Send verification email helper
 */
export async function sendVerificationEmail(email, firstName, verifyUrl) {
  const html = renderBrandedEmail({
    preheader: 'One click and your ReunitePets account is live.',
    heading: `Welcome, ${firstName || 'friend'}!`,
    bodyHtml: `
      <p style="margin:0 0 12px;">You're one click away from activating your ReunitePets account.</p>
      <p style="margin:0 0 4px;">This link expires in <strong>24 hours</strong>.</p>
    `,
    ctaLabel: 'Verify my email',
    ctaUrl: verifyUrl,
    footnote: "If you didn't create an account, you can safely ignore this email.",
  });

  return sendEmail({
    to: email,
    subject: 'Verify your ReunitePets email',
    html,
  });
}
