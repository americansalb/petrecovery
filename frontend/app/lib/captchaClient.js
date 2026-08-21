/**
 * Client-side reCAPTCHA token attachment.
 *
 * The server checks the x-recaptcha-token header on the routes listed in
 * middleware.js. This is the other half: it mints the token and hands
 * back headers to spread into a fetch.
 *
 * Degrades to nothing. If no site key is configured (the default), it
 * returns an empty object and the request goes out exactly as it did
 * before. The server side only enforces when REQUIRE_CAPTCHA is on, and
 * boot refuses that combination unless the keys are actually present, so
 * the two halves cannot be switched on independently.
 *
 * reCAPTCHA v3 is invisible - no checkbox, no puzzle, nothing the person
 * reporting a lost dog has to do.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;

let scriptPromise = null;

function loadScript() {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('not a browser'));
      return;
    }
    if (window.grecaptcha) {
      resolve(window.grecaptcha);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.onload = () => resolve(window.grecaptcha);
    script.onerror = () => reject(new Error('reCAPTCHA script failed to load'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Headers to spread into a fetch on a captcha-protected route.
 *
 * Never throws and never blocks a submission: if the token cannot be
 * minted - script blocked, offline, Google having a bad day - it returns
 * no header and lets the request through to the server, which decides.
 * Someone whose pet is missing does not lose their report because an
 * ad blocker ate a third-party script.
 *
 * @param {string} action - reCAPTCHA action name, e.g. 'report_create'
 * @returns {Promise<Record<string, string>>}
 */
export async function captchaHeaders(action = 'submit') {
  if (!SITE_KEY) return {};

  try {
    const grecaptcha = await loadScript();
    const token = await new Promise((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(SITE_KEY, { action }).then(resolve, reject);
      });
    });
    return token ? { 'x-recaptcha-token': token } : {};
  } catch (err) {
    console.warn('reCAPTCHA token unavailable, submitting without one:', err.message);
    return {};
  }
}
