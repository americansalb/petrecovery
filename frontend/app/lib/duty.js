/**
 * On duty: a member of a Rescue Force says they are around for the next
 * hours (RescueForceMember.onDutyUntil). It decides what wakes their
 * phone (app/lib/wake.js): on duty, a sighting of one of the force's
 * pets, a block that frees up, a need that fits; off duty, the bell and
 * the daily digest only. Duty ends by itself at the hour given, so
 * nobody is "on duty" from a tap they forgot in June.
 */

import prisma from '@/app/lib/prisma';

export const DUTY_HOURS = { default: 12, max: 24 };

/** True when this member row is on duty at `now`. */
export function isOnDuty(member, now = new Date()) {
  return Boolean(member?.onDutyUntil && new Date(member.onDutyUntil).getTime() > now.getTime());
}

/**
 * Go on duty for `hours` (0 or null: off duty). Active members only.
 * Returns { onDutyUntil } (null when off), or null when not a member.
 */
export async function setDuty({ forceId, userId, hours, now = new Date() }) {
  const member = await prisma.rescueForceMember.findFirst({
    where: { rescueSquadId: forceId, userId, isActive: true },
    select: { id: true },
  });
  if (!member) return null;
  const n = Number(hours);
  const onDutyUntil = Number.isFinite(n) && n > 0 ? new Date(now.getTime() + Math.min(n, DUTY_HOURS.max) * 3600e3) : null;
  await prisma.rescueForceMember.update({ where: { id: member.id }, data: { onDutyUntil } });
  return { onDutyUntil: onDutyUntil ? onDutyUntil.toISOString() : null };
}

/**
 * The members of these forces, split into who is on duty and who is not,
 * each person once. `exceptUserId` leaves out the person who caused the
 * event (nobody is told about their own sighting).
 */
export async function membersByDuty(forceIds, { exceptUserId = null, now = new Date() } = {}) {
  if (!forceIds?.length) return { onDuty: [], offDuty: [] };
  const rows = await prisma.rescueForceMember.findMany({
    where: { rescueSquadId: { in: forceIds }, isActive: true, ...(exceptUserId && { userId: { not: exceptUserId } }) },
    select: { userId: true, onDutyUntil: true },
  });
  const onDuty = new Set();
  const offDuty = new Set();
  for (const m of rows) {
    if (isOnDuty(m, now)) onDuty.add(m.userId);
    else if (!onDuty.has(m.userId)) offDuty.add(m.userId);
  }
  for (const id of onDuty) offDuty.delete(id);
  return { onDuty: [...onDuty], offDuty: [...offDuty] };
}

/** How many of a force's members are on duty right now. */
export async function onDutyCount(forceId, now = new Date()) {
  return prisma.rescueForceMember.count({
    where: { rescueSquadId: forceId, isActive: true, onDutyUntil: { gt: now } },
  });
}
