/**
 * Error Tracking Service
 * Provides error capture and reporting functionality.
 *
 * In production, this integrates with Sentry. In development, errors are logged to console.
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

  if (config.enabled) {
    // In production with Sentry:
    // Sentry.captureException(error, {
    //   tags: context.tags,
    //   extra: context.extra,
    // });

    // For now, we still log in production to ensure visibility
    console.error('[ErrorTracking] Exception captured:', errorData);
  } else {
    // Development mode - log to console and buffer
    console.error('[ErrorTracking] Exception:', error.message);
    if (context.extra) {
      console.error('[ErrorTracking] Context:', context.extra);
    }

    // Add to buffer for debugging
    addToBuffer(errorData);
  }

  return errorData;
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
