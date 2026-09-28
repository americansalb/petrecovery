/**
 * A Rescue Force's Discussion: what a post can be about, and the checks a
 * new post goes through. The feed itself is /api/rescue-forces/[id]/posts;
 * "I am going" is .../posts/[postId]/going; the force's automatic posts
 * about its pets are app/lib/forceFeed.js.
 *
 * A post can be about one pet (a case assigned to the force). A search
 * party is a post with topic SEARCH_PARTY, a time and a place to meet, and
 * members say they are going. The other topics are from the Discussion's
 * first form, kept so older posts still read.
 */

import prisma from '@/app/lib/prisma';

export const POST_TOPICS = {
  SIGHTING: 'Sighting',
  SEARCH_PARTY: 'Search party',
  QUESTION: 'Question',
  FLYERS: 'Flyers',
  HELLO: 'Say hello',
};

const PLACE_MAX = 140;

export class PostInputError extends Error {}

/**
 * The topic, pet and search-party fields of a new post, checked against
 * this force. Throws PostInputError with words for the person posting.
 */
export async function checkPostFields(forceId, body, now = new Date()) {
  const topic = body.topic ? String(body.topic).toUpperCase() : null;
  if (topic && !POST_TOPICS[topic]) throw new PostInputError('Pick what the post is about from the list.');

  let caseId = null;
  if (body.caseId) {
    const assigned = await prisma.caseAssignment.findFirst({
      where: { rescueSquadId: forceId, missionId: String(body.caseId) },
      select: { missionId: true },
    });
    if (!assigned) throw new PostInputError('That pet is not one this Rescue Force is looking for.');
    caseId = assigned.missionId;
  }

  let eventAt = null;
  let eventPlace = null;
  if (topic === 'SEARCH_PARTY') {
    eventAt = body.eventAt ? new Date(body.eventAt) : null;
    if (!eventAt || Number.isNaN(eventAt.getTime())) throw new PostInputError('Say when the search party meets.');
    if (eventAt.getTime() < now.getTime() - 3600e3) throw new PostInputError('That time has already passed.');
    eventPlace = String(body.eventPlace || '').trim().slice(0, PLACE_MAX);
    if (!eventPlace) throw new PostInputError('Say where to meet.');
  }

  return { topic, caseId, eventAt, eventPlace };
}
