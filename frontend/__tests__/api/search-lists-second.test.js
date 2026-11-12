/**
 * The second set of older routes about one pet's search:
 *
 *   /api/missions/[missionId]/chat                 the older case chat
 *   /api/mission/[missionId]/flyers                where flyers went up
 *   /api/mission/[missionId]/points (+ leaderboard) who did the most
 *   /api/mission/[missionId]/shelters (+ one)      shelters and the calls made to them
 *   /api/mission/[missionId]/tasks                 who is on each task
 *   /api/mission/[missionId]/tips  (POST)          make the tips again
 *   /api/mission/[missionId]/grid                  the older board of blocks
 *
 * Each answered any account, for any pet, and named people by account id
 * and often by full name; three of them let any account write onto someone
 * else's search. They are for the owner, an active member of a force
 * looking for the pet, and staff (`mayKnowThePeople`). People are first
 * names, and what is written is checked and held to a length.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findFirst: jest.fn(), findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    squadActivity: { findMany: jest.fn(), create: jest.fn() },
    caseAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
    rescueForce: { upsert: jest.fn() },
    flyerPosting: { findMany: jest.fn(), count: jest.fn() },
    verifiedAction: { groupBy: jest.fn(), aggregate: jest.fn() },
    shelterContact: { findMany: jest.fn(), groupBy: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    squadTask: { findMany: jest.fn() },
    searchSession: { aggregate: jest.fn() },
    searchGrid: { findUnique: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn(async () => ({ success: true })),
  rateLimitResponse: () => new Response('{}', { status: 429 }),
  RateLimitPresets: { SEARCH_READ: {} },
}));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => ({})) }));
jest.mock('@/app/lib/searchBoard', () => ({ __esModule: true, ensureGrid: jest.fn(async () => ({ id: 'grid-1' })), sweepStaleClaims: jest.fn(async () => 0) }));
jest.mock('@/lib/actions', () => {
  const verification = { verifyFlyerPosting: jest.fn(async () => ({ flyerId: 'f-new', pointsEarned: 5, isVerified: true })), logShelterCall: jest.fn(async () => ({ attemptId: 'at-1', pointsEarned: 2, remainingDaily: 3 })) };
  const tips = { getTipContext: jest.fn(async () => ({})), generateTips: jest.fn(async () => []), saveTips: jest.fn(async () => {}), getActiveTips: jest.fn(async () => []) };
  const points = { getCaseLeaderboard: jest.fn(async () => ({ entries: [{ userId: 'u-dana', userName: 'Dana Okafor', points: 40, rank: 1 }, { userId: 'u-avery', userName: 'Avery Lindqvist', points: 10, rank: 2 }] })) };
  return {
    __esModule: true,
    getPointsService: () => points,
    __points: points,
    getVerificationService: () => verification,
    getEmailService: () => ({ sendShelterEmail: jest.fn() }),
    getTipService: () => tips,
    getCellId: () => 'cell',
    __verification: verification,
    __tips: tips,
  };
});

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { searcherFor } from '@/app/lib/searcher';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import * as actions from '@/lib/actions';
import { GET as chatGET, POST as chatPOST } from '@/app/api/missions/[missionId]/chat/route';
import { GET as flyersGET, POST as flyersPOST } from '@/app/api/mission/[missionId]/flyers/route';
import { GET as boardGET } from '@/app/api/mission/[missionId]/points/leaderboard/route';
import { GET as pointsGET } from '@/app/api/mission/[missionId]/points/route';
import { GET as sheltersGET, POST as sheltersPOST } from '@/app/api/mission/[missionId]/shelters/route';
import { GET as shelterGET, POST as shelterPOST } from '@/app/api/mission/[missionId]/shelters/[shelterId]/route';
import { GET as tasksGET } from '@/app/api/mission/[missionId]/tasks/route';
import { POST as tipsPOST } from '@/app/api/mission/[missionId]/tips/route';
import { GET as gridGET } from '@/app/api/mission/[missionId]/grid/route';
import { GET as forcesGET } from '@/app/api/missions/[missionId]/assign-squad/route';

const CASE = 'case-max';
const ctx = { params: Promise.resolve({ missionId: CASE, shelterId: 'sh-1' }) };
const req = (path, body) =>
  new NextRequest(`http://localhost/api/${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

const OWNER = { userId: 'u-avery', seesNames: true, isOwner: true };
const MEMBER = { userId: 'u-mike', seesNames: true, isOwner: false };
const STRANGER = { userId: 'u-x', seesNames: false, isOwner: false };
const as = (who) => {
  getServerSession.mockResolvedValue(who ? { user: { id: who.userId, email: `${who.userId}@example.com` } } : null);
  searcherFor.mockResolvedValue(who);
};
const keysDeep = (value, into = new Set()) => {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, into));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => { into.add(k); keysDeep(v, into); });
  return into;
};
// Never in an answer about other people: an account's id, a last name, or how to reach them.
const PRIVATE = ['userId', 'actorId', 'lastName', 'claimedById', 'assignedToId', 'createdById', 'completedById'];

const DANA = { id: 'u-dana', firstName: 'Dana Lee', lastName: 'Okafor' };

beforeEach(() => {
  jest.clearAllMocks();
  withRateLimitAsync.mockResolvedValue({ success: true });
  prisma.case.findFirst.mockResolvedValue({ id: CASE });
  prisma.case.findUnique.mockResolvedValue({ id: CASE, reporterId: 'u-avery', lastSeenLatitude: 30.3, lastSeenLongitude: -97.7, createdAt: new Date(0), petName: 'Max', pet: { species: 'DOG' } });
  prisma.user.findUnique.mockImplementation(async ({ where }) => ({ id: where.id || String(where.email || '').split('@')[0], role: 'USER', firstName: 'Kim', lastName: 'Lee' }));
  prisma.user.findMany.mockResolvedValue([DANA]);
  prisma.squadActivity.findMany.mockResolvedValue([{ id: 'm1', actorId: 'u-dana', message: 'Checked the alley', createdAt: new Date(0), actor: DANA }]);
  prisma.squadActivity.create.mockImplementation(async ({ data }) => ({ id: 'm-new', createdAt: new Date(0), actor: { firstName: 'Avery' }, ...data }));
  prisma.caseAssignment.findFirst.mockResolvedValue({ rescueSquadId: 'force-1' });
  prisma.flyerPosting.findMany.mockResolvedValue([{ id: 'f1', latitude: 30.3, longitude: -97.7, photoUrl: null, notes: 'On the pole', pointsEarned: 5, createdAt: new Date(0), userId: 'u-dana', user: DANA }]);
  prisma.flyerPosting.count.mockResolvedValue(1);
  prisma.verifiedAction.groupBy.mockResolvedValue([{ userId: 'u-dana', _sum: { totalPoints: 40 } }, { userId: 'u-avery', _sum: { totalPoints: 10 } }]);
  prisma.verifiedAction.aggregate.mockResolvedValue({ _sum: { totalPoints: 10 } });
  const attempt = { id: 'at-1', method: 'CALL', createdAt: new Date(0), user: DANA, callOutcome: 'NO_ANSWER', staffResponse: null, notes: 'Rang out' };
  const shelter = { id: 'sh-1', placeId: 'p1', shelterName: 'Austin Animal Center', shelterAddress: '7201 Levander Loop', shelterPhone: '5125550100', shelterEmail: null, shelterType: 'SHELTER', latitude: 30.25, longitude: -97.69, status: 'NOT_CONTACTED', attempts: [attempt], _count: { attempts: 1 }, notes: null };
  prisma.shelterContact.findMany.mockResolvedValue([shelter]);
  prisma.shelterContact.groupBy.mockResolvedValue([{ status: 'NOT_CONTACTED', _count: 1 }]);
  prisma.shelterContact.findUnique.mockResolvedValue(null);
  prisma.shelterContact.findFirst.mockResolvedValue(shelter);
  prisma.shelterContact.create.mockImplementation(async ({ data }) => ({ id: 'sh-new', ...data }));
  prisma.squadTask.findMany.mockResolvedValue([{ id: 't1', taskType: 'FLYERS', title: 'Flyers on Ramsey Ave', status: 'OPEN', participants: [{ joinedAt: new Date(0), user: { id: 'u-dana', firstName: 'Dana' } }, { joinedAt: new Date(0), user: { id: 'u-avery', firstName: 'Avery' } }], completedAt: null, completedBy: null }]);
  prisma.searchSession.aggregate.mockResolvedValue({ _sum: { distanceMiles: 1.5 }, _count: 2 });
  prisma.searchGrid.findUnique.mockResolvedValue({ id: 'grid-1', centerLatitude: 30.3, centerLongitude: -97.7, radiusMiles: 1, cellSizeMeters: 200, totalCells: 2, cells: [
    { id: 'c1', row: 0, col: 0, status: 'IN_PROGRESS', claimedById: 'u-dana', claimedAt: new Date(0) },
    { id: 'c2', row: 0, col: 1, status: 'UNSEARCHED', claimedById: null, claimedAt: null },
  ] });
  as(OWNER);
});

const READS = [
  ['the older case chat', () => chatGET(req(`missions/${CASE}/chat`), ctx), () => prisma.squadActivity.findMany],
  ['where flyers went up', () => flyersGET(req(`mission/${CASE}/flyers`), ctx), () => prisma.flyerPosting.findMany],
  ['who did the most', () => boardGET(req(`mission/${CASE}/points/leaderboard`), ctx), () => prisma.verifiedAction.groupBy],
  ['the points on a search', () => pointsGET(req(`mission/${CASE}/points`), ctx), () => actions.__points.getCaseLeaderboard],
  ['the shelters', () => sheltersGET(req(`mission/${CASE}/shelters`), ctx), () => prisma.shelterContact.findMany],
  ['one shelter and its calls', () => shelterGET(req(`mission/${CASE}/shelters/sh-1`), ctx), () => prisma.shelterContact.findFirst],
  ['who is on each task', () => tasksGET(req(`mission/${CASE}/tasks`), ctx), () => prisma.squadTask.findMany],
];

describe.each(READS)('%s', (_what, read, table) => {
  test('nobody signed in: 401, and nothing is read', async () => {
    as(null);
    expect((await read()).status).toBe(401);
    expect(table()).not.toHaveBeenCalled();
  });

  test('a signed-in stranger: 403, and nothing is read', async () => {
    as(STRANGER);
    expect((await read()).status).toBe(403);
    expect(table()).not.toHaveBeenCalled();
  });

  test.each([['the owner', OWNER], ['a member of a force looking for the pet', MEMBER]])('%s reads it, with no account id or last name in it', async (_who, who) => {
    as(who);
    const res = await read();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect([...keysDeep(body)].filter((k) => PRIVATE.includes(k))).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/Okafor|Lindqvist|u-dana/);
  });

  test('staff read it, by the role the database has', async () => {
    as(STRANGER);
    prisma.user.findUnique.mockImplementation(async ({ where }) => ({ id: where.id || 'u-x', role: 'ADMIN', firstName: 'Kim' }));
    expect((await read()).status).toBe(200);
  });
});

describe('what a reader is told about people', () => {
  test('the chat: a first name, and which messages are the reader\'s own', async () => {
    prisma.squadActivity.findMany.mockResolvedValue([
      { id: 'm1', actorId: 'u-dana', message: 'Checked the alley', createdAt: new Date(0), actor: DANA },
      { id: 'm2', actorId: 'u-avery', message: 'Thank you', createdAt: new Date(1), actor: { firstName: 'Avery' } },
    ]);
    const { messages } = await (await chatGET(req(`missions/${CASE}/chat`), ctx)).json();
    // Oldest first, as the route always gave them.
    expect(messages.map((m) => [m.userName, m.mine])).toEqual([['Avery', true], ['Dana', false]]);
    expect(prisma.squadActivity.findMany.mock.calls[0][0].include.actor.select).toEqual({ firstName: true });
  });

  test('the leaderboard: first names, and the reader\'s own row marked', async () => {
    prisma.user.findMany.mockResolvedValue([DANA, { id: 'u-avery', firstName: 'Avery' }]);
    const { entries } = await (await boardGET(req(`mission/${CASE}/points/leaderboard`), ctx)).json();
    expect(entries).toEqual([
      { userName: 'Dana', mine: false, points: 40, rank: 1 },
      { userName: 'Avery', mine: true, points: 10, rank: 2 },
    ]);
  });

  test('the points on a search: first names, the reader\'s own row marked, and a page of a sensible size', async () => {
    const body = await (await pointsGET(req(`mission/${CASE}/points?limit=100000`), ctx)).json();
    expect(body.leaderboard).toEqual([
      { userName: 'Dana', points: 40, rank: 1, isCurrentUser: false },
      { userName: 'Avery', points: 10, rank: 2, isCurrentUser: true },
    ]);
    expect(Object.keys(body.currentUser).sort()).toEqual(['points', 'rank']);
    expect(actions.__points.getCaseLeaderboard).toHaveBeenCalledWith(CASE, 50);
    await pointsGET(req(`mission/${CASE}/points?limit=abc`), ctx);
    expect(actions.__points.getCaseLeaderboard).toHaveBeenLastCalledWith(CASE, 10);
  });

  test('tasks: first names, the reader\'s own marked', async () => {
    const { tasks } = await (await tasksGET(req(`mission/${CASE}/tasks`), ctx)).json();
    expect(tasks[0].participants.map((p) => [p.name, p.mine])).toEqual([['Dana', false], ['Avery', true]]);
  });
});

describe('the older board of blocks', () => {
  const read = () => gridGET(req(`mission/${CASE}/grid`), { params: { missionId: CASE } });

  test('someone signed in who is not on the search sees which blocks are held, not by whom', async () => {
    as(STRANGER);
    const res = await read();
    expect(res.status).toBe(200);
    const { cells } = await res.json();
    expect(cells.map((c) => [c.claimed, c.claimedByName, c.mine])).toEqual([[true, null, false], [false, null, false]]);
    expect(JSON.stringify(cells)).not.toMatch(/claimedById|u-dana/);
    // Names are not even asked for.
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  test('the owner is told who, by first name, and still no account id', async () => {
    const { cells } = await (await read()).json();
    expect(cells[0]).toMatchObject({ claimed: true, claimedByName: 'Dana', mine: false });
    expect(JSON.stringify(cells)).not.toMatch(/claimedById|u-dana/);
  });

  test('nobody signed in: 401', async () => {
    as(null);
    expect((await read()).status).toBe(401);
  });
});

describe('writing in the chat', () => {
  const write = (body) => chatPOST(req(`missions/${CASE}/chat`, body), ctx);

  test('a signed-in stranger writes nothing', async () => {
    as(STRANGER);
    expect((await write({ content: 'Everyone go home.' })).status).toBe(403);
    expect(prisma.squadActivity.create).not.toHaveBeenCalled();
  });

  test('the owner\'s message is text, held to a length, kept under their own account', async () => {
    const res = await write({ content: `  ${'x'.repeat(2000)}${String.fromCharCode(0x202e)}  ` });
    expect(res.status).toBe(200);
    const { data } = prisma.squadActivity.create.mock.calls[0][0];
    expect(data.message).toHaveLength(500);
    expect(data.message).not.toContain(String.fromCharCode(0x202e));
    expect(data).toMatchObject({ actorId: 'u-avery', caseId: CASE, rescueSquadId: 'force-1', type: 'CHAT_MESSAGE' });
    expect(Object.keys((await res.json()).message).sort()).toEqual(['id', 'mine', 'text', 'timestamp', 'userName']);
  });

  test.each([[''], ['   '], [42], [{ $ne: null }], [['a']]])('%p is not a message: 400', async (content) => {
    expect((await write({ content })).status).toBe(400);
    expect(prisma.squadActivity.create).not.toHaveBeenCalled();
  });

  test('a body that is not an object is refused the same way', async () => {
    expect((await write('junk')).status).toBe(400);
  });

  test('a pet with no force has no chat here, and no force is made for it', async () => {
    prisma.caseAssignment.findFirst.mockResolvedValue(null);
    expect((await write({ content: 'Hello' })).status).toBe(409);
    expect(prisma.rescueForce.upsert).not.toHaveBeenCalled();
    expect(prisma.squadActivity.create).not.toHaveBeenCalled();
  });

  test('counted per connection', async () => {
    withRateLimitAsync.mockResolvedValue({ success: false });
    expect((await write({ content: 'Hello' })).status).toBe(429);
    expect(prisma.squadActivity.create).not.toHaveBeenCalled();
  });
});

describe('marking a flyer', () => {
  const mark = (body) => flyersPOST(req(`mission/${CASE}/flyers`, body), ctx);
  const kept = () => actions.__verification.verifyFlyerPosting.mock.calls.at(-1)[0];

  test('a signed-in stranger marks nothing', async () => {
    as(STRANGER);
    expect((await mark({ latitude: 30.3, longitude: -97.7 })).status).toBe(403);
    expect(actions.__verification.verifyFlyerPosting).not.toHaveBeenCalled();
  });

  test('a place is two real numbers on the globe', async () => {
    for (const body of [{}, { latitude: 'north', longitude: -97.7 }, { latitude: 300, longitude: -97.7 }, { latitude: null, longitude: null }, { latitude: { $gt: 0 }, longitude: 1 }]) {
      expect((await mark(body)).status).toBe(400);
    }
    expect(actions.__verification.verifyFlyerPosting).not.toHaveBeenCalled();
  });

  test('the note is one line held to a length, and a picture is an https address or nothing', async () => {
    expect((await mark({ latitude: 30.3, longitude: -97.7, notes: `On the pole\n${'x'.repeat(900)}`, photoUrl: 'javascript:alert(1)' })).status).toBe(200);
    expect(kept().notes).toHaveLength(300);
    expect(kept().notes).not.toContain('\n');
    expect(kept().photoUrl).toBeUndefined();
    await mark({ latitude: 30.3, longitude: -97.7, notes: { a: 1 }, photoUrl: 'https://cdn.example/flyer.jpg' });
    expect(kept().notes).toBeUndefined();
    expect(kept().photoUrl).toBe('https://cdn.example/flyer.jpg');
    await mark({ latitude: 30.3, longitude: -97.7, photoUrl: 'http://cdn.example/flyer.jpg' });
    expect(kept().photoUrl).toBeUndefined();
    expect(kept()).toMatchObject({ userId: 'u-avery', missionId: CASE, latitude: 30.3, longitude: -97.7 });
  });
});

describe('adding a shelter to someone\'s search', () => {
  const add = (body) => sheltersPOST(req(`mission/${CASE}/shelters`, body), ctx);
  const GOOD = { placeId: 'p9', name: 'Austin Humane Society', address: '124 W Anderson Ln', phone: '(512) 555-0100', email: 'info@shelter.example', type: 'shelter', latitude: 30.35, longitude: -97.71 };

  test('a signed-in stranger adds nothing', async () => {
    as(STRANGER);
    expect((await add(GOOD)).status).toBe(403);
    expect(prisma.shelterContact.create).not.toHaveBeenCalled();
    expect(prisma.shelterContact.findUnique).not.toHaveBeenCalled();
  });

  test('the owner adds one, as written', async () => {
    expect((await add(GOOD)).status).toBe(200);
    expect(prisma.shelterContact.create.mock.calls[0][0].data).toMatchObject({ missionId: CASE, placeId: 'p9', shelterName: 'Austin Humane Society', shelterPhone: '(512) 555-0100', shelterEmail: 'info@shelter.example', shelterType: 'SHELTER', latitude: 30.35, longitude: -97.71, status: 'NOT_CONTACTED' });
  });

  test('a phone that is not a number and an email that is not an address are left out', async () => {
    await add({ ...GOOD, phone: 'call me at <script>', email: 'not an address' });
    expect(prisma.shelterContact.create.mock.calls[0][0].data).toMatchObject({ shelterPhone: null, shelterEmail: null });
  });

  test('held to a length, and one of the three kinds', async () => {
    await add({ ...GOOD, name: 'x'.repeat(900), address: 'y'.repeat(900) });
    const { data } = prisma.shelterContact.create.mock.calls[0][0];
    expect(data.shelterName).toHaveLength(120);
    expect(data.shelterAddress).toHaveLength(200);
    expect((await add({ ...GOOD, type: 'BANK' })).status).toBe(400);
    expect((await add({ ...GOOD, name: { $ne: null } })).status).toBe(400);
    expect((await add({ ...GOOD, latitude: 'x' })).status).toBe(400);
    expect((await add('junk')).status).toBe(400);
    expect(prisma.shelterContact.create).toHaveBeenCalledTimes(1);
  });
});

describe('logging a call to a shelter', () => {
  const log = (body) => shelterPOST(req(`mission/${CASE}/shelters/sh-1`, body), ctx);

  test('a signed-in stranger logs nothing', async () => {
    as(STRANGER);
    expect((await log({ action: 'call', outcome: 'NO_ANSWER' })).status).toBe(403);
    expect(actions.__verification.logShelterCall).not.toHaveBeenCalled();
    expect(prisma.shelterContact.findFirst).not.toHaveBeenCalled();
  });

  test('how it went is one of the known answers, and the note is held to a length', async () => {
    expect((await log({ action: 'call', outcome: 'THEY_SAID_HI' })).status).toBe(400);
    expect(actions.__verification.logShelterCall).not.toHaveBeenCalled();
    expect((await log({ action: 'call', outcome: 'SPOKE_WITH_STAFF', staffResponse: 'MADE_UP', notes: 'n'.repeat(2000) })).status).toBe(200);
    const kept = actions.__verification.logShelterCall.mock.calls[0][0];
    expect(kept).toMatchObject({ userId: 'u-avery', missionId: CASE, shelterContactId: 'sh-1', callOutcome: 'SPOKE_WITH_STAFF' });
    expect(kept.staffResponse).toBeUndefined();
    expect(kept.notes).toHaveLength(500);
  });

  test('email from the site stays switched off', async () => {
    expect((await log({ action: 'email', petName: 'Max' })).status).toBe(410);
  });
});

describe('making the tips again', () => {
  const make = (body) => tipsPOST(req(`mission/${CASE}/tips`, body), ctx);

  test('a signed-in stranger makes nothing', async () => {
    as(STRANGER);
    expect((await make({})).status).toBe(403);
    expect(actions.__tips.saveTips).not.toHaveBeenCalled();
  });

  test('the owner does, and the count sent is a count', async () => {
    expect((await make({ coldSpotsCount: '1e9' })).status).toBe(200);
    expect(actions.__tips.generateTips.mock.calls[0][0].coldSpotsCount).toBe(1000);
    await make({ coldSpotsCount: { $gt: 0 } });
    expect(actions.__tips.generateTips.mock.calls[1][0].coldSpotsCount).toBe(0);
    await make('junk');
    expect(actions.__tips.generateTips.mock.calls[2][0].coldSpotsCount).toBe(0);
  });
});

describe('which forces are on a pet', () => {
  test('the list does not carry the account that accepted the pet for the force', async () => {
    prisma.caseAssignment.findMany.mockResolvedValue([{ id: 'a1', missionId: CASE, rescueSquadId: 'force-1', status: 'ACCEPTED', acceptedById: 'u-sarah', rescueSquad: { id: 'force-1', name: 'Austin' } }]);
    const res = await forcesGET(req(`missions/${CASE}/assign-squad`), { params: { missionId: CASE } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(JSON.stringify(body)).not.toMatch(/acceptedById|u-sarah/);
    expect(body.assignments[0].rescueSquad.name).toBe('Austin');
  });

  test('an address with no pet in it lists nothing, and asks the database nothing', async () => {
    const res = await forcesGET(req('missions/x/assign-squad'), { params: {} });
    expect(res.status).toBe(404);
    expect(prisma.caseAssignment.findMany).not.toHaveBeenCalled();
  });
});
