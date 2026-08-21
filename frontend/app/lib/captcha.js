/**
 * Phase 5: Server-side CAPTCHA Verification
 *
 * Utilities for verifying reCAPTCHA tokens on the server.
 */

const RECAPTCHA_V2_SECRET = process.env.RECAPTCHA_V2_SECRET_KEY;
const RECAPTCHA_V3_SECRET = process.env.RECAPTCHA_V3_SECRET_KEY;
const RECAPTCHA_V3_THRESHOLD = parseFloat(process.env.RECAPTCHA_V3_THRESHOLD || '0.5');

/**
 * Is server-side CAPTCHA verification actually possible?
 *
 * Both halves have to be present to mean anything: a secret key so the
 * server can verify, and a site key so the browser can mint a token in
 * the first place. A secret with no site key rejects every real visitor;
 * a site key with no secret verifies nothing.
 */
export function isCaptchaConfigured(version = 'v3') {
  const secret = version === 'v2' ? RECAPTCHA_V2_SECRET : RECAPTCHA_V3_SECRET;
  const siteKey = version === 'v2'
    ? process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY
    : process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;
  return Boolean(secret && siteKey);
}

/**
 * Verify a reCAPTCHA v2 token
 *
 * @param {string} token - The reCAPTCHA response token
 * @param {string} [remoteIp] - Optional remote IP address
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyCaptchaV2(token, remoteIp = null) {
  if (!RECAPTCHA_V2_SECRET) {
    // Fail CLOSED. This function is only reached when something has
    // decided a CAPTCHA is required; answering "sure, verified" because
    // no secret is configured turns the whole check into decoration. The
    // boot assertion in instrumentation.js stops production from ever
    // reaching this state, so getting here means a real misconfiguration.
    console.error('CAPTCHA required but RECAPTCHA_V2_SECRET_KEY is not set - refusing the request');
    return { success: false, error: 'CAPTCHA is not configured', code: 'CAPTCHA_NOT_CONFIGURED' };
  }

  if (!token) {
    return { success: false, error: 'No CAPTCHA token provided' };
  }

  try {
    const params = new URLSearchParams({
      secret: RECAPTCHA_V2_SECRET,
      response: token,
    });

    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true };
    }

    // Map error codes to human-readable messages
    const errorMessages = {
      'missing-input-secret': 'Server configuration error',
      'invalid-input-secret': 'Server configuration error',
      'missing-input-response': 'Please complete the CAPTCHA',
      'invalid-input-response': 'Invalid CAPTCHA response',
      'bad-request': 'Invalid request',
      'timeout-or-duplicate': 'CAPTCHA expired, please try again',
    };

    const errorCode = data['error-codes']?.[0] || 'unknown';
    const errorMessage = errorMessages[errorCode] || 'CAPTCHA verification failed';

    return { success: false, error: errorMessage, code: errorCode };
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    return { success: false, error: 'CAPTCHA verification failed' };
  }
}

/**
 * Verify a reCAPTCHA v3 token
 *
 * @param {string} token - The reCAPTCHA response token
 * @param {string} expectedAction - The expected action name
 * @param {string} [remoteIp] - Optional remote IP address
 * @returns {Promise<{success: boolean, score?: number, error?: string}>}
 */
export async function verifyCaptchaV3(token, expectedAction, remoteIp = null) {
  if (!RECAPTCHA_V3_SECRET) {
    // Fail CLOSED, for the reason given on verifyCaptchaV2 above.
    console.error('CAPTCHA required but RECAPTCHA_V3_SECRET_KEY is not set - refusing the request');
    return { success: false, error: 'CAPTCHA is not configured', code: 'CAPTCHA_NOT_CONFIGURED' };
  }

  if (!token) {
    return { success: false, error: 'No CAPTCHA token provided' };
  }

  try {
    const params = new URLSearchParams({
      secret: RECAPTCHA_V3_SECRET,
      response: token,
    });

    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: 'CAPTCHA verification failed',
        code: data['error-codes']?.[0],
      };
    }

    // Verify action matches
    if (expectedAction && data.action !== expectedAction) {
      return {
        success: false,
        error: 'Invalid CAPTCHA action',
        score: data.score,
      };
    }

    // Check score threshold
    if (data.score < RECAPTCHA_V3_THRESHOLD) {
      return {
        success: false,
        error: 'CAPTCHA score too low',
        score: data.score,
      };
    }

    return {
      success: true,
      score: data.score,
      action: data.action,
      hostname: data.hostname,
    };
  } catch (error) {
    console.error('CAPTCHA v3 verification error:', error);
    return { success: false, error: 'CAPTCHA verification failed' };
  }
}

