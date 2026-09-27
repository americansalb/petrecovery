/**
 * A Rescue Force's Discussion: what a post can be about, the checks a new
 * post goes through, and the Topics view's counts. The feed itself is
 * /api/rescue-forces/[id]/posts; "I am going" is .../posts/[postId]/going.
 *
 * A post can be about one pet (a case assigned to the force) and have a
 * topic. A search party is a post with a time and a place to meet, and
 * members say they are going.
 */

import prisma from '@/app/lib/prisma';

export const POST_TOPICS = {
  SIGHTING: 'Sighting',
  SEARCH_PARTY: 'Search party',
  QUESTION: 'Question',
  FLYERS: 'Flyers',
  HELLO: 'Say hello',
};

const WEEK = 7 * 24 * 3600e3;
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

/**
 * The Topics view: how many posts of each kind, the search parties still
 * to come, and the pets being looked for with how many posts are about each.
 * `pets` is the force page's pet list (app/lib/forcePage.js).
 */
export async function discussionSummary(forceId, pets = [], now = new Date()) {
  const live = pets.filter((p) => p.status === 'lost' || p.status === 'found');
  const [byTopic, sightingsThisWeek, upcoming, byPet] = await Promise.all([
    prisma.squadPost.groupBy({
      by: ['topic'],
      where: { rescueSquadId: forceId, isDeleted: false, topic: { not: null } },
      _count: { _all: true },
    }),
    prisma.squadPost.count({
      where: { rescueSquadId: forceId, isDeleted: false, topic: 'SIGHTING', createdAt: { gte: new Date(now.getTime() - WEEK) } },
    }),
    prisma.squadPost.findMany({
      where: { rescueSquadId: forceId, isDeleted: false, topic: 'SEARCH_PARTY', eventAt: { gte: now } },
      orderBy: { eventAt: 'asc' },
      select: { id: true, caseId: true },
      take: 20,
    }),
    live.length
      ? prisma.squadPost.groupBy({
          by: ['caseId'],
          where: { rescueSquadId: forceId, isDeleted: false, caseId: { in: live.map((p) => p.id) } },
          _count: { _all: true },
        })
      : [],
  ]);

  const topicCount = Object.fromEntries(byTopic.map((r) => [r.topic, r._count._all]));
  const postsByPet = new Map(byPet.map((r) => [r.caseId, r._count._all]));
  const partiesByPet = new Map();
  upcoming.forEach((p) => {
    if (p.caseId) partiesByPet.set(p.caseId, (partiesByPet.get(p.caseId) || 0) + 1);
  });

  return {
    topics: {
      SEARCH_PARTY: { upcoming: upcoming.length },
      SIGHTING: { thisWeek: sightingsThisWeek, total: topicCount.SIGHTING || 0 },
      QUESTION: { total: topicCount.QUESTION || 0 },
      FLYERS: { total: topicCount.FLYERS || 0 },
      HELLO: { total: topicCount.HELLO || 0 },
    },
    pets: live.map((p) => ({
      id: p.id,
      name: p.name,
      photo: p.photo,
      species: p.species,
      status: p.status,
      posts: postsByPet.get(p.id) || 0,
      parties: partiesByPet.get(p.id) || 0,
    })),
  };
}
