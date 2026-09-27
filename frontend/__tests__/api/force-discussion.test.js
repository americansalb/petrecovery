/**
 * A Rescue Force's Discussion (app/lib/forceDiscussion.js and the posts
 * APIs): what a post may be about, a search party's time and place, the
 * Topics counts, and "I am going".
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    caseAssignment: { findFirst: jest.fn() },
    rescueForceMember: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    division: { findFirst: jest.fn() },
    squadPost: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), groupBy: jest.fn(), count: jest.fn() },
    squadPostGoing: { upsert: jest.fn(), deleteMany: jest.fn(), count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    case: { findMany: jest.fn() },
  },
}));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('@/app/lib/authz', () => ({ __esModule: true, isAdmin: jest.fn(async () => false) }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { checkPostFields, discussionSummary, PostInputError } from '@/app/lib/forceDiscussion';
import { POST as createPost, GET as listPosts } from '@/app/api/rescue-forces/[id]/posts/route';
import { POST as setGoing } from '@/app/api/rescue-forces/[id]/posts/[postId]/going/route';

const FORCE = 'force-austin';
const NOW = new Date('2026-09-27T12:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
});

describe('checkPostFields', () => {
  test('no topic, no pet: a plain post', async () => {
    expect(await checkPostFields(FORCE, {}, NOW)).toEqual({ topic: null, caseId: null, eventAt: null, eventPlace: null });
  });

  test('a topic from the list, and a pet this force is looking for', async () => {
    prisma.caseAssignment.findFirst.mockResolvedValue({ missionId: 'case-max' });
    expect(await checkPostFields(FORCE, { topic: 'sighting', caseId: 'case-max' }, NOW)).toMatchObject({ topic: 'SIGHTING', caseId: 'case-max' });
    expect(prisma.caseAssignment.findFirst.mock.calls[0][0].where).toEqual({ rescueSquadId: FORCE, missionId: 'case-max' });

    await expect(checkPostFields(FORCE, { topic: 'GOSSIP' }, NOW)).rejects.toThrow(PostInputError);
    prisma.caseAssignment.findFirst.mockResolvedValue(null);
    await expect(checkPostFields(FORCE, { caseId: 'someone-elses-pet' }, NOW)).rejects.toThrow(/not one this Rescue Force/);
  });

  test('a search party needs a time still to come and a place', async () => {
    const soon = new Date(NOW.getTime() + 24 * 3600e3).toISOString();
    await expect(checkPostFields(FORCE, { topic: 'SEARCH_PARTY', eventPlace: 'Zilker Park' }, NOW)).rejects.toThrow(/when/);
    await expect(checkPostFields(FORCE, { topic: 'SEARCH_PARTY', eventAt: '2026-09-01T09:00:00Z', eventPlace: 'Zilker Park' }, NOW)).rejects.toThrow(/passed/);
    await expect(checkPostFields(FORCE, { topic: 'SEARCH_PARTY', eventAt: soon, eventPlace: '  ' }, NOW)).rejects.toThrow(/where/);
    const ok = await checkPostFields(FORCE, { topic: 'SEARCH_PARTY', eventAt: soon, eventPlace: ' Zilker Park, main lot ' }, NOW);
    expect(ok).toMatchObject({ topic: 'SEARCH_PARTY', eventPlace: 'Zilker Park, main lot' });
    expect(ok.eventAt.toISOString()).toBe(soon);
  });
});

test('discussionSummary: counts per topic, parties to come, posts per pet', async () => {
  prisma.squadPost.groupBy.mockImplementation(async (args) =>
    args.by[0] === 'topic'
      ? [
          { topic: 'SIGHTING', _count: { _all: 7 } },
          { topic: 'QUESTION', _count: { _all: 2 } },
        ]
      : [{ caseId: 'case-max', _count: { _all: 3 } }]
  );
  prisma.squadPost.count.mockResolvedValue(4);
  prisma.squadPost.findMany.mockResolvedValue([{ id: 'p1', caseId: 'case-max' }]);

  const summary = await discussionSummary(
    FORCE,
    [
      { id: 'case-max', name: 'Max', status: 'lost' },
      { id: 'case-luna', name: 'Luna', status: 'lost' },
      { id: 'case-biscuit', name: 'Biscuit', status: 'home' },
    ],
    NOW
  );
  expect(summary.topics).toMatchObject({
    SEARCH_PARTY: { upcoming: 1 },
    SIGHTING: { thisWeek: 4, total: 7 },
    QUESTION: { total: 2 },
    FLYERS: { total: 0 },
  });
  expect(summary.pets.map((p) => [p.name, p.posts, p.parties])).toEqual([
    ['Max', 3, 1],
    ['Luna', 0, 0],
  ]);
});

describe('posting', () => {
  const post = (body) =>
    createPost(new Request(`http://localhost/api/rescue-forces/${FORCE}/posts`, { method: 'POST', body: JSON.stringify(body) }), {
      params: { id: FORCE },
    });

  test('a member posts a sighting about a pet; a bad field is refused in words', async () => {
    prisma.rescueForceMember.findUnique.mockResolvedValue({ isActive: true, role: 'MEMBER' });
    prisma.caseAssignment.findFirst.mockResolvedValue({ missionId: 'case-max' });
    prisma.squadPost.create.mockImplementation(async ({ data }) => ({ id: 'p1', ...data, author: { firstName: 'Mike' }, division: null, createdAt: NOW }));

    const res = await post({ content: 'Saw him by the pool at 4.', topic: 'SIGHTING', caseId: 'case-max' });
    expect(res.status).toBe(200);
    expect(prisma.squadPost.create.mock.calls[0][0].data).toMatchObject({ topic: 'SIGHTING', caseId: 'case-max', content: 'Saw him by the pool at 4.' });

    const bad = await post({ content: 'Meet up', topic: 'SEARCH_PARTY' });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/when/);
  });

  test('not a member: no post, and the fields are not even looked at', async () => {
    prisma.rescueForceMember.findUnique.mockResolvedValue(null);
    expect((await post({ content: 'hi', caseId: 'case-max' })).status).toBe(403);
    expect(prisma.caseAssignment.findFirst).not.toHaveBeenCalled();
  });
});

test('the feed filters by topic and pet, pages with before, and lists parties to come', async () => {
  prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'member-mike' });
  prisma.squadPost.findMany.mockResolvedValue([]);
  prisma.rescueForceMember.findMany.mockResolvedValue([]);
  const get = (qs) => listPosts(new Request(`http://localhost/api/rescue-forces/${FORCE}/posts?${qs}`), { params: { id: FORCE } });

  await get('sort=new&topic=SIGHTING&caseId=case-max&before=2026-09-20T00:00:00.000Z');
  expect(prisma.squadPost.findMany.mock.calls[0][0].where).toMatchObject({
    rescueSquadId: FORCE,
    topic: 'SIGHTING',
    caseId: 'case-max',
    createdAt: { lt: new Date('2026-09-20T00:00:00.000Z') },
  });

  await get('topic=NOT_A_TOPIC');
  expect(prisma.squadPost.findMany.mock.calls[1][0].where.topic).toBeUndefined();

  await get('upcoming=1');
  const upcoming = prisma.squadPost.findMany.mock.calls[2][0];
  expect(upcoming.where).toMatchObject({ topic: 'SEARCH_PARTY', eventAt: { gte: expect.any(Date) } });
  expect(upcoming.orderBy).toEqual({ eventAt: 'asc' });
});

describe('I am going', () => {
  const going = (value) =>
    setGoing(
      new Request(`http://localhost/api/rescue-forces/${FORCE}/posts/p1/going`, { method: 'POST', body: JSON.stringify({ going: value }) }),
      { params: Promise.resolve({ id: FORCE, postId: 'p1' }) }
    );

  test('a member says yes, then no', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'member-mike' });
    prisma.squadPost.findFirst.mockResolvedValue({ id: 'p1', eventAt: new Date(Date.now() + 3600e3) });
    prisma.squadPostGoing.count.mockResolvedValue(3);

    expect(await (await going(true)).json()).toEqual({ going: true, goingCount: 3 });
    expect(prisma.squadPostGoing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { postId_userId: { postId: 'p1', userId: 'u-mike' } } })
    );
    // Only this force's search party posts.
    expect(prisma.squadPost.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'p1', rescueSquadId: FORCE, topic: 'SEARCH_PARTY' });

    prisma.squadPostGoing.count.mockResolvedValue(2);
    expect(await (await going(false)).json()).toEqual({ going: false, goingCount: 2 });
    expect(prisma.squadPostGoing.deleteMany).toHaveBeenCalledWith({ where: { postId: 'p1', userId: 'u-mike' } });
  });

  test('refused: signed out, not a member, not a party, a party that is over', async () => {
    getServerSession.mockResolvedValueOnce(null);
    expect((await going(true)).status).toBe(401);

    prisma.rescueForceMember.findFirst.mockResolvedValueOnce(null);
    expect((await going(true)).status).toBe(403);

    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'member-mike' });
    prisma.squadPost.findFirst.mockResolvedValueOnce(null);
    expect((await going(true)).status).toBe(404);

    prisma.squadPost.findFirst.mockResolvedValueOnce({ id: 'p1', eventAt: new Date(Date.now() - 24 * 3600e3) });
    expect((await going(true)).status).toBe(409);
    expect(prisma.squadPostGoing.upsert).not.toHaveBeenCalled();
  });
});
