import nodemailer from 'nodemailer';

// Uses existing EMAIL_ environment variables from Render
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function sendEmail({ to, subject, html }) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `PetRecovery <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}`);
    return { success: true };
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
