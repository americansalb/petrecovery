/**
 * Permission Helper Module (Phase 22-24)
 *
 * Centralized permission checks with structured event logging.
 * All permission failures emit auth.permission_denied events.
 */

import { logEvent } from '@/lib/logging';

/**
 * Get user's role from session (with fallback to USER)
 */
export function getUserRole(session) {
  return session?.user?.role || 'USER';
}

/**
 * Require ADMIN role or throw
 * Logs permission_denied event on failure
 *
 * @param {object} session - NextAuth session object
 * @param {object} context - Additional context for logging
 * @throws {PermissionError} If user doesn't have ADMIN role
 */
export async function requireAdmin(session, context = {}) {
  const role = getUserRole(session);

  if (role !== 'ADMIN') {
    await logEvent({
      event_type: 'auth.permission_denied',
      resource_type: context.resource_type || 'unknown',
      resource_id: context.resource_id || null,
      action: context.action || 'access',
      result: 'failure',
      error_code: 'INSUFFICIENT_PERMISSIONS',
      error_message: `User with role ${role} attempted to access ADMIN-only resource`,
      actor_user_id: session?.user?.id || null,
      actor_role: role,
      metadata: {
        required_role: 'ADMIN',
        attempted_resource: context.resource_type,
        ...context.metadata
      }
    });

    throw new PermissionError('Admin access required', {
      required: 'ADMIN',
      actual: role
    });
  }
}

/**
 * Require ADMIN or MODERATOR role
 *
 * @param {object} session - NextAuth session object
 * @param {object} context - Additional context for logging
 * @throws {PermissionError} If user doesn't have ADMIN or MODERATOR role
 */
export async function requireStaffOrAdmin(session, context = {}) {
  const role = getUserRole(session);

  if (role !== 'ADMIN' && role !== 'MODERATOR') {
    await logEvent({
      event_type: 'auth.permission_denied',
      resource_type: context.resource_type || 'unknown',
      resource_id: context.resource_id || null,
      action: context.action || 'access',
      result: 'failure',
      error_code: 'INSUFFICIENT_PERMISSIONS',
      error_message: `User with role ${role} attempted to access staff resource`,
      actor_user_id: session?.user?.id || null,
      actor_role: role,
      metadata: {
        required_role: 'ADMIN or MODERATOR',
        attempted_resource: context.resource_type,
        ...context.metadata
      }
    });

    throw new PermissionError('Staff access required', {
      required: 'ADMIN or MODERATOR',
      actual: role
    });
  }
}

/**
 * Check if user can edit case
 * MVP: Only ADMIN can edit all cases
 * Future: Also coordinator and squad leaders
 *
 * @param {object} session - NextAuth session object
 * @param {object} caseData - Case data object (optional, for future use)
 * @returns {boolean} True if user can edit
 */
export function canEditCase(session, caseData = null) {
  const role = getUserRole(session);

  // ADMIN can edit all cases
  if (role === 'ADMIN') {
    return true;
  }

  // Future: MODERATOR can edit if they're the coordinator
  // if (role === 'MODERATOR' && caseData?.coordinatorId === session?.user?.id) {
  //   return true;
  // }

  // Future: Squad leaders can edit squad cases
  // if (caseData?.squadId && isSquadLeader(session.user.id, caseData.squadId)) {
  //   return true;
  // }

  return false;
}

/**
 * Check if user can assign case coordinator or squad
 * MVP: Only ADMIN
 *
 * @param {object} session - NextAuth session object
 * @returns {boolean} True if user can assign
 */
export function canAssignCase(session) {
  return getUserRole(session) === 'ADMIN';
}

/**
 * Check if user is admin (synchronous, no logging)
 * For simple UI conditionals
 *
 * @param {object} session - NextAuth session object
 * @returns {boolean} True if user is ADMIN
 */
export function isAdmin(session) {
  return getUserRole(session) === 'ADMIN';
}

/**
 * Check if user is staff (ADMIN or MODERATOR)
 * For simple UI conditionals
 *
 * @param {object} session - NextAuth session object
 * @returns {boolean} True if user is ADMIN or MODERATOR
 */
export function isStaff(session) {
  const role = getUserRole(session);
  return role === 'ADMIN' || role === 'MODERATOR';
}

/**
 * Custom error for permission failures
 * Can be caught and handled with 403 responses
 */
export class PermissionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PermissionError';
    this.details = details;
    this.statusCode = 403;
  }
}
