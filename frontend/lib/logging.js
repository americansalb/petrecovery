/**
 * Structured Event Logging Utility
 *
 * Per LOGGING_STANDARD.md, all meaningful actions must emit structured events.
 * This utility ensures consistent event format across the platform.
 *
 * @see /docs/LOGGING_STANDARD.md for full specification
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Valid event result types
 */
const EVENT_RESULTS = ['success', 'failure'];

/**
 * Valid action types
 */
const EVENT_ACTIONS = ['create', 'update', 'delete', 'read', 'transition'];

/**
 * Valid actor roles
 */
const ACTOR_ROLES = ['OWNER', 'VOLUNTEER', 'SHELTER_ADMIN', 'ADMIN', 'SYSTEM'];

/**
 * Emit a structured event
 *
 * @param {Object} event - Event payload
 * @param {string} event.event_type - Namespaced event type (e.g., "squad.created")
 * @param {string} [event.timestamp] - ISO8601 timestamp (auto-generated if missing)
 * @param {string} [event.correlation_id] - UUID for tracking related events (auto-generated if missing)
 * @param {string|null} [event.actor_user_id] - ID of user who triggered the event
 * @param {string|null} [event.actor_role] - Role of the actor
 * @param {string} event.resource_type - Type of resource (e.g., "squad", "case", "user")
 * @param {string|null} [event.resource_id] - ID of the resource
 * @param {string} event.action - Action performed
 * @param {string} event.result - Result of the action ("success" or "failure")
 * @param {string|null} [event.error_code] - Error code for failures
 * @param {string|null} [event.error_message] - Human-readable error message for failures
 * @param {Object} [event.metadata] - Additional context (kept shallow)
 *
 * @throws {Error} If required fields are missing or invalid
 */
export function logEvent(event) {
  // Validate required fields
  if (!event.event_type || typeof event.event_type !== 'string') {
    throw new Error('logEvent: event_type is required and must be a string');
  }

  if (!event.resource_type || typeof event.resource_type !== 'string') {
    throw new Error('logEvent: resource_type is required and must be a string');
  }

  if (!event.action || !EVENT_ACTIONS.includes(event.action)) {
    throw new Error(`logEvent: action must be one of: ${EVENT_ACTIONS.join(', ')}`);
  }

  if (!event.result || !EVENT_RESULTS.includes(event.result)) {
    throw new Error(`logEvent: result must be one of: ${EVENT_RESULTS.join(', ')}`);
  }

  // Validate actor_role if provided
  if (event.actor_role && !ACTOR_ROLES.includes(event.actor_role)) {
    throw new Error(`logEvent: actor_role must be one of: ${ACTOR_ROLES.join(', ')}, or null`);
  }

  // Build complete event with defaults
  const completeEvent = {
    event_type: event.event_type,
    timestamp: event.timestamp || new Date().toISOString(),
    correlation_id: event.correlation_id || uuidv4(),

    actor_user_id: event.actor_user_id || null,
    actor_role: event.actor_role || null,

    resource_type: event.resource_type,
    resource_id: event.resource_id || null,

    action: event.action,
    result: event.result,

    error_code: event.error_code || null,
    error_message: event.error_message || null,

    metadata: event.metadata || {},
  };

  // Validate metadata size (prevent huge payloads)
  const metadataStr = JSON.stringify(completeEvent.metadata);
  if (metadataStr.length > 10000) {
    throw new Error('logEvent: metadata exceeds maximum size (10KB)');
  }

  // For failures, ensure error_code and error_message are present
  if (completeEvent.result === 'failure') {
    if (!completeEvent.error_code) {
      console.warn('logEvent: failure event missing error_code');
    }
    if (!completeEvent.error_message) {
      console.warn('logEvent: failure event missing error_message');
    }
  }

  // Emit the event
  // For now: structured console output
  // Later: also write to DB/event store
  emitEvent(completeEvent);

  return completeEvent;
}

/**
 * Emit event to configured sinks
 * Currently: console (structured JSON) + database
 * Future: external logging service, etc.
 *
 * @private
 */
async function emitEvent(event) {
  // Structured console output
  const logLevel = event.result === 'failure' ? 'error' : 'log';
  const prefix = event.result === 'failure' ? '❌' : '✅';

  console[logLevel](`${prefix} [${event.event_type}]`, {
    correlation_id: event.correlation_id,
    resource: `${event.resource_type}:${event.resource_id || 'null'}`,
    actor: event.actor_user_id || 'anonymous',
    result: event.result,
    ...(event.error_code && { error_code: event.error_code }),
    ...(event.error_message && { error_message: event.error_message }),
    ...(Object.keys(event.metadata).length > 0 && { metadata: event.metadata }),
  });

  // Write to database (Phase 0.3)
  // Only attempt if we're in a server context (Node.js)
  if (typeof window === 'undefined') {
    try {
      // Dynamic import to avoid bundling Prisma in client code
      const { default: prisma } = await import('@/app/lib/prisma');

      await prisma.eventLog.create({
        data: {
          event_type: event.event_type,
          timestamp: new Date(event.timestamp),
          correlation_id: event.correlation_id,
          actor_user_id: event.actor_user_id,
          actor_role: event.actor_role,
          resource_type: event.resource_type,
          resource_id: event.resource_id,
          action: event.action,
          result: event.result,
          error_code: event.error_code,
          error_message: event.error_message,
          metadata: JSON.stringify(event.metadata),
        },
      });
    } catch (dbError) {
      // Don't throw - logging failures shouldn't crash the app
      console.error('⚠️  [EventLog] Failed to persist event to database:', dbError.message);
    }
  }
}

/**
 * Get or create correlation ID from request context
 * Useful for Next.js API routes to maintain correlation across a request
 *
 * @param {Object} req - Next.js request object
 * @returns {string} Correlation ID
 */
export function getCorrelationId(req) {
  // Check for existing correlation ID in headers
  if (req?.headers?.['x-correlation-id']) {
    return req.headers['x-correlation-id'];
  }

  // Check if we've already set it on the request object
  if (req?._correlationId) {
    return req._correlationId;
  }

  // Generate new one and attach to request
  const correlationId = uuidv4();
  if (req) {
    req._correlationId = correlationId;
  }

  return correlationId;
}

/**
 * Helper to create event context from Next.js API request
 *
 * @param {Object} req - Next.js request object
 * @param {Object} session - NextAuth session (optional)
 * @returns {Object} Partial event context
 */
export function createEventContext(req, session = null) {
  return {
    correlation_id: getCorrelationId(req),
    actor_user_id: session?.user?.id || null,
    // Note: actor_role should be determined by the caller based on user's role
  };
}

/**
 * Pre-configured logging helpers for common patterns
 */
export const EventLogger = {
  /**
   * Log a successful action
   */
  success(event_type, resource_type, resource_id, metadata = {}) {
    return logEvent({
      event_type,
      resource_type,
      resource_id,
      action: 'read', // default, override in metadata if needed
      result: 'success',
      metadata,
    });
  },

  /**
   * Log a failed action
   */
  failure(event_type, resource_type, error_code, error_message, metadata = {}) {
    return logEvent({
      event_type,
      resource_type,
      resource_id: null,
      action: 'read', // default, override in metadata if needed
      result: 'failure',
      error_code,
      error_message,
      metadata,
    });
  },

  /**
   * Log admin action
   */
  admin(event_type, resource_type, actor_user_id, result = 'success', metadata = {}) {
    return logEvent({
      event_type,
      actor_user_id,
      actor_role: 'ADMIN',
      resource_type,
      resource_id: null,
      action: 'read',
      result,
      metadata,
    });
  },
};
