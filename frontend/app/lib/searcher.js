/**
 * Who is searching. Two kinds of people take an area of ground on the board:
 * someone signed in, and someone who joined from the pet's share link
 * with a first name and no account (a MissionVolunteer row,
 * app/lib/missionControl/volunteerOps.js). This is the one place that
 * turns a request into that person, so the board's routes do not each
 * decide how a helper without an account proves who they are.
 *
 * A helper without an account sends the id the join gave them and the
 * device id they joined with, as two headers. The pair is their key: the
 * id alone is not enough, and neither is ever shown to anyone else.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { waiverIsCurrent } from '@/app/lib/waiverVersion';
import prisma from '@/app/lib/prisma';
import { forcesOf } from '@/app/lib/forceFeed';
import { VOLUNTEER_ID_HEADER, VOLUNTEER_KEY_HEADER } from '@/app/lib/searcherHeaders';
// A name is one word, and not a paragraph: a helper types their own, and it is shown to the owner and put in notices.
import { firstWord } from '@/app/lib/searchText';
import { holdsOwnerKey, ownerKeyFrom } from '@/app/lib/ownerKey';

export { VOLUNTEER_ID_HEADER, VOLUNTEER_KEY_HEADER };


/**
 * The person behind a request, for one pet's search, or null for someone
 * only looking. `id` is what the board stores: the user id, or "v:" and the
 * volunteer id. `waiver` is whether they may go out searching (signed, or
 * it is their own pet). `seesNames` is whether the board tells them who
 * is on each area: the owner and the forces looking for the pet do;
 * everyone else sees ground, not people. Joining a force is one tap, so
 * membership lets someone see first names and nothing more: answering a
 * sighting is the owner's alone (app/api/mission/[missionId]/answer).
 * `leads` is who runs the search from the desk: steers it (sends people
 * to an area first, puts one down as searched, widens the search:
 * app/lib/searchZones.js), asks a named helper to search an area and
 * writes to them (app/lib/searchTalk.js). That is the owner, and the
 * site's own admins (who can already change anything on it), and nobody
 * else.
 *
 * A command role in a Rescue Force is not enough, because nobody has to
 * agree to it. A force made by the first report in a town has no leader,
 * and any member of a force with none can take the role
 * (/api/rescue-forces/[id]/claim-leadership); anyone can found a force
 * for a town, and every pet reported there afterwards is assigned to it.
 * So a stranger could reach such a role in two taps, and then redirect a
 * search and write to its helpers in the name of the people running it.
 * Someone else runs a search only once the owner has handed it to them,
 * and that is not built: when it is, it is added here.
 */
const OWNED = { id: true, reporterId: true, ownerName: true, ownerKeyHash: true, ownerKeyAt: true };

/**
 * The owner, known by their key and not by a session. They are the account the report was filed to, for this one
 * search and nothing else of that account. `viaKey` says so, for a screen that wants to tell them how to keep it.
 */
function ownerWithKey(pet) {
  return {
    id: pet.reporterId,
    kind: 'user',
    userId: pet.reporterId,
    volunteerId: null,
    firstName: firstWord(pet.ownerName) || 'The owner',
    isOwner: true,
    waiver: true,
    seesNames: true,
    leads: true,
    admin: false,
    viaKey: true,
  };
}

export async function searcherFor(request, caseId) {
  const session = await getServerSession(authOptions).catch(() => null);
  const userId = session?.user?.id || null;
  if (userId) {
    const [user, pet] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, waiverAcceptedAt: true, waiverVersionAccepted: true, role: true } }),
      prisma.case.findUnique({ where: { id: caseId }, select: OWNED }),
    ]);
    if (user) {
      const isOwner = Boolean(pet && pet.reporterId === userId);
      // Signed in as someone else, on the browser the report was sent from: the key is the owner's.
      if (!isOwner && pet && holdsOwnerKey(request, pet)) return ownerWithKey(pet);
      // Whoever runs the site can run any search on it. That role is given by an existing admin, one account at a
      // time (app/lib/auth.js): unlike a role in a Rescue Force, nobody can reach it by themselves.
      const admin = user.role === 'ADMIN';
      let inForce = false;
      if (!isOwner) {
        const forceIds = await forcesOf(caseId).catch(() => []);
        if (forceIds.length) {
          const roles = await prisma.rescueForceMember.findMany({
            where: { userId, isActive: true, rescueSquadId: { in: forceIds } },
            select: { role: true },
          });
          inForce = roles.length > 0;
        }
      }
      return {
        id: userId,
        kind: 'user',
        userId,
        volunteerId: null,
        firstName: firstWord(user.firstName) || 'A helper',
        isOwner,
        waiver: waiverIsCurrent(user.waiverAcceptedAt, user.waiverVersionAccepted) || isOwner,
        // Agreed to an earlier version: enough to finish ground already taken, not to take more.
        signedBefore: Boolean(user.waiverAcceptedAt),
        seesNames: isOwner || inForce || admin,
        // The owner's, and the site's own admins': see the note above before widening it.
        leads: isOwner || admin,
        admin,
      };
    }
  }
  // Not signed in, with the owner's key for this search: the browser the report was sent from, or the link in the
  // owner's email (app/lib/ownerKey.js). Nothing is looked up for a request that carries no key.
  if (ownerKeyFrom(request, caseId)) {
    const pet = await prisma.case.findUnique({ where: { id: caseId }, select: OWNED }).catch(() => null);
    if (pet && holdsOwnerKey(request, pet)) return ownerWithKey(pet);
  }
  const volunteerId = request.headers.get(VOLUNTEER_ID_HEADER);
  const key = request.headers.get(VOLUNTEER_KEY_HEADER);
  if (volunteerId && key) {
    const volunteer = await prisma.missionVolunteer.findFirst({
      where: { id: String(volunteerId), odId: String(key), mission: { caseId } },
      select: { id: true, displayName: true, waiverAcceptedAt: true, waiverVersionAccepted: true },
    });
    if (volunteer) {
      return {
        id: `v:${volunteer.id}`,
        kind: 'volunteer',
        userId: null,
        volunteerId: volunteer.id,
        firstName: firstWord(volunteer.displayName) || 'A helper',
        isOwner: false,
        waiver: waiverIsCurrent(volunteer.waiverAcceptedAt, volunteer.waiverVersionAccepted),
        signedBefore: Boolean(volunteer.waiverAcceptedAt),
        seesNames: false,
        leads: false,
      };
    }
  }
  return null;
}
