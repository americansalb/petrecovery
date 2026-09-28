/**
 * A Rescue Force's Discussion (app/lib/forceDiscussion.js and the posts
 * APIs): what a post may be about, a search party's time and place, the
 * feed's pet cards, and "I am going".
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
import { checkPostFields, PostInputError } from '@/app/lib/forceDiscussion';
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

test("the feed's pet cards: the force's automatic posts get their pet, older ones from the case number in the text", async () => {
  prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'member-mike' });
  prisma.rescueForceMember.findMany.mockResolvedValue([]);
  prisma.squadPostGoing.findMany.mockResolvedValue([]);
  prisma.squadPostGoing.groupBy.mockResolvedValue([]);
  const base = { authorId: 'u-jamie', author: { firstName: 'Jamie' }, comments: [], votes: [], upvotes: 0, commentCount: 0, createdAt: NOW };
  prisma.squadPost.findMany.mockResolvedValue([
    { ...base, id: 'p-new', caseId: 'case-max', kind: 'SIGHTING', title: 'Max was seen near the pool', content: 'Heading west.' },
    { ...base, id: 'p-old', caseId: null, kind: null, title: 'Rocket is missing', content: 'Rocket, a brown dog, was reported lost near Andrew Zilker Road. Case #AUS-2026-HXEN47.' },
    { ...base, id: 'p-words', caseId: null, kind: null, title: null, content: 'Anyone have a trap? Case #AUS-2026-HXEN47 needs one.' },
  ]);
  prisma.case.findMany.mockResolvedValue([
    { id: 'case-max', caseNumber: 'AUS-2026-0001', status: 'ACTIVE', reportType: 'LOST', petName: 'Max', petSpecies: 'DOG', petBreed: 'Golden Retriever', petColor: 'Golden', petPhotoUrl: 'https://cdn/max.jpg', lastSeenAddress: '2100 Barton Springs Rd, Austin, TX', lastSeenAt: new Date('2026-09-24T10:00:00Z'), resolvedAt: null },
    { id: 'case-rocket', caseNumber: 'AUS-2026-HXEN47', status: 'ACTIVE', reportType: 'LOST', petName: 'Rocket', petSpecies: 'DOG', petBreed: null, petColor: 'Brown', petPhotoUrl: null, lastSeenAddress: 'Andrew Zilker Road, Austin, Travis County, Texas, 78703, United States', lastSeenAt: new Date('2026-09-24T10:00:00Z'), resolvedAt: null },
  ]);

  const res = await listPosts(new Request(`http://localhost/api/rescue-forces/${FORCE}/posts?sort=new`), { params: { id: FORCE } });
  expect(res.status).toBe(200);
  const { posts } = await res.json();
  expect(prisma.case.findMany.mock.calls[0][0].where).toEqual({ OR: [{ id: { in: ['case-max'] } }, { caseNumber: { in: ['AUS-2026-HXEN47'] } }] });
  expect(posts[0]).toMatchObject({ kind: 'SIGHTING', pet: { name: 'Max', caseNumber: 'AUS-2026-0001', status: 'lost', line: 'Golden Retriever', near: 'Barton Springs Rd', photo: 'https://cdn/max.jpg' } });
  expect(posts[1]).toMatchObject({ kind: 'LOST', pet: { name: 'Rocket', caseNumber: 'AUS-2026-HXEN47', line: 'Dog, brown', near: 'Andrew Zilker Road' } });
  // A member's own words stay words, whatever case number they mention.
  expect(posts[2]).toMatchObject({ kind: null, pet: null });
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
