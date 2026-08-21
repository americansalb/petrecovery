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
      // The From name people actually see when SMTP is the provider.
      from: 'ReunitePets <app@gmail.com>',
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

describe('unsubscribe path', () => {
  /**
   * Not one outbound email carried an unsubscribe link, though the
   * machinery to honour one - an EmailPreference row per person, a token
   * on it, a working /api/unsubscribe/:token - had been there all along.
   *
   * That matters twice over. CAN-SPAM requires an opt-out on bulk mail,
   * and Gmail and Outlook both weigh a missing unsubscribe path when
   * deciding whether a sender reaches the inbox at all. For a service
   * whose entire job is getting a sighting alert in front of an owner,
   * landing in spam is the whole product failing quietly.
   */

  const TOKEN = 'unsub_tok_123';

  test('adds the footer and the List-Unsubscribe headers when given a token', async () => {
    const { sendEmail } = freshEmailLib({ RESEND_API_KEY: 're_test_123', NEXT_PUBLIC_SITE_URL: 'https://www.reunitepets.org' });
    sendViaResend.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    await sendEmail({ ...MSG, html: '<html><body><p>hi</p></body></html>', unsubscribeToken: TOKEN });

    const payload = sendViaResend.mock.calls[0][0];
    expect(payload.html).toContain(`/api/unsubscribe/${TOKEN}`);
    expect(payload.html).toContain('Unsubscribe from these emails');

    // Inside the document. Several clients drop anything after </body>.
    expect(payload.html.indexOf('Unsubscribe from these emails')).toBeLessThan(
      payload.html.indexOf('</body>')
    );

    // RFC 8058: the header pair that puts a one-click button in Gmail.
    expect(payload.headers['List-Unsubscribe']).toBe(
      `<https://www.reunitepets.org/api/unsubscribe/${TOKEN}>`
    );
    expect(payload.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  test('sends the same headers over SMTP', async () => {
    const { sendEmail } = freshEmailLib({ EMAIL_USER: 'u@example.com', EMAIL_PASSWORD: 'pw' });
    sendViaSmtp.mockResolvedValue({});

    await sendEmail({ ...MSG, unsubscribeToken: TOKEN });

    const mail = sendViaSmtp.mock.calls[0][0];
    expect(mail.headers['List-Unsubscribe']).toContain(`/api/unsubscribe/${TOKEN}`);
    expect(mail.html).toContain('Unsubscribe from these emails');
  });

  test('leaves an email without a token exactly as it was', async () => {
    const { sendEmail } = freshEmailLib({ RESEND_API_KEY: 're_test_123' });
    sendViaResend.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    await sendEmail(MSG);

    const payload = sendViaResend.mock.calls[0][0];
    expect(payload.html).toBe(MSG.html);
    expect(payload.headers).toBeUndefined();
  });

  test('appends the footer when the html has no body tag', async () => {
    const { sendEmail } = freshEmailLib({ RESEND_API_KEY: 're_test_123' });
    sendViaResend.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    await sendEmail({ ...MSG, html: '<p>bare fragment</p>', unsubscribeToken: TOKEN });

    expect(sendViaResend.mock.calls[0][0].html).toContain('Unsubscribe from these emails');
  });
});
