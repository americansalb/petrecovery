/**
 * The game's own mailer.
 *
 * Small on purpose. The only mail WanderGuesser sends is a sign-in
 * link, so this is one function, and it is here rather than borrowed
 * from the pet site because borrowing it would re-open the wire phase
 * 1.7 exists to close (docs/WANDERGUESSER_SPLIT.md).
 *
 * With RESEND_API_KEY set it sends. Without one it logs the link and
 * reports that it did, which is what makes local development and the
 * test suite work without a mail account: the link is in the server log
 * and you can paste it. It never throws at the caller; a mail failure
 * returns { sent: false, reason } so the route can say "we could not
 * send that" instead of returning a 500 that looks like a bug.
 *
 * Server only.
 */

const FROM = process.env.GEO_MAIL_FROM || 'WanderGuesser <onboarding@resend.dev>';

export async function sendSignInEmail({ to, url, env = process.env, sendImpl } = {}) {
  if (!to || !url) return { sent: false, reason: 'missing_arguments' };

  const key = env.RESEND_API_KEY || '';
  if (!key) {
    // Not an error. A server without a mail account still has to be
    // playable, so the link goes where a developer will find it.
    console.log(`[geo/email] no RESEND_API_KEY, sign-in link for ${to}:\n  ${url}`);
    return { sent: true, delivered: false, reason: 'logged_not_sent' };
  }

  try {
    const send = sendImpl || (await resendSender(key));
    await send({
      from: env.GEO_MAIL_FROM || FROM,
      to,
      subject: 'Your sign-in link',
      text: signInText(url),
      html: signInHtml(url),
    });
    return { sent: true, delivered: true };
  } catch (error) {
    console.error('[geo/email] send failed:', error?.message || error);
    return { sent: false, reason: 'send_failed' };
  }
}

async function resendSender(key) {
  // webpackIgnore for the same reason as the limiter's redis import:
  // middleware is built for the Edge runtime, and anything that reaches
  // this module must not drag a Node-only package into that bundle.
  const specifier = 'resend';
  const { Resend } = await import(/* webpackIgnore: true */ specifier);
  const client = new Resend(key);
  return (message) => client.emails.send(message);
}

export function signInText(url) {
  return [
    'Here is your sign-in link:',
    '',
    url,
    '',
    'It works once and expires in fifteen minutes.',
    'If you did not ask for it, nothing has happened to your account and you can ignore this.',
  ].join('\n');
}

export function signInHtml(url) {
  const safe = String(url).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return `<div style="font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a">
  <p>Here is your sign-in link:</p>
  <p><a href="${safe}" style="display:inline-block;background:#facc15;color:#0f172a;font-weight:600;padding:12px 20px;border-radius:10px;text-decoration:none">Sign in</a></p>
  <p style="color:#64748b;font-size:14px">It works once and expires in fifteen minutes. If you did not ask for it, nothing has happened to your account and you can ignore this.</p>
</div>`;
}
