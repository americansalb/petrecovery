/**
 * Server-side error monitoring (Sentry) — wired ERRORS-ONLY to protect the
 * free-tier quota.
 *
 * Quota guarantees:
 *   - tracesSampleRate: 0   → NO performance transactions (the #1 quota eater)
 *   - profilesSampleRate: 0 → no profiling
 *   - no session replay (that's browser-only anyway)
 *   - only genuine internal errors are forwarded (see lib/logging.js), so the
 *     volume is a handful of real bugs — never routine 4xx denials.
 *
 * Dormant until SENTRY_DSN is set, so this is a safe no-op locally and until
 * the key is added in the deploy environment. The server DSN comes from the
 * SENTRY_DSN env var (the "Copy DSN" value in the Sentry project), separate
 * from the public browser loader script in app/layout.js.
 */

let sentry = null;
let initAttempted = false;

async function getSentry() {
  if (sentry) return sentry;
  if (initAttempted) return null; // already tried and failed/absent — don't retry
  initAttempted = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null; // dormant until the key is configured

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0, // errors only — no performance/transaction quota use
      profilesSampleRate: 0,
      sendDefaultPii: false, // keep events lean + privacy-safe (no IPs, etc.)
    });
    sentry = Sentry;
    return sentry;
  } catch (e) {
    console.error('[observability] Sentry init failed (continuing without it):', e.message);
    return null;
  }
}

/**
 * Report a genuine server-side error to Sentry. Safe no-op without SENTRY_DSN.
 * Takes a structured logEvent payload (a `failure` event) and turns it into a
 * grouped Sentry issue with useful tags/context.
 *
 * @param {object} event - the completed logEvent payload
 */
export async function captureServerError(event) {
  try {
    const Sentry = await getSentry();
    if (!Sentry) return;

    const err = new Error(event.error_message || event.event_type || 'Server error');
    // Name drives Sentry's grouping/title — use the event type so issues read
    // like "case.create_failed" rather than a generic "Error".
    err.name = event.event_type || 'ServerError';

    Sentry.captureException(err, {
      level: 'error',
      tags: {
        event_type: event.event_type,
        error_code: event.error_code || 'INTERNAL_ERROR',
        resource_type: event.resource_type,
      },
      extra: {
        correlation_id: event.correlation_id,
        resource_id: event.resource_id,
        actor_user_id: event.actor_user_id,
        metadata: event.metadata,
      },
    });
  } catch {
    // Monitoring must never break the request path.
  }
}
