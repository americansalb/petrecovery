/**
 * Provider-chain tests for app/lib/email.js:
 * Resend when RESEND_API_KEY is set → SMTP when EMAIL_USER/PASSWORD set →
 * loud no-op otherwise. Every email in the app rides this.
 */

const sendViaResend = jest.fn();
const sendViaSmtp = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: sendViaResend } })),
}));
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn(() => ({ sendMail: sendViaSmtp })) },
}));

const MSG = { to: 'owner@example.com', subject: 'Test', html: '<p>hi</p>' };

function freshEmailLib(env) {
  jest.resetModules();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASSWORD;
  delete process.env.EMAIL_FROM;
  Object.assign(process.env, env);
  // eslint-disable-next-line global-require
  return require('@/app/lib/email');
}

beforeEach(() => {
  sendViaResend.mockReset();
  sendViaSmtp.mockReset();
});

describe('sendEmail provider chain', () => {
  test('uses Resend when RESEND_API_KEY is set', async () => {
    const { sendEmail } = freshEmailLib({ RESEND_API_KEY: 're_test_123', EMAIL_FROM: 'ReunitePets <noreply@petrecovery.org>' });
    sendViaResend.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    const result = await sendEmail(MSG);

    expect(sendViaResend).toHaveBeenCalledWith({
      from: 'ReunitePets <noreply@petrecovery.org>',
      to: MSG.to,
      subject: MSG.subject,
      html: MSG.html,
    });
    expect(sendViaSmtp).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, id: 'email_1' });
  });

  test('surfaces Resend API errors as success:false (never throws)', async () => {
    const { sendEmail } = freshEmailLib({ RESEND_API_KEY: 're_test_123' });
    sendViaResend.mockResolvedValue({ data: null, error: { message: 'domain not verified' } });

    const result = await sendEmail(MSG);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/domain not verified/);
  });

  test('falls back to SMTP when only EMAIL_USER/PASSWORD are set', async () => {
    const { sendEmail } = freshEmailLib({ EMAIL_USER: 'app@gmail.com', EMAIL_PASSWORD: 'pw' });
    sendViaSmtp.mockResolvedValue({});

    const result = await sendEmail(MSG);

    expect(sendViaResend).not.toHaveBeenCalled();
    expect(sendViaSmtp).toHaveBeenCalledWith(expect.objectContaining({
      from: 'PetRecovery <app@gmail.com>',
      to: MSG.to,
    }));
    expect(result.success).toBe(true);
  });

  test('no config: returns skipped no-op instead of throwing', async () => {
    const { sendEmail } = freshEmailLib({});

    const result = await sendEmail(MSG);

    expect(sendViaResend).not.toHaveBeenCalled();
    expect(sendViaSmtp).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, skipped: true, error: 'EMAIL_NOT_CONFIGURED' });
  });

  test('sendVerificationEmail rides the same chain', async () => {
    const { sendVerificationEmail } = freshEmailLib({ RESEND_API_KEY: 're_test_123' });
    sendViaResend.mockResolvedValue({ data: { id: 'email_2' }, error: null });

    const result = await sendVerificationEmail('new@user.com', 'Jordan', 'https://x/verify?token=t');

    expect(sendViaResend).toHaveBeenCalledWith(expect.objectContaining({
      to: 'new@user.com',
      subject: expect.stringMatching(/verify/i),
      html: expect.stringContaining('https://x/verify?token=t'),
    }));
    expect(result.success).toBe(true);
  });
});