/**
 * Middleware to verify CAPTCHA for API routes
 *
 * @param {Request} request - The incoming request
 * @param {Object} options - Verification options
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyCaptchaFromRequest(request, options = {}) {
  const { version = 'v3', action = null, required = true } = options;

  // Get token from request body or header
  let token;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const body = await request.clone().json();
      token = body.captchaToken || body.recaptchaToken || body.gRecaptchaResponse;
    } catch (e) {
      // Body parsing failed
    }
  }

  // Also check header
  if (!token) {
    token = request.headers.get('x-recaptcha-token');
  }

  if (!token && !required) {
    return { success: true };
  }

  // Get remote IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const remoteIp = forwardedFor ? forwardedFor.split(',')[0].trim() : null;

  if (version === 'v2') {
    return verifyCaptchaV2(token, remoteIp);
  }

  return verifyCaptchaV3(token, action, remoteIp);
}

/**
 * Check if CAPTCHA is required based on risk signals
 *
 * @param {Request} request - The incoming request
 * @returns {boolean}
 */
export function isCaptchaRequired(request) {
  // Always require for sensitive actions
  const sensitiveActions = ['/api/auth/register', '/api/auth/login', '/api/missions/new'];
  const url = new URL(request.url);

  if (sensitiveActions.some(path => url.pathname.startsWith(path))) {
    return true;
  }

  // Check for suspicious patterns
  const userAgent = request.headers.get('user-agent') || '';

  // Bot-like user agents
  if (!userAgent || /bot|crawler|spider|scraper/i.test(userAgent)) {
    return true;
  }

  // Rate limit exceeded (would need to integrate with rate limiter)
  // This is a placeholder for more sophisticated risk assessment

  return false;
}

/**
 * Create a CAPTCHA challenge response
 *
 * @param {string} reason - Reason for requiring CAPTCHA
 * @returns {Response}
 */
export function createCaptchaChallenge(reason = 'Security verification required') {
  return new Response(
    JSON.stringify({
      error: 'CAPTCHA required',
      message: reason,
      captchaRequired: true,
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-Captcha-Required': 'true',
      },
    }
  );
}

export default {
  verifyCaptchaV2,
  verifyCaptchaV3,
  verifyCaptchaFromRequest,
  isCaptchaConfigured,
  isCaptchaRequired,
  createCaptchaChallenge,
};

/**
 * Boot check: never let REQUIRE_CAPTCHA be on without the keys to honour it.
 *
 * With the flag on and keys missing, every POST to a protected route is
 * refused - which on this site means nobody can file a lost-pet report.
 * Failing at boot makes that a deploy that does not go out, instead of a
 * silent outage discovered from the support inbox.
 *
 * Called from instrumentation.js.
 */
export function assertCaptchaConfig() {
  if (process.env.REQUIRE_CAPTCHA !== 'true') return;

  if (isCaptchaConfigured('v3')) {
    console.log('[boot] CAPTCHA: enabled and configured (reCAPTCHA v3)');
    return;
  }

  const missing = [
    process.env.RECAPTCHA_V3_SECRET_KEY ? null : 'RECAPTCHA_V3_SECRET_KEY',
    process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY ? null : 'NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY',
  ].filter(Boolean);

  throw new Error(
    `REQUIRE_CAPTCHA=true but ${missing.join(' and ')} not set. ` +
    'Every report and signup would be refused. Set the keys or unset REQUIRE_CAPTCHA.'
  );
}
