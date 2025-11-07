import nodemailer from 'nodemailer';

// NOTE: Install nodemailer first: npm install nodemailer
// Configure SMTP settings in .env.local

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendEmail({ to, subject, html }) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'PetRecovery <noreply@petrecovery.org>',
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
