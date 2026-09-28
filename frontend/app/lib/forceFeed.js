/**
 * The automatic posts in a force's Discussion, posted as the force rather
 * than as a member: a pet reported lost in its area (LOST), a pet found
 * there (FOUND), a sighting of one of its pets (SIGHTING), a pet back home
 * (HOME). Each is a SquadPost with `kind` set and the pet in `caseId`; the
 * Discussion draws it as a pet card, the photo and the things to do, not
 * as someone's words (the discussion tab's DiscussionPost.js). A member's
 * own post has no kind.
 *
 * The wording is here so every route says it the same way, and nothing
 * public carries a house number or the geocoder's whole address: a place
 * is named by placeName (app/lib/needOptions.js), "Burnet Rd", "Zilker
 * Park".
 *
 * Written by app/api/reports/create (LOST), app/lib/forceCoverage.js
 * (FOUND), the sighting routes (SIGHTING) and
 * app/api/missions/[missionId]/status (HOME).
 */

import prisma from '@/app/lib/prisma';
import { placeName } from '@/app/lib/needOptions';
import { caseTitle, known } from '@/app/lib/caseLabels';
import { speciesLabel } from '@/app/lib/species';

export const FEED_KINDS = ['LOST', 'FOUND', 'SIGHTING', 'HOME'];
const LIVE_ASSIGNMENTS = ['ACCEPTED', 'ACTIVE', 'STANDBY'];

/** "Golden Retriever", "Dog, brown": what the pet looks like, in a few words. */
export function petLine(pet) {
  const breed = known(pet.petBreed);
  const color = known(pet.petColor).toLowerCase();
  const what = breed || speciesLabel(pet.petSpecies);
  return color && !what.toLowerCase().includes(color) ? `${what}, ${color}` : what;
}

/**
 * The title and text of an automatic post about a pet. `place` is where
 * (the pet's last-seen place unless given), `note` a sentence to add.
 */
export function feedPost(kind, pet, { place, note } = {}) {
  const name = caseTitle(pet);
  const where = place ?? placeName(pet.lastSeenAddress);
  const near = where ? ` near ${where}` : '';
  const animal = speciesLabel(pet.petSpecies).toLowerCase();
  const add = note ? ` ${note}` : '';
  switch (kind) {
    case 'LOST':
      return { title: `${name} is missing`, content: `${petLine(pet)}. Last seen${near}.${add}` };
    case 'FOUND':
      return {
        title: `A ${animal} was found${near}`,
        content: `Someone found a ${animal}${near} and reported it. Is it one of the pets this force is looking for?${add}`,
      };
    case 'SIGHTING':
      return { title: `${name} was seen${near}`, content: note || '' };
    case 'HOME':
      return { title: `${name} is home`, content: note || `${name} is back with the family.` };
    default:
      throw new Error(`Unknown feed post kind: ${kind}`);
  }
}

/**
 * Which kind an automatic post is, or null for a member's own. Posts from
 * before `kind` existed are told by their wording.
 */
export function kindOf(post) {
  if (post.kind) return post.kind;
  const title = post.title || '';
  if (/ is missing( nearby)?$/.test(title) && /Case #/.test(post.content || '')) return 'LOST';
  if (/^A .+ was found/.test(title)) return 'FOUND';
  return null;
}

/** The forces a pet is with: its live assignments. */
export async function forcesOf(caseId) {
  const rows = await prisma.caseAssignment.findMany({
    where: { missionId: caseId, status: { in: LIVE_ASSIGNMENTS } },
    select: { rescueSquadId: true },
  });
  return [...new Set(rows.map((r) => r.rescueSquadId))];
}

/**
 * The same automatic post in each force's Discussion. Never throws: the
 * report, sighting or status change it follows must not fail for a post.
 * Returns how many were written.
 */
export async function postToForces({ forceIds, authorId, caseId, kind, title, content }) {
  if (!forceIds?.length) return 0;
  try {
    const { count } = await prisma.squadPost.createMany({
      data: forceIds.map((rescueSquadId) => ({ rescueSquadId, authorId, caseId, kind, title, content })),
    });
    return count;
  } catch (error) {
    console.error(`[feed] ${kind} post failed:`, error.message);
    return 0;
  }
}
