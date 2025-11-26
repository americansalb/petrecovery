/**
 * Permission Helper Module
 * Centralized permission checks with structured event logging.
 */

import { logEvent } from '@/lib/logging';

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
    this.status = 403; // For compatibility
  }
}

/**
 * Get user's role from session
 */
export function getUserRole(session) {
  return session?.user?.role || null;
}

/**
 * Get user ID from session
 */
export function getUserId(session) {
  return session?.user?.id || null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(session) {
  return !!session?.user?.id;
}

/**
 * Check if user is ADMIN
 */
export function isAdmin(session) {
  return getUserRole(session) === 'ADMIN';
}

/**
 * Check if user is staff (ADMIN or MODERATOR)
 */
export function isStaff(session) {
  const role = getUserRole(session);
  return role === 'ADMIN' || role === 'MODERATOR';
}

/**
 * Check if user has PATROL or higher role
 */
export function isPatrol(session) {
  const role = getUserRole(session);
  return ['ADMIN', 'MODERATOR', 'PATROL'].includes(role);
}

/**
 * Require authentication - throws PermissionError if not authenticated
 */
export function requireAuth(session, action = 'perform this action') {
  if (!session?.user) {
    throw new PermissionError('Authentication required', { action });
  }
}

/**
 * Require ADMIN role or throw
 */
export async function requireAdmin(session, context = {}) {
  const role = getUserRole(session);
  const action = typeof context === 'string' ? context : (context.action || 'perform this action');

  if (role !== 'ADMIN') {
    await logEvent({
      event_type: 'auth.permission_denied',
      resource_type: context.resource_type || 'unknown',
      action: action,
      result: 'failure',
      error_code: 'INSUFFICIENT_PERMISSIONS',
      error_message: `User with role ${role} attempted to access ADMIN-only resource`,
      actor_user_id: session?.user?.id || null,
      actor_role: role,
      metadata: {
        required_role: 'ADMIN',
        ...context
      }
    });

    throw new PermissionError('Admin access required', {
      required: 'ADMIN',
      actual: role,
      action
    });
  }
}

/**
 * Require ADMIN or MODERATOR role
 */
export async function requireStaff(session, context = {}) {
  const role = getUserRole(session);
  const action = typeof context === 'string' ? context : (context.action || 'perform this action');

  if (role !== 'ADMIN' && role !== 'MODERATOR') {
    await logEvent({
      event_type: 'auth.permission_denied',
      resource_type: context.resource_type || 'unknown',
      action: action,
      result: 'failure',
      error_code: 'INSUFFICIENT_PERMISSIONS',
      error_message: `User with role ${role} attempted to access staff resource`,
      actor_user_id: session?.user?.id || null,
      actor_role: role,
      metadata: {
        required_role: 'ADMIN or MODERATOR',
        ...context
      }
    });

    throw new PermissionError('Staff access required', {
      required: 'ADMIN or MODERATOR',
      actual: role,
      action
    });
  }
}

// Alias for compatibility
export const requireStaffOrAdmin = requireStaff;

/**
 * Require PATROL or higher role
 */
export async function requirePatrol(session, context = {}) {
  const role = getUserRole(session);
  const action = typeof context === 'string' ? context : (context.action || 'perform this action');

  if (!['ADMIN', 'MODERATOR', 'PATROL'].includes(role)) {
    await logEvent({
      event_type: 'auth.permission_denied',
      resource_type: context.resource_type || 'unknown',
      action: action,
      result: 'failure',
      error_code: 'INSUFFICIENT_PERMISSIONS',
      error_message: `User with role ${role} attempted to access patrol resource`,
      actor_user_id: session?.user?.id || null,
      actor_role: role,
      metadata: {
        required_role: 'PATROL+',
        ...context
      }
    });

    throw new PermissionError('Patrol access required', {
      required: 'PATROL+',
      actual: role,
      action
    });
  }
}

/**
 * Check if user can access a specific resource
 */
export function canAccessResource(session, resourceOwnerId) {
  if (!session?.user) return false;
  if (isStaff(session)) return true;
  return session.user.id === resourceOwnerId;
}

/**
 * Require access to a specific resource
 */
export async function requireResourceAccess(session, resourceOwnerId, context = {}) {
  const action = typeof context === 'string' ? context : (context.action || 'access this resource');

  if (!session?.user) {
    throw new PermissionError('Authentication required', { action });
  }

  if (!canAccessResource(session, resourceOwnerId)) {
    await logEvent({
      event_type: 'auth.permission_denied',
      resource_type: context.resource_type || 'unknown',
      action: action,
      result: 'failure',
      error_code: 'INSUFFICIENT_PERMISSIONS',
      error_message: 'User attempted to access resource they do not own',
      actor_user_id: session.user.id,
      actor_role: session.user.role,
      metadata: {
        resourceOwnerId,
        ...context
      }
    });

    throw new PermissionError(`You don't have permission to ${action}`, {
      action
    });
  }
}

/**
 * Check if user can edit case
 * MVP: Only ADMIN can edit all cases
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

  return false;
}

/**
 * Check if user can assign case coordinator or squad
 * MVP: Only ADMIN
 */
export function canAssignCase(session) {
  return getUserRole(session) === 'ADMIN';
}

