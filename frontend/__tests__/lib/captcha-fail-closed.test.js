/**
 * CAPTCHA verification must fail CLOSED.
 *
 * Both verify functions used to return { success: true } when no secret
 * key was configured - "pass-through if not configured". Combined with a
 * middleware that only checked whether an x-recaptcha-token header
 * existed, that made the entire CAPTCHA layer decoration: a bot sending
 * `x-recaptcha-token: x` was waved through, and the code read, to anyone
 * auditing it, like a defence.
 *
 * These tests pin the two halves of the correction:
 *   1. asked to verify without a secret -> refuse, never approve
 *   2. REQUIRE_CAPTCHA on without keys -> refuse to boot
 */

describe('captcha verification fails closed', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.RECAPTCHA_V2_SECRET_KEY;
    delete process.env.RECAPTCHA_V3_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY;
    delete process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;
    delete process.env.REQUIRE_CAPTCHA;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('v3 refuses when no secret is configured', async () => {
    const { verifyCaptchaV3 } = require('@/app/lib/captcha');
    const result = await verifyCaptchaV3('any-token');
    expect(result.success).toBe(false);
    expect(result.code).toBe('CAPTCHA_NOT_CONFIGURED');
  });

  it('v2 refuses when no secret is configured', async () => {
    const { verifyCaptchaV2 } = require('@/app/lib/captcha');
    const result = await verifyCaptchaV2('any-token');
    expect(result.success).toBe(false);
    expect(result.code).toBe('CAPTCHA_NOT_CONFIGURED');
  });

  it('counts as configured only when BOTH keys are present', () => {
    const { isCaptchaConfigured } = require('@/app/lib/captcha');
    expect(isCaptchaConfigured('v3')).toBe(false);

    // A secret with no site key rejects every real visitor, because the
    // browser has no way to mint a token. That is not "configured".
    process.env.RECAPTCHA_V3_SECRET_KEY = 'secret';
    jest.resetModules();
    expect(require('@/app/lib/captcha').isCaptchaConfigured('v3')).toBe(false);

    process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY = 'site';
    jest.resetModules();
    expect(require('@/app/lib/captcha').isCaptchaConfigured('v3')).toBe(true);
  });

  describe('boot assertion', () => {
    it('passes when CAPTCHA is switched off', () => {
      const { assertCaptchaConfig } = require('@/app/lib/captcha');
      expect(() => assertCaptchaConfig()).not.toThrow();
    });

    it('refuses to boot with REQUIRE_CAPTCHA on but no keys', () => {
      process.env.REQUIRE_CAPTCHA = 'true';
      jest.resetModules();
      const { assertCaptchaConfig } = require('@/app/lib/captcha');
      // Without this, every lost-pet report and every signup is refused
      // with a 403 and nobody finds out until the support inbox fills up.
      expect(() => assertCaptchaConfig()).toThrow(/RECAPTCHA_V3_SECRET_KEY/);
    });

    it('passes when REQUIRE_CAPTCHA is on and both keys are set', () => {
      process.env.REQUIRE_CAPTCHA = 'true';
      process.env.RECAPTCHA_V3_SECRET_KEY = 'secret';
      process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY = 'site';
      jest.resetModules();
      const { assertCaptchaConfig } = require('@/app/lib/captcha');
      expect(() => assertCaptchaConfig()).not.toThrow();
    });
  });
});
