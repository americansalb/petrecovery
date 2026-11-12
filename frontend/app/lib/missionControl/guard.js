/**
 * Who may do what on the older mission routes.
 *
 * These routes were written before a helper could prove who they are. They
 * took a volunteer's id out of the request and acted on it, so anyone who
 * learned an id could check that helper out, move them on the map or raise
 * "needs backup" in their name; pausing a search took no check at all and
 * pushed a sentence of the caller's own to every helper's phone. Nothing on
 * the site calls most of them now, which is how they went unnoticed, and it
 * is no reason to leave them open.
 *
 * The rule here is the search screen's (app/lib/searcher.js): a helper is
 * the one the volunteer headers prove, or the signed-in person's own row on
 * this pet's search; the owner is the account that reported the pet; and
 * what runs a search is the owner's alone. A role in a Rescue Force is not
 * enough, for the reason searcher.js gives.
 */
import prisma from '@/app/lib/prisma';
import { searcherFor } from '@/app/lib/searcher';
import { isAdmin } from '@/app/lib/authz';

/**
 * The id of the helper a request may act as on this pet's search, or null.
 * Proven by the volunteer headers, or the signed-in person's own helper row.
 * An id written in the request is never taken on trust.
 */
export async function ownVolunteerId(request, caseId) {
  const searcher = await searcherFor(request, caseId);
  if (!searcher) return null;
  if (searcher.volunteerId) return searcher.volunteerId;
  if (!searcher.userId) return null;
  const row = await prisma.missionVolunteer.findFirst({ where: { userId: searcher.userId, mission: { caseId } }, select: { id: true } });
  return row?.id || null;
}

/**
 * Whether a request may be told who is on a pet's search: the owner, an
 * active member of a force looking for the pet (`seesNames`), or staff.
 * { allowed, status, staff, searcher }: `status` is 401 for nobody at all
 * and 403 for someone who is not one of those.
 */
export async function mayKnowThePeople(request, caseId) {
  const searcher = await searcherFor(request, caseId);
  if (searcher?.seesNames) return { allowed: true, status: 200, staff: false, searcher };
  const staff = searcher?.userId ? await isStaff(searcher.userId) : false;
  return { allowed: staff, status: staff ? 200 : searcher ? 403 : 401, staff, searcher };
}

/**
 * The door of the older routes that hang off one force's assignment to a
 * pet (/api/assignments/[id]/...): the assignment the address names, and
 * whether this request may know the people on that pet's search.
 * { assignment, who, status }: `status` is 404 for no such assignment, 401
 * for nobody at all, 403 for someone who is not the owner, in a force
 * looking for the pet, or staff, and 200 otherwise. `who.searcher.isOwner`
 * and `who.staff` say who may also be told where a helper is.
 */
export async function assignmentDoor(request, assignmentId) {
  const assignment =
    typeof assignmentId === 'string' && assignmentId
      ? await prisma.caseAssignment.findUnique({ where: { id: assignmentId }, select: { id: true, missionId: true, rescueSquadId: true } })
      : null;
  if (!assignment) return { assignment: null, who: null, status: 404 };
  const who = await mayKnowThePeople(request, assignment.missionId);
  return { assignment, who, status: who.allowed ? 200 : who.status };
}

/** Whether this account reported the pet. */
export async function ownsPet(userId, caseId) {
  if (!userId || !caseId) return false;
  const pet = await prisma.case.findUnique({ where: { id: caseId }, select: { reporterId: true } });
  return Boolean(pet && pet.reporterId === userId);
}

/** Whether this account is staff: the role its row in the database has now, never what a session says (app/lib/authz.js). */
export const isStaff = (userId) => isAdmin(userId);

/** A place a phone reports: two real numbers on the globe, and how rough the reading is. Null for anything else. */
export function cleanPlace(location) {
  // A number, or a number written out. Nothing else counts: an empty field is not zero degrees.
  const number = (value) => (typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
  const lat = number(location?.lat);
  const lng = number(location?.lng);
  if (!location || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const accuracy = number(location.accuracy);
  return { lat, lng, ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracy: Math.min(accuracy, 100000) } : {}) };
}
