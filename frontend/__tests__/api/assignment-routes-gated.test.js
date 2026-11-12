/**
 * The older routes that hang off one force's assignment to a pet
 * (/api/assignments/[id]/...): participants, messages, search areas,
 * walks, one walk, and sightings.
 *
 * All six readers took no sign-in. With an assignment's id, anyone read
 * each helper's account id and last name, what was said, where sightings
 * were, and every walk whole, with where the helper was. One of them found
 * a walk by its id alone, whatever assignment the address named.
 *
 * They are for the owner, the forces looking for the pet and staff
 * (`assignmentDoor`, app/lib/missionControl/guard.js). People are first
 * names, and where a helper is goes to the owner and staff. The writers
 * take text held to a length and known kinds, and are counted.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    caseAssignment: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    caseParticipant: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    squadMessage: { findMany: jest.fn(), create: jest.fn() },
    searchArea: { findMany: jest.fn(), create: jest.fn() },
    searchSession: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
    petSpotting: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
    case: { update: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    rescueForceMember: { findFirst: jest.fn(async () => null), update: jest.fn() },
    rescueForce: { update: jest.fn(async () => ({})) },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })), rateLimitResponse: () => new Response('{}', { status: 429 }) }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn(async () => {}) }));
jest.mock('@/app/lib/email', () => ({ __esModule: true, sendEmail: jest.fn(async () => {}), escapeHtml: jest.requireActual('@/app/lib/email').escapeHtml }));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'https://reunitepets.test' }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { searcherFor } from '@/app/lib/searcher';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { sendEmail } from '@/app/lib/email';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { GET as participantsGET } from '@/app/api/assignments/[id]/participants/route';
import { GET as messagesGET, POST as messagesPOST } from '@/app/api/assignments/[id]/messages/route';
import { GET as areasGET, POST as areasPOST } from '@/app/api/assignments/[id]/search-areas/route';
import { GET as walksGET } from '@/app/api/assignments/[id]/sessions/route';
import { GET as walkGET } from '@/app/api/assignments/[id]/sessions/[sessionId]/route';
import { GET as sightingsGET, POST as sightingsPOST } from '@/app/api/assignments/[id]/sightings/route';
import { SIGHTINGS_PER_HOUR, OWNER_EMAILS_PER_HOUR } from '@/app/lib/sightingLimits';

const ctx = { params: { id: 'a-1', sessionId: 'walk-1' } };
const req = (path, body) => new NextRequest(`http://localhost/api/assignments/a-1/${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

const OWNER = { userId: 'u-avery', seesNames: true, isOwner: true };
const MEMBER = { userId: 'u-mike', seesNames: true, isOwner: false };
const STRANGER = { userId: 'u-x', seesNames: false, isOwner: false };
const as = (who) => {
  getServerSession.mockResolvedValue(who ? { user: { id: who.userId } } : null);
  searcherFor.mockResolvedValue(who);
};
const keysDeep = (value, into = new Set()) => {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, into));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => { into.add(k); keysDeep(v, into); });
  return into;
};
const PRIVATE = ['userId', 'authorId', 'markedById', 'reportedById', 'lastName', 'email', 'phone', 'notes_private'];
const DANA = { firstName: 'Dana Lee', lastName: 'Okafor', rescueLevel: 'SCOUT' };
const WALK = { id: 'walk-1', status: 'ACTIVE', startedAt: new Date(0), userId: 'u-dana', startLocation: '{"lat":30.3,"lng":-97.7}', currentLocation: '{"lat":30.31,"lng":-97.71}', lastLocationUpdate: new Date(0), participant: { userId: 'u-dana', user: DANA } };

beforeEach(() => {
  jest.clearAllMocks();
  withRateLimitAsync.mockResolvedValue({ success: true });
  prisma.caseAssignment.findUnique.mockResolvedValue({ id: 'a-1', missionId: 'case-max', rescueSquadId: 'force-1', case: { status: 'ACTIVE' } });
  prisma.user.findUnique.mockResolvedValue({ role: 'USER', rescueLevel: 'SCOUT', areasMarkedCount: 0, totalAcreageSearched: 0 });
  prisma.caseParticipant.findMany.mockResolvedValue([{ id: 'p-1', userId: 'u-dana', isActive: true, optedInAt: new Date(0), user: DANA, searchSessions: [{ id: 'walk-1', status: 'ACTIVE', startedAt: new Date(0), lastLocationUpdate: new Date(0), currentLocation: WALK.currentLocation }] }]);
  prisma.squadMessage.findMany.mockResolvedValue([{ id: 'm-1', assignmentId: 'a-1', authorId: 'u-dana', type: 'CHAT', content: 'Checked the alley', createdAt: new Date(0), author: DANA }]);
  prisma.searchArea.findMany.mockResolvedValue([{ id: 'sa-1', assignmentId: 'a-1', markedById: 'u-dana', geometry: '{}', acreage: 2, notes: 'Sheds', markedBy: DANA }]);
  prisma.searchSession.findMany.mockResolvedValue([WALK]);
  prisma.searchSession.findFirst.mockResolvedValue(WALK);
  prisma.petSpotting.findMany.mockResolvedValue([{ id: 'sp-1', assignmentId: 'a-1', reportedById: 'u-dana', latitude: 30.3, longitude: -97.7, address: 'Ramsey Ave', notes: null, reportedBy: DANA }]);
  prisma.petSpotting.count.mockResolvedValue(0);
  prisma.caseParticipant.findUnique.mockResolvedValue({ id: 'p-1', isActive: true });
  as(OWNER);
});

const READS = [
  ['participants', () => participantsGET(req('participants'), ctx), () => prisma.caseParticipant.findMany],
  ['messages', () => messagesGET(req('messages'), ctx), () => prisma.squadMessage.findMany],
  ['search areas', () => areasGET(req('search-areas'), ctx), () => prisma.searchArea.findMany],
  ['walks', () => walksGET(req('sessions'), ctx), () => prisma.searchSession.findMany],
  ['one walk', () => walkGET(req('sessions/walk-1'), ctx), () => prisma.searchSession.findFirst],
  ['sightings', () => sightingsGET(req('sightings'), ctx), () => prisma.petSpotting.findMany],
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

  test('an assignment that does not exist: 404, and nobody is asked who they are', async () => {
    prisma.caseAssignment.findUnique.mockResolvedValue(null);
    expect((await read()).status).toBe(404);
    expect(searcherFor).not.toHaveBeenCalled();
    expect(table()).not.toHaveBeenCalled();
  });

  test.each([['the owner', OWNER], ['a member of a force looking for the pet', MEMBER]])('%s reads it, with no account id or last name in it', async (_who, who) => {
    as(who);
    const res = await read();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect([...keysDeep(body)].filter((k) => PRIVATE.includes(k))).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/Okafor|u-dana/);
    // The gate is on the pet the assignment is for, never on what the request says.
    expect(searcherFor.mock.calls[0][1]).toBe('case-max');
  });
});

describe('where a helper is', () => {
  const places = (body) => JSON.stringify(body).match(/currentLocation|startLocation/g) || [];

  test('goes to the owner', async () => {
    expect(places(await (await participantsGET(req('participants'), ctx)).json())).toEqual(['currentLocation']);
    expect(places(await (await walksGET(req('sessions'), ctx)).json()).sort()).toEqual(['currentLocation', 'startLocation']);
    expect(places(await (await walkGET(req('sessions/walk-1'), ctx)).json()).sort()).toEqual(['currentLocation', 'startLocation']);
  });

  test('and to staff', async () => {
    as(STRANGER);
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    expect(places(await (await walksGET(req('sessions'), ctx)).json()).sort()).toEqual(['currentLocation', 'startLocation']);
  });

  test('not to a member of a force, for someone else\'s walk', async () => {
    as(MEMBER);
    expect(places(await (await participantsGET(req('participants'), ctx)).json())).toEqual([]);
    expect(places(await (await walksGET(req('sessions'), ctx)).json())).toEqual([]);
    expect(places(await (await walkGET(req('sessions/walk-1'), ctx)).json())).toEqual([]);
  });

  test('a walker is told their own', async () => {
    as({ userId: 'u-dana', seesNames: true, isOwner: false });
    const body = await (await walkGET(req('sessions/walk-1'), ctx)).json();
    expect(body.session.mine).toBe(true);
    expect(places(body).sort()).toEqual(['currentLocation', 'startLocation']);
  });
});

describe('one walk is found on the assignment the address names', () => {
  test('never by its id alone', async () => {
    await walkGET(req('sessions/walk-1'), ctx);
    expect(prisma.searchSession.findFirst.mock.calls[0][0].where).toEqual({ id: 'walk-1', participant: { assignmentId: 'a-1' } });
    expect(prisma.searchSession.findUnique).not.toHaveBeenCalled();
  });

  test('a walk on another search is not found', async () => {
    prisma.searchSession.findFirst.mockResolvedValue(null);
    expect((await walkGET(req('sessions/walk-9'), { params: { id: 'a-1', sessionId: 'walk-9' } })).status).toBe(404);
  });
});

describe('the page of messages', () => {
  test('is a sensible size, and a date that is not a date is no filter', async () => {
    await messagesGET(new NextRequest('http://localhost/api/assignments/a-1/messages?limit=100000&before=not-a-date'), ctx);
    const asked = prisma.squadMessage.findMany.mock.calls[0][0];
    expect(asked.take).toBe(200);
    expect(asked.where).toEqual({ assignmentId: 'a-1' });
  });
});

describe('writing a message', () => {
  const write = (body) => messagesPOST(req('messages', body), ctx);
  beforeEach(() => {
    prisma.caseAssignment.findUnique.mockResolvedValue({ id: 'a-1', participants: [{ id: 'p-1' }], rescueSquad: { members: [] } });
    prisma.squadMessage.create.mockImplementation(async ({ data }) => ({ id: 'm-new', createdAt: new Date(0), author: { firstName: 'Avery', rescueLevel: 'SCOUT' }, ...data }));
  });

  test('a helper cannot write one that reads as the system\'s own', async () => {
    const res = await write({ content: 'Search called off. Go home.', type: 'SYSTEM' });
    expect(res.status).toBe(201);
    expect(prisma.squadMessage.create.mock.calls[0][0].data.type).toBe('CHAT');
  });

  test('an announcement is a leader\'s', async () => {
    expect((await write({ content: 'Meet at 9', type: 'ANNOUNCEMENT' })).status).toBe(403);
    expect(prisma.squadMessage.create).not.toHaveBeenCalled();
  });

  test('text held to a length, pictures that are https, a place that is a place', async () => {
    await write({ content: `  ${'x'.repeat(5000)}  `, photoUrls: ['javascript:alert(1)', 'http://a.example/x.jpg', 'https://cdn.example/a.jpg', ...Array.from({ length: 9 }, (_, i) => `https://cdn.example/${i}.jpg`)], location: { lat: 'north', lng: 1 } });
    const { data } = prisma.squadMessage.create.mock.calls[0][0];
    expect(data.content).toHaveLength(1000);
    expect(JSON.parse(data.photoUrls)).toHaveLength(5);
    expect(JSON.parse(data.photoUrls).every((u) => u.startsWith('https://cdn.example/'))).toBe(true);
    expect(data.location).toBeNull();
    expect(data.authorId).toBe('u-avery');
  });

  test.each([[''], ['   '], [7], [{ $ne: null }]])('%p is not a message: 400', async (content) => {
    expect((await write({ content })).status).toBe(400);
    expect(prisma.squadMessage.create).not.toHaveBeenCalled();
  });

  test('the answer carries a first name and no account id', async () => {
    const body = await (await write({ content: 'Hello' })).json();
    expect(body.message).toMatchObject({ mine: true, author: { firstName: 'Avery' } });
    expect(JSON.stringify(body)).not.toMatch(/authorId|u-avery/);
  });

  test('counted per connection; nobody signed in: 401', async () => {
    withRateLimitAsync.mockResolvedValueOnce({ success: false });
    expect((await write({ content: 'Hello' })).status).toBe(429);
    as(null);
    expect((await write({ content: 'Hello' })).status).toBe(401);
    expect(prisma.squadMessage.create).not.toHaveBeenCalled();
  });
});

describe('marking a search area', () => {
  const mark = (body) => areasPOST(req('search-areas', body), ctx);
  const SHAPE = { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] };
  beforeEach(() => {
    prisma.searchArea.create.mockImplementation(async ({ data }) => ({ id: 'sa-new', markedBy: { firstName: 'Avery' }, ...data }));
    prisma.caseAssignment.findUnique.mockResolvedValue({ rescueSquadId: 'force-1' });
  });

  test('an area a person could have walked is kept, with its note held to a length', async () => {
    const res = await mark({ geometry: SHAPE, acreage: 2.5, notes: 'n'.repeat(5000), startAddress: 'Ramsey Ave' });
    expect(res.status).toBe(201);
    const { data } = prisma.searchArea.create.mock.calls[0][0];
    expect(data.acreage).toBe(2.5);
    expect(data.notes).toHaveLength(600);
    expect(JSON.stringify(await res.json())).not.toMatch(/markedById|u-avery/);
  });

  test.each([[1e9], [-4], [0], ['12'], [NaN], [null]])('an acreage of %p is refused, and no total moves', async (acreage) => {
    expect((await mark({ geometry: SHAPE, acreage })).status).toBe(400);
    expect(prisma.searchArea.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.rescueForce.update).not.toHaveBeenCalled();
  });

  test('a shape that is not a shape, or is enormous, is refused', async () => {
    expect((await mark({ geometry: 'everywhere', acreage: 2 })).status).toBe(400);
    expect((await mark({ geometry: { type: 'Polygon', coordinates: Array.from({ length: 5000 }, () => [1.123456, 2.123456]) }, acreage: 2 })).status).toBe(400);
    expect((await mark('junk')).status).toBe(400);
    expect(prisma.searchArea.create).not.toHaveBeenCalled();
  });

  test('someone not on the search marks nothing', async () => {
    prisma.caseParticipant.findUnique.mockResolvedValue(null);
    expect((await mark({ geometry: SHAPE, acreage: 2 })).status).toBe(403);
    expect(prisma.searchArea.create).not.toHaveBeenCalled();
  });
});

describe('a helper\'s sighting', () => {
  const report = (over = {}) => sightingsPOST(req('sightings', { latitude: 30.3, longitude: -97.7, spottedAt: new Date(Date.now() - 60000).toISOString(), confidenceLevel: 8, address: '<a href="https://evil.example">Click here</a>', ...over }), ctx);
  beforeEach(() => {
    prisma.petSpotting.create.mockImplementation(async ({ data }) => ({ id: 'sp-new', reportedBy: { firstName: 'Avery' }, ...data }));
    prisma.case.update.mockResolvedValue({ caseNumber: 'AUS-1', petName: 'Max <b>', reporterId: 'u-owner', reporter: { email: 'owner@example.com' } });
    prisma.squadMessage.create.mockResolvedValue({});
  });

  test('what a stranger typed reaches the owner\'s email as text, not as a link', async () => {
    expect((await report()).status).toBe(201);
    const { html } = sendEmail.mock.calls[0][0];
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).toContain('&lt;a href=');
    expect(html).toContain('Max &lt;b&gt;');
  });

  test('the address is one line held to a length, the note too, and pictures are https', async () => {
    await report({ address: `Ramsey Ave\n${'x'.repeat(900)}`, notes: 'n'.repeat(5000), photoUrls: ['javascript:alert(1)', 'https://cdn.example/a.jpg'] });
    const { data } = prisma.petSpotting.create.mock.calls[0][0];
    expect(data.address).toHaveLength(200);
    expect(data.address).not.toContain('\n');
    expect(data.notes).toHaveLength(600);
    expect(JSON.parse(data.photoUrls)).toEqual(['https://cdn.example/a.jpg']);
  });

  test.each([[{ latitude: 'north' }], [{ latitude: 300 }], [{ spottedAt: 'yesterday-ish' }], [{ spottedAt: new Date(Date.now() + 86400000).toISOString() }], [{ confidenceLevel: 11 }], [{ confidenceLevel: 7.5 }], [{ confidenceLevel: 'high' }]])('%p is refused', async (over) => {
    expect((await report(over)).status).toBe(400);
    expect(prisma.petSpotting.create).not.toHaveBeenCalled();
  });

  test('a search that is over is not set back to "sighting reported", and its owner is not told', async () => {
    prisma.caseAssignment.findUnique.mockResolvedValue({ missionId: 'case-max', case: { status: 'REUNITED' } });
    expect((await report()).status).toBe(201);
    expect(prisma.case.update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createInAppNotification).not.toHaveBeenCalled();
  });

  test('one assignment takes only so many in an hour, and the owner is emailed about the first few', async () => {
    prisma.petSpotting.count.mockResolvedValue(SIGHTINGS_PER_HOUR);
    expect((await report()).status).toBe(429);
    expect(prisma.petSpotting.create).not.toHaveBeenCalled();
    prisma.petSpotting.count.mockResolvedValue(OWNER_EMAILS_PER_HOUR);
    expect((await report()).status).toBe(201);
    expect(createInAppNotification).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('counted per connection, and the answer carries no account id', async () => {
    const body = await (await report()).json();
    expect(JSON.stringify(body)).not.toMatch(/reportedById|u-avery/);
    withRateLimitAsync.mockResolvedValueOnce({ success: false });
    expect((await report()).status).toBe(429);
  });
});
