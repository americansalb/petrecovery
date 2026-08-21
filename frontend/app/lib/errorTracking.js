/**
 * Error Tracking Service
 *
 * This file used to be a stub: every delivery path was a commented-out Sentry
 * call, @sentry/* was never a dependency, initErrorTracking() was never called,
 * and exactly one file imported the module. A server-side exception in
 * production reached stdout and nowhere else - which is how two blocking bugs
 * (a failing report intake and a dead Alerts feature) could have run for weeks
 * unnoticed.
 *
 * It now delivers, without picking a vendor:
 *
 *   1. EventLog, via logEvent() - the pipeline this codebase already has.
 *      /api/admin/health/errors reads failure events out of it and the admin
 *      health dashboard renders them. Server side only; Prisma is not available
 *      in the browser.
 *   2. ERROR_WEBHOOK_URL, if set - a plain JSON POST, so Sentry's ingest, a
 *      Slack hook or anything else works without a code change. This is the
 *      only path that PUSHES; EventLog has to be looked at.
 *
 * Set ERROR_WEBHOOK_URL in production. Without it nothing pages anybody, and
 * assertProductionErrorSink() below says so at boot.
 *
 * Usage:
 * import { captureException, captureMessage, setUser } from '@/app/lib/errorTracking';
 *
 * try {
 *   // risky operation
 * } catch (error) {
 *   captureException(error, { context: 'payment_processing' });
 * }
 */

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Configuration
const config = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production' && !!(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN),
  debug: process.env.NODE_ENV !== 'production',
};

// In-memory error buffer for development
const errorBuffer = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Initialize error tracking (call this in app startup)
 */
export function initErrorTracking() {
  if (!config.enabled) {
    if (config.debug) {
      console.info('[ErrorTracking] Running in development mode - errors logged to console');
    }
    return;
  }

  // In production with Sentry DSN, you would initialize Sentry here:
  // Sentry.init({
  //   dsn: config.dsn,
  //   environment: config.environment,
  //   tracesSampleRate: 0.1,
  //   beforeSend(event) {
  //     // Scrub sensitive data
  //     return event;
  //   },
  // });
}

/**
 * Capture an exception
 * @param {Error} error - The error to capture
 * @param {Object} context - Additional context (tags, extra data)
 */
export function captureException(error, context = {}) {
  const errorData = {
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack,
    },
    context,
    environment: config.environment,
  };

  // Always greppable on stdout, in every environment.
  console.error('[ErrorTracking] Exception:', error?.message, context?.extra || '');
  addToBuffer(errorData);

  // Fire-and-forget: reporting an error must never throw a second one, and must
  // never delay the response the user is waiting for.
  deliver(errorData, context).catch(() => {});

  return errorData;
}

/**
 * Send an error to whatever destinations are configured. Never throws.
 */
async function deliver(errorData, context = {}) {
  const tasks = [];

  // EventLog is server-only (Prisma). Imported lazily so this module stays
  // usable from client components.
  if (!isBrowser) {
    tasks.push(
      import('@/lib/logging')
        .then(({ logEvent }) => logEvent({
          event_type: context.eventType || 'app.exception',
          resource_type: context.resourceType || 'app',
          resource_id: context.resourceId || null,
          action: 'read',
          result: 'failure',
          error_code: errorData.error.name || 'UNHANDLED',
          // Message only - a stack can carry file paths and query fragments.
          error_message: String(errorData.error.message || '').slice(0, 500),
          metadata: {
            environment: errorData.environment,
            ...(context.tags || {}),
          },
        }))
        .catch(() => {})
    );
  }

  const webhook = process.env.ERROR_WEBHOOK_URL;
  if (webhook) {
    tasks.push(
      fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
      }).catch(() => {})
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Call once at boot. Returns true when production has a destination that
 * actually pushes; logs loudly when it does not.
 */
export function assertProductionErrorSink() {
  if (process.env.NODE_ENV !== 'production') return true;
  if (process.env.ERROR_WEBHOOK_URL) return true;

  console.error(
    '[ErrorTracking] No ERROR_WEBHOOK_URL set. Exceptions will be written to ' +
    'EventLog and stdout only, so nothing will alert anyone - somebody has to ' +
    'go and look at /admin/health. Set ERROR_WEBHOOK_URL before launch.'
  );
  return false;
}

/**
 * Capture a message (non-exception events)
 * @param {string} message - The message to capture
 * @param {string} level - Severity level: 'info', 'warning', 'error'
 * @param {Object} context - Additional context
 */
export function captureMessage(message, level = 'info', context = {}) {
  const messageData = {
    timestamp: new Date().toISOString(),
    message,
    level,
    context,
    environment: config.environment,
  };

  if (config.enabled) {
    // In production with Sentry:
    // Sentry.captureMessage(message, {
    //   level,
    //   tags: context.tags,
    //   extra: context.extra,
    // });

    if (level === 'error' || level === 'warning') {
      console.warn(`[ErrorTracking] ${level.toUpperCase()}: ${message}`);
    }
  } else {
    // Development mode
    const logFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
    logFn(`[ErrorTracking] ${level.toUpperCase()}: ${message}`);

    addToBuffer(messageData);
  }

  return messageData;
}

/**
 * Set user context for error tracking
 * @param {Object} user - User information (id, email, etc.)
 */
export function setUser(user) {
  if (config.enabled) {
    // In production with Sentry:
    // Sentry.setUser({
    //   id: user.id,
    //   email: user.email,
    // });
  }
}

/**
 * Clear user context (call on logout)
 */
export function clearUser() {
  if (config.enabled) {
    // In production with Sentry:
    // Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 * @param {string} message - Breadcrumb message
 * @param {string} category - Category (e.g., 'navigation', 'api', 'user')
 * @param {Object} data - Additional data
 */
export function addBreadcrumb(message, category = 'default', data = {}) {
  if (config.enabled) {
    // In production with Sentry:
    // Sentry.addBreadcrumb({
    //   message,
    //   category,
    //   data,
    // });
  }
}

/**
 * Create a wrapped async handler with automatic error capture
 * @param {Function} handler - Async handler function
 * @param {string} name - Handler name for context
 */
export function withErrorTracking(handler, name) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      captureException(error, {
        tags: { handler: name },
        extra: { args: args.length },
      });
      throw error;
    }
  };
}

/**
 * API Route error handler wrapper
 * @param {Function} handler - Route handler
 * @param {string} routeName - Route name for context
 */
export function withApiErrorTracking(handler, routeName) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      captureException(error, {
        tags: {
          type: 'api_error',
          route: routeName,
        },
        extra: {
          method: request.method,
          url: request.url,
        },
      });
      throw error;
    }
  };
}

// Helper to add to error buffer
function addToBuffer(data) {
  errorBuffer.push(data);
  if (errorBuffer.length > MAX_BUFFER_SIZE) {
    errorBuffer.shift(); // Remove oldest
  }
}

/**
 * Get buffered errors (for debugging in development)
 */
export function getBufferedErrors() {
  return [...errorBuffer];
}

/**
 * Clear buffered errors
 */
export function clearBufferedErrors() {
  errorBuffer.length = 0;
}

// Export config for testing
export const __config = config;
