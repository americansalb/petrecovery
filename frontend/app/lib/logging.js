// lib/logging.js
// Structured event logging for PetRecovery.org

/**
 * Log a structured event
 * @param {string} event - Event name (e.g., "public_case.list_viewed")
 * @param {object} data - Event data
 */
export function logEvent(event, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

/**
 * Log an error event
 * @param {string} event - Error event name
 * @param {Error} error - Error object
 * @param {object} context - Additional context
 */
export function logError(event, error, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    error: {
      message: error.message,
      name: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
    ...context,
  };
  console.error(JSON.stringify(entry));
}

/**
 * Log an API request
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {object} data - Additional data (userId, etc.)
 */
export function logRequest(method, path, data = {}) {
  logEvent('api.request', {
    method,
    path,
    ...data,
  });
}

/**
 * Log an API response
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {number} status - HTTP status code
 * @param {number} duration - Request duration in ms
 */
export function logResponse(method, path, status, duration) {
  logEvent('api.response', {
    method,
    path,
    status,
    durationMs: duration,
  });
}
