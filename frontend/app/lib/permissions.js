// lib/permissions.js
// Role-based access control for PetRecovery.org

import { logEvent } from './logging';

/**
 * Custom error for permission failures
 */
export class PermissionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PermissionError';
    this.status = 403;
    this.details = details;
  }
}

/**
 * Get user role from session
 * @param {object} session - NextAuth session
 * @returns {string|null} - User role or null
 */
export function getUserRole(session) {
  return session?.user?.role || null;
}

/**
 * Get user ID from session
 * @param {object} session - NextAuth session
 * @returns {string|null} - User ID or null
 */
export function getUserId(session) {
  return session?.user?.id || null;
}

/**
 * Check if user has ADMIN role
 * @param {object} session - NextAuth session
 * @returns {boolean}
 */
export function isAdmin(session) {
  return getUserRole(session) === 'ADMIN';
}

/**
 * Check if user has MODERATOR or ADMIN role
 * @param {object} session - NextAuth session
 * @returns {boolean}
 */
export function isStaff(session) {
  const role = getUserRole(session);
  return role === 'ADMIN' || role === 'MODERATOR';
}

/**
 * Check if user has PATROL or higher role
 * @param {object} session - NextAuth session
 * @returns {boolean}
 */
export function isPatrol(session) {
  const role = getUserRole(session);
  return ['ADMIN', 'MODERATOR', 'PATROL'].includes(role);
}

/**
 * Check if user is authenticated
 * @param {object} session - NextAuth session
 * @returns {boolean}
 */
export function isAuthenticated(session) {
  return !!session?.user?.id;
}

/**
 * Require authentication - throws PermissionError if not authenticated
 * @param {object} session - NextAuth session
 * @param {string} action - Action being attempted (for error message)
 * @throws {PermissionError}
 */
export function requireAuth(session, action = 'perform this action') {
  if (!session?.user) {
    throw new PermissionError('Authentication required', { action });
  }
}

/**
 * Require ADMIN role - throws PermissionError if not admin
 * @param {object} session - NextAuth session
 * @param {string} action - Action being attempted (for error message)
 * @throws {PermissionError}
 */
export function requireAdmin(session, action = 'perform this action') {
  if (!session?.user) {
    throw new PermissionError('Authentication required', { action });
  }
  if (!isAdmin(session)) {
    logEvent('auth.permission_denied', {
      userId: session.user.id,
      role: session.user.role,
      required: 'ADMIN',
      action,
    });
    throw new PermissionError(`Admin access required to ${action}`, {
      action,
      required: 'ADMIN',
      actual: session.user.role,
    });
  }
}

/**
 * Require MODERATOR or ADMIN role - throws PermissionError if not staff
 * @param {object} session - NextAuth session
 * @param {string} action - Action being attempted (for error message)
 * @throws {PermissionError}
 */
export function requireStaff(session, action = 'perform this action') {
  if (!session?.user) {
    throw new PermissionError('Authentication required', { action });
  }
  if (!isStaff(session)) {
    logEvent('auth.permission_denied', {
      userId: session.user.id,
      role: session.user.role,
      required: 'MODERATOR',
      action,
    });
    throw new PermissionError(`Staff access required to ${action}`, {
      action,
      required: 'MODERATOR',
      actual: session.user.role,
    });
  }
}

/**
 * Require PATROL or higher role - throws PermissionError if not patrol+
 * @param {object} session - NextAuth session
 * @param {string} action - Action being attempted (for error message)
 * @throws {PermissionError}
 */
export function requirePatrol(session, action = 'perform this action') {
  if (!session?.user) {
    throw new PermissionError('Authentication required', { action });
  }
  if (!isPatrol(session)) {
    logEvent('auth.permission_denied', {
      userId: session.user.id,
      role: session.user.role,
      required: 'PATROL',
      action,
    });
    throw new PermissionError(`Patrol access required to ${action}`, {
      action,
      required: 'PATROL',
      actual: session.user.role,
    });
  }
}

/**
 * Check if user can access a specific resource
 * @param {object} session - NextAuth session
 * @param {string} resourceOwnerId - Owner of the resource
 * @returns {boolean} - True if user owns resource or is staff
 */
export function canAccessResource(session, resourceOwnerId) {
  if (!session?.user) return false;
  if (isStaff(session)) return true;
  return session.user.id === resourceOwnerId;
}

/**
 * Require access to a specific resource
 * @param {object} session - NextAuth session
 * @param {string} resourceOwnerId - Owner of the resource
 * @param {string} action - Action being attempted
 * @throws {PermissionError}
 */
export function requireResourceAccess(session, resourceOwnerId, action = 'access this resource') {
  if (!session?.user) {
    throw new PermissionError('Authentication required', { action });
  }
  if (!canAccessResource(session, resourceOwnerId)) {
    logEvent('auth.permission_denied', {
      userId: session.user.id,
      role: session.user.role,
      resourceOwnerId,
      action,
    });
    throw new PermissionError(`You don't have permission to ${action}`, {
      action,
    });
  }
}
