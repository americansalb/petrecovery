/**
 * Who is searching. Two kinds of people take a street on the board:
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
import prisma from '@/app/lib/prisma';
import { forcesOf } from '@/app/lib/forceFeed';
import { VOLUNTEER_ID_HEADER, VOLUNTEER_KEY_HEADER } from '@/app/lib/searcherHeaders';

export { VOLUNTEER_ID_HEADER, VOLUNTEER_KEY_HEADER };


// One word, and not a paragraph: a helper types their own, and it is shown to the owner and put in notices.
const firstWord = (s) => (String(s || '').trim().split(/\s+/)[0] || '').slice(0, 30);

/**
 * The person behind a request, for one pet's search, or null for someone
 * only looking. `id` is what a claim stores: the user id, or "v:" and the
 * volunteer id. `waiver` is whether they may go out searching (signed, or
 * it is their own pet). `seesNames` is whether the board tells them who
 * holds each street: the owner and the forces looking for the pet do;
 * everyone else sees streets, not people. Joining a force is one tap, so
 * membership lets someone see first names and nothing more: answering a
 * sighting is the owner's alone (app/api/mission/[missionId]/answer).
 * `leads` is who runs the search from the desk: steers it (sends people
 * to a street first, puts one down as walked: app/lib/searchBoard.js),
 * asks a named helper to walk a street (app/lib/searchAsk.js) and writes
 * to them (app/lib/searchTalk.js). That is the owner, and nobody else.
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
export async function searcherFor(request, caseId) {
  const session = await getServerSession(authOptions).catch(() => null);
  const userId = session?.user?.id || null;
  if (userId) {
    const [user, pet] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, waiverAcceptedAt: true } }),
      prisma.case.findUnique({ where: { id: caseId }, select: { reporterId: true } }),
    ]);
    if (user) {
      const isOwner = Boolean(pet && pet.reporterId === userId);
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
        waiver: Boolean(user.waiverAcceptedAt) || isOwner,
        seesNames: isOwner || inForce,
        // The owner's alone: see the note above before widening it.
        leads: isOwner,
      };
    }
  }
  const volunteerId = request.headers.get(VOLUNTEER_ID_HEADER);
  const key = request.headers.get(VOLUNTEER_KEY_HEADER);
  if (volunteerId && key) {
    const volunteer = await prisma.missionVolunteer.findFirst({
      where: { id: String(volunteerId), odId: String(key), mission: { caseId } },
      select: { id: true, displayName: true, waiverAcceptedAt: true },
    });
    if (volunteer) {
      return {
        id: `v:${volunteer.id}`,
        kind: 'volunteer',
        userId: null,
        volunteerId: volunteer.id,
        firstName: firstWord(volunteer.displayName) || 'A helper',
        isOwner: false,
        waiver: Boolean(volunteer.waiverAcceptedAt),
        seesNames: false,
        leads: false,
      };
    }
  }
  return null;
}
