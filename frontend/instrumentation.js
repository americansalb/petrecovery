/**
 * Next.js boot hook - runs once per server process, before any request.
 *
 * Used for the checks that should fail loudly at startup rather than silently
 * at 3am. Today that is one thing: whether production has anywhere to send an
 * exception. Add other boot assertions here rather than scattering them
 * through route modules.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { assertProductionErrorSink } = await import('./app/lib/errorTracking');
  assertProductionErrorSink();

  // Abuse defences, checked here rather than trusted. Both of these were
  // decoration before the 2026-08 audit: a CAPTCHA that verified nothing
  // and a rate limit that forgot everything on deploy.
  const { assertCaptchaConfig } = await import('./app/lib/captcha');
  assertCaptchaConfig();

  const { describeRateLimitBackend, rateLimitKeyIsSpoofable } = await import('./app/lib/rateLimit');

  // A durable limiter keyed on a forgeable value is not a limiter. Without
  // RATELIMIT_TRUSTED_IP_HEADER the key falls back to the leftmost
  // X-Forwarded-For entry, which the client sets - so a different value per
  // request means a fresh bucket per request and no limit at all.
  if (rateLimitKeyIsSpoofable() && process.env.NODE_ENV === 'production') {
    console.warn(
      `\n[boot] ${'='.repeat(66)}\n` +
      '[boot] RATELIMIT_TRUSTED_IP_HEADER is not set. Rate limits are keyed\n' +
      '[boot] on X-Forwarded-For, which the client controls: a caller that\n' +
      '[boot] varies that header per request is never limited.\n' +
      '[boot] Set it to the header your proxy injects (x-real-ip,\n' +
      '[boot] cf-connecting-ip, true-client-ip).\n' +
      `[boot] ${'='.repeat(66)}\n`
    );
  }

  // Flyers and share images are drawn once, when a report is filed. After
  // a deploy that changes their design, every open case would keep the old
  // artwork; instead the server redraws any case whose stored kit carries
  // an older renderer version, a minute and a half after boot, one case at
  // a time (app/lib/cascade/refresh.js, started over loopback by
  // refreshBoot.js because the renderers cannot be bundled for the edge
  // runtime this file is also compiled for).
  //
  // It is OFF unless CASCADE_REFRESH_ON_BOOT=1. Redrawing every open case
  // back to back ran the 512 MB instance out of memory on 2026-11-05, and
  // again on 2026-11-13: the server was killed a few minutes after each
  // boot, came back, started the redraw again and was killed again, for as
  // long as stale cases were left. The site answered 502 on and off for
  // that whole time. A job that starts by itself at boot and can take the
  // server down is not worth what it saves. POST
  // /api/cascade/regenerate?stale=1 still does it by hand, a few at a time.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PHASE !== 'phase-production-build' &&
    process.env.DATABASE_URL &&
    process.env.CASCADE_REFRESH_ON_BOOT === '1'
  ) {
    const { scheduleStaleKitRefresh } = await import('./app/lib/cascade/refreshBoot');
    scheduleStaleKitRefresh();
  }

  const limiter = await describeRateLimitBackend();
  if (limiter.durable) {
    console.log(`[boot] Rate limiting: ${limiter.backend} (survives restarts)`);
  } else {
    console.warn(
      `\n[boot] ${'='.repeat(66)}\n` +
      `[boot] Rate limiting is IN-MEMORY ONLY: ${limiter.note}.\n` +
      '[boot] Limits reset every deploy, restart and scale event, so a\n' +
      '[boot] patient script can walk straight past them.\n' +
      `[boot] ${'='.repeat(66)}\n`
    );
  }
}
