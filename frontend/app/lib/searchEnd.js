/**
 * The end of a pet's search: the owner marked the pet home, or closed the
 * search (app/api/missions/[missionId]/status).
 *
 * Everyone with an account who helped is told once, in their bell: whoever
 * is on the search's roster (joined from the link, was asked for an area,
 * took or searched one, or exchanged a word with the desk:
 * app/lib/searchTeam.js), whoever sent a sighting, and whoever joined
 * through a Rescue Force's assignment. The members of the forces looking
 * for the pet hear it too, since the Discussion post alone rings no bell.
 * One notice a person, whichever of those they are. The owner and whoever
 * made the change are not told what they did themselves.
 *
 * And the areas people were still on are closed (outcome ENDED: the search
 * ended while they were on it), with any ask nobody started. Left open,
 * the search would go on saying people were out on a pet that is home,
 * and the thank-you screen would count only the few who had pressed "I
 * searched it" before the news came (app/lib/searchZones.js,
 * zoneGroundCovered).
 *
 * Each part stands alone: a table that cannot be read or written costs
 * that part only, and nothing here fails the status change.
 */
import prisma from '@/app/lib/prisma';
import { createBulkNotifications } from '@/app/lib/notifications-inapp';
import { forcesOf } from '@/app/lib/forceFeed';
import { teamOf } from '@/app/lib/searchTeam';
import { known } from '@/app/lib/caseLabels';

/** How a visit ends when the search ends under it. */
export const ENDED = 'ENDED';

/** Ends every visit of the search that is still open. Returns how many. */
export async function closeOpenVisits(caseId, now = Date.now()) {
  const { count } = await prisma.searchZoneVisit.updateMany({ where: { caseId, endedAt: null }, data: { endedAt: new Date(now), outcome: ENDED } });
  return count;
}

const isAccount = (id) => typeof id === 'string' && id.length > 0 && !id.startsWith('v:') && !id.startsWith('m:');

/**
 * The accounts that helped on this search, as a Set of user ids: the
 * roster, whoever sent a sighting, and whoever took part through a force's
 * assignment. Someone who joined from the link without an account has no
 * bell, so is not here.
 */
export async function helpersOf(caseId, { ownerId = null, now = Date.now() } = {}) {
  const [team, sightings, participants] = await Promise.all([
    teamOf(caseId, { ownerId, now }).catch(() => []),
    prisma.caseSighting.findMany({ where: { missionId: caseId, reportedById: { not: null } }, select: { reportedById: true } }).catch(() => []),
    prisma.caseParticipant.findMany({ where: { assignment: { missionId: caseId } }, select: { userId: true } }).catch(() => []),
  ]);
  const ids = [...(team || []).map((p) => p.id), ...(sightings || []).map((s) => s.reportedById), ...(participants || []).map((p) => p.userId)];
  return new Set(ids.filter(isAccount));
}

/** The active members of the forces looking for the pet, as a Set of user ids. */
export async function forceMembersOf(caseId) {
  const forceIds = await forcesOf(caseId).catch(() => []);
  if (!forceIds.length) return new Set();
  const rows = await prisma.rescueForceMember.findMany({ where: { rescueSquadId: { in: forceIds }, isActive: true }, select: { userId: true } }).catch(() => []);
  return new Set((rows || []).map((r) => r.userId).filter(isAccount));
}

/**
 * What each person is told. `helped` is whether they helped on the search
 * themselves (they are thanked) or are in a force looking for the pet.
 */
export function endNotice(pet, status, { helped }) {
  const name = known(pet?.petName) || 'The pet';
  const owner = known(String(pet?.ownerName || '').trim().split(/\s+/)[0]) || 'The owner';
  const thanks = helped ? ' Thank you for helping.' : '';
  if (status === 'REUNITED') {
    return { title: `${name} is home`, message: `${name} is back with the family and the search is over.${thanks}` };
  }
  return { title: `The search for ${name} has ended`, message: `${owner} closed the search for ${name}.${thanks}` };
}

/**
 * The search is over: close what was open and tell everyone. `pet` is the
 * case as it now stands ({ id, caseNumber, petName, ownerName, reporterId }),
 * `status` REUNITED or CLOSED_OTHER, `actorId` whoever made the change.
 * Returns { closed, helpers, members }: how many visits were closed and
 * how many people of each kind were told.
 */
export async function endSearch({ pet, status, actorId = null, now = Date.now() }) {
  const caseId = pet.id;
  const closed = await closeOpenVisits(caseId, now).catch((error) => {
    console.error('[search end] closing visits failed:', error?.message);
    return 0;
  });
  const [helping, members] = await Promise.all([helpersOf(caseId, { ownerId: pet.reporterId || null, now }), forceMembersOf(caseId)]);
  const skip = new Set([pet.reporterId, actorId].filter(Boolean));
  const helpers = [...helping].filter((id) => !skip.has(id));
  const others = [...members].filter((id) => !skip.has(id) && !helping.has(id));
  const kind = status === 'REUNITED' ? 'HOME' : 'CLOSED';
  const base = { type: 'CASE_UPDATE', data: { caseId, caseNumber: pet.caseNumber || null, kind }, actionUrl: pet.caseNumber ? `/cases/${pet.caseNumber}` : null };
  if (helpers.length) await createBulkNotifications(helpers, { ...base, ...endNotice(pet, status, { helped: true }) });
  if (others.length) await createBulkNotifications(others, { ...base, ...endNotice(pet, status, { helped: false }) });
  return { closed, helpers: helpers.length, members: others.length };
}
