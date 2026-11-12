/**
 * Shared authorization helpers.
 *
 * Centralizes the "does this user have authority over this case/mission" check
 * used by privileged endpoints (mission command center, targeted notifications).
 *
 * Role is always read FRESH from the DB rather than trusted from the session
 * JWT - a long-lived token can carry a stale role, so security decisions must
 * not rely on it.
 */

import prisma from '@/app/lib/prisma';
import { FORCE_COMMAND_ROLES } from '@/app/lib/forceRoles';

/**
 * Fetch the user's current role straight from the DB. Returns null if missing.
 */
export async function getUserRole(userId) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role ?? null;
}

export async function isAdmin(userId) {
  return (await getUserRole(userId)) === 'ADMIN';
}

/**
 * True if the user may take privileged actions on a case (== mission):
 *   - platform ADMIN, OR
 *   - the case reporter/owner.
 *
 * It used to add a third: an active founder, leader or coordinator of a
 * rescue force assigned to the case. Nobody has to agree to that role
 * (app/lib/searcher.js says why), so it is not authority over someone
 * else's pet. When an owner can hand their search to another person, that
 * person is added here.
 *
 * @param {string} userId
 * @param {string} caseId   The Case id (mission command routes use the caseId as missionId).
 */
export async function userHasCaseAuthority(userId, caseId) {
  if (!userId || !caseId) return false;

  const role = await getUserRole(userId);
  if (role === 'ADMIN') return true;

  const theCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { reporterId: true },
  });
  return Boolean(theCase && theCase.reporterId === userId);
}

/**
 * True if the user is an active founder, leader or coordinator
 * (FORCE_COMMAND_ROLES) of the given squad, or a platform admin.
 */
export async function userIsSquadLeader(userId, rescueSquadId) {
  if (!userId || !rescueSquadId) return false;
  if ((await getUserRole(userId)) === 'ADMIN') return true;

  const membership = await prisma.rescueForceMember.findFirst({
    where: {
      userId,
      rescueSquadId,
      isActive: true,
      role: { in: FORCE_COMMAND_ROLES },
    },
    select: { id: true },
  });
  return Boolean(membership);
}

/**
 * True if the user may read a Rescue Force's own channels (its chat and
 * announcements): an active member of the force, or a platform admin.
 * These used to answer anyone, signed in or not.
 */
export async function userCanReadForceChannels(userId, rescueSquadId) {
  if (!userId || !rescueSquadId) return false;
  const membership = await prisma.rescueForceMember.findFirst({
    where: { userId, rescueSquadId, isActive: true },
    select: { id: true },
  });
  if (membership) return true;
  return (await getUserRole(userId)) === 'ADMIN';
}
