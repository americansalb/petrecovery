const { sendSignInEmail } = require('@/app/lib/geo/server/email');

const message = { to: 'player@example.test', url: 'https://probablyearth.com/api/geo/auth/verify?token=private-test-token' };
let log;
beforeEach(() => { log = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { log.mockRestore(); });

test.each(['', '   ', 'onboarding@resend.dev', 'Probably Earth <onboarding@RESEND.DEV>'])('production refuses a missing or test-only sender: %s', async (from) => {
  const send = jest.fn();
  const result = await sendSignInEmail({ ...message, env: { NODE_ENV: 'production', RESEND_API_KEY: 'test-key', GEO_MAIL_FROM: from }, sendImpl: send });
  expect(result).toEqual({ sent: false, delivered: false, reason: 'no_mail_sender' });
  expect(send).not.toHaveBeenCalled();
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/player@example|private-test-token|test-key/);
});

test('production uses the explicit game sender, not the pet-site sender', async () => {
  const send = jest.fn().mockResolvedValue({ data: { id: 'test-message-id' }, error: null });
  const env = { NODE_ENV: 'production', RESEND_API_KEY: 'test-key', GEO_MAIL_FROM: ' Probably Earth <noreply@reunitepets.org> ', EMAIL_FROM: 'Pet site <other@example.test>' };
  expect(await sendSignInEmail({ ...message, env, sendImpl: send })).toMatchObject({ sent: true });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: 'Probably Earth <noreply@reunitepets.org>', to: message.to }));
});

test('development may still use the provider test sender', async () => {
  const send = jest.fn().mockResolvedValue({ data: { id: 'test-message-id' } });
  await sendSignInEmail({ ...message, env: { NODE_ENV: 'development', RESEND_API_KEY: 'test-key' }, sendImpl: send });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: 'Probably Earth <onboarding@resend.dev>' }));
});

test('provider rejection with a configured sender is never success', async () => {
  const send = jest.fn().mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'Sender refused' } });
  const result = await sendSignInEmail({ ...message, env: { NODE_ENV: 'production', RESEND_API_KEY: 'test-key', GEO_MAIL_FROM: 'Probably Earth <noreply@reunitepets.org>' }, sendImpl: send });
  expect(result).toMatchObject({ sent: false, reason: 'send_failed' });
});
