/**
 * Shelter membership authority (the authz.js philosophy: read fresh from
 * the DB, one helper per question).
 *
 * Authority tiers: OWNER (the ShelterProfile.claimedById user, implicit,
 * never a row) > MANAGER > STAFF (ShelterMember rows, ACTIVE only).
 * Members match by linked userId OR by email, covering invites accepted
 * before the account existed (the requirePetAccess dual-match idiom).
 */

import prisma from '@/app/lib/prisma';

/**
 * Which shelter does this user help run, and as what?
 * Returns { shelterId, role: 'OWNER'|'MANAGER'|'STAFF' } or null.
 */
export async function getShelterForUser(userId, email) {
  const claimed = await prisma.shelterProfile.findFirst({
    where: { claimedById: userId },
    select: { shelterId: true },
  });
  if (claimed) return { shelterId: claimed.shelterId, role: 'OWNER' };

  const normalized = email ? email.toLowerCase() : null;
  const member = await prisma.shelterMember.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [{ userId }, ...(normalized ? [{ email: normalized }] : [])],
    },
    select: { shelterId: true, role: true },
  });
  if (member) return { shelterId: member.shelterId, role: member.role };
  return null;
}

/** May this user manage THIS shelter (any tier)? */
export async function userManagesShelter(userId, email, shelterId) {
  const claimed = await prisma.shelterProfile.findFirst({
    where: { shelterId, claimedById: userId },
    select: { shelterId: true },
  });
  if (claimed) return true;

  const normalized = email ? email.toLowerCase() : null;
  const member = await prisma.shelterMember.findFirst({
    where: {
      shelterId,
      status: 'ACTIVE',
      OR: [{ userId }, ...(normalized ? [{ email: normalized }] : [])],
    },
    select: { id: true },
  });
  return Boolean(member);
}

/**
 * Everyone who should hear shelter notifications: the claimer plus every
 * ACTIVE member with a linked account.
 */
export async function getShelterStaffUserIds(shelterId) {
  const [profile, members] = await Promise.all([
    prisma.shelterProfile.findFirst({
      where: { shelterId },
      select: { claimedById: true },
    }),
    prisma.shelterMember.findMany({
      where: { shelterId, status: 'ACTIVE', userId: { not: null } },
      select: { userId: true },
    }),
  ]);
  const ids = new Set(members.map((m) => m.userId));
  if (profile?.claimedById) ids.add(profile.claimedById);
  return [...ids];
}
