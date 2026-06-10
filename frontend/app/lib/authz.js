/**
 * Shared authorization helpers.
 *
 * Centralizes the "does this user have authority over this case/mission" check
 * used by privileged endpoints (mission command center, targeted notifications).
 *
 * Role is always read FRESH from the DB rather than trusted from the session
 * JWT — a long-lived token can carry a stale role, so security decisions must
 * not rely on it.
 */

import prisma from '@/app/lib/prisma';

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
 *   - the case reporter/owner, OR
 *   - an active MODERATOR/ADMIN of a rescue force assigned to the case.
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
  if (!theCase) return false;
  if (theCase.reporterId === userId) return true;

  // Active leader of an assigned squad?
  const assignments = await prisma.caseAssignment.findMany({
    where: {
      missionId: caseId, // CaseAssignment.missionId is @map("caseId")
      status: { in: ['ACCEPTED', 'ACTIVE'] },
      rescueSquadId: { not: null },
    },
    select: { rescueSquadId: true },
  });
  if (assignments.length === 0) return false;

  const squadIds = assignments.map((a) => a.rescueSquadId);
  const leadership = await prisma.rescueSquadMember.findFirst({
    where: {
      userId,
      rescueSquadId: { in: squadIds },
      isActive: true,
      role: { in: ['MODERATOR', 'ADMIN'] },
    },
    select: { id: true },
  });
  return Boolean(leadership);
}

/**
 * True if the user is an active leader (MODERATOR/ADMIN) of the given squad, or a platform admin.
 */
export async function userIsSquadLeader(userId, rescueSquadId) {
  if (!userId || !rescueSquadId) return false;
  if ((await getUserRole(userId)) === 'ADMIN') return true;

  const membership = await prisma.rescueSquadMember.findFirst({
    where: {
      userId,
      rescueSquadId,
      isActive: true,
      role: { in: ['MODERATOR', 'ADMIN'] },
    },
    select: { id: true },
  });
  return Boolean(membership);
}
