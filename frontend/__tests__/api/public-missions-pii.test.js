/**
 * SEC-3 (second pass): the public case surfaces must not be a bulk contact list
 * for distressed pet owners.
 *
 * The original SEC-3 fix closed /api/reports/[id] and locked it with
 * __tests__/api/reports-id-pii.test.js. The 2026-08 launch audit found the same
 * class alive on two sibling routes that nobody re-checked:
 *
 *   GET /api/public/missions/[caseNumber]  - unauthenticated, returned the
 *       owner's full name, phone AND email. Enumerable via the (also public)
 *       list endpoint, so two calls per victim yielded the whole table.
 *   GET /api/database                      - returned reporterName/Phone/Email
 *       on EVERY case to any signed-in caller, with no take/skip at all.
 *
 * Golden rule, unchanged from the original: assert on the raw API payload, not
 * the rendered UI - the cruelest leaks are fields the screen hides but the JSON
 * still ships.
 *
 * What is deliberately still allowed: the single-case route returns the owner's
 * PHONE and FIRST NAME, because the case page turns those into a "call the
 * owner" tel: link and that is the point of the product. The email and the full
 * name are gone, and the route is rate limited so the phone cannot be walked in
 * bulk.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
// The public route is rate limited; let every request through so these tests
// assert on the payload, not on the limiter (the limiter has its own tests).
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: jest.fn(),
  RateLimitPresets: {},
}));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET as getPublicCase } from '@/app/api/public/missions/[caseNumber]/route';
import { GET as getDatabase } from '@/app/api/database/route';

const OWNER_EMAIL = 'owner.private@example.com';
const OWNER_PHONE = '555-0147';

const LOST_CASE = {
  id: 'case-1',
  caseNumber: 'AUS-2026-0001',
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
  petName: 'Max',
  petSpecies: 'DOG',
  petBreed: 'Golden Retriever',
  petColor: 'Golden',
  petSize: 'LARGE',
  petPhotoUrl: null,
  petDescription: 'Friendly',
  lastSeenLatitude: 30.2729,
  lastSeenLongitude: -97.7444,
  lastSeenAddress: 'Zilker Park, Austin, TX 78704',
  lastSeenAt: new Date('2026-08-01T00:00:00Z'),
  searchRadius: 5,
  status: 'ACTIVE',
  priority: 'HIGH',
  reportType: 'LOST',
  resolution: null,
  resolvedAt: null,
  reporterId: 'u1',
  ownerName: 'Avery Admin',
  ownerPhone: OWNER_PHONE,
  viewCount: 3,
  shareCount: 1,
  activeSearchers: 0,
  sightings: [],
  updates: [],
};

function publicCaseRequest() {
  return new NextRequest('http://localhost:3000/api/public/missions/AUS-2026-0001');
}

describe('GET /api/public/missions/[caseNumber] - PII contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.case.findUnique.mockResolvedValue({ ...LOST_CASE });
  });

  it('never returns the owner email to an unauthenticated caller', async () => {
    const res = await getPublicCase(publicCaseRequest(), { params: { caseNumber: 'AUS-2026-0001' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.contact).toBeDefined();
    expect(body.contact.email).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(OWNER_EMAIL);
  });

  it('does not select the owner email from the database at all', async () => {
    await getPublicCase(publicCaseRequest(), { params: { caseNumber: 'AUS-2026-0001' } });

    const select = prisma.case.findUnique.mock.calls[0][0].select;
    // A field that never leaves the query cannot leak through a later edit.
    expect(select.ownerEmail).toBeUndefined();
  });

  it('returns only a first name, not the owner full name', async () => {
    const res = await getPublicCase(publicCaseRequest(), { params: { caseNumber: 'AUS-2026-0001' } });
    const body = await res.json();

    expect(body.contact.name).toBe('Avery');
    expect(JSON.stringify(body)).not.toContain('Avery Admin');
  });

  it('still returns the phone, because the case page dials it', async () => {
    const res = await getPublicCase(publicCaseRequest(), { params: { caseNumber: 'AUS-2026-0001' } });
    const body = await res.json();

    expect(body.contact.phone).toBe(OWNER_PHONE);
    expect(body.contact.available).toBe(true);
  });

  it('reports contact unavailable rather than inventing one when there is no phone', async () => {
    prisma.case.findUnique.mockResolvedValue({ ...LOST_CASE, ownerPhone: null, ownerName: '' });

    const res = await getPublicCase(publicCaseRequest(), { params: { caseNumber: 'AUS-2026-0001' } });
    const body = await res.json();

    expect(body.contact.available).toBe(false);
    expect(body.contact.phone).toBeNull();
    expect(body.contact.name).toBe('The owner');
  });

  it('sends no phone when the stored value is not a number (found reports stored "Not provided")', async () => {
    prisma.case.findUnique.mockResolvedValue({ ...LOST_CASE, reportType: 'FOUND', ownerPhone: 'Not provided' });

    const res = await getPublicCase(publicCaseRequest(), { params: { caseNumber: 'AUS-2026-0001' } });
    const body = await res.json();

    expect(body.contact.phone).toBeNull();
    expect(body.contact.available).toBe(false);
  });

  it('applies the same contract to FOUND reports', async () => {
    prisma.case.findUnique.mockResolvedValue({ ...LOST_CASE, reportType: 'FOUND' });

    const res = await getPublicCase(publicCaseRequest(), { params: { caseNumber: 'AUS-2026-0001' } });
    const body = await res.json();

    expect(body.contact.email).toBeUndefined();
    expect(body.contact.name).toBe('Avery');
  });
});

describe('GET /api/database - bulk contract', () => {
  const ROW = {
    id: 'case-1',
    caseNumber: 'AUS-2026-0001',
    reportType: 'LOST',
    status: 'ACTIVE',
    petName: 'Max',
    petSpecies: 'DOG',
    petBreed: 'Golden Retriever',
    petColor: 'Golden',
    petSize: 'LARGE',
    petDescription: 'Friendly',
    petPhotoUrl: null,
    lastSeenAt: new Date('2026-08-01T00:00:00Z'),
    lastSeenAddress: 'Zilker Park, Austin, TX 78704',
    createdAt: new Date('2026-08-01T00:00:00Z'),
    ownerName: 'Avery Admin',
    ownerPhone: OWNER_PHONE,
    ownerEmail: OWNER_EMAIL,
    reporter: { firstName: 'Avery' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.case.findMany.mockResolvedValue([ROW]);
    prisma.case.count.mockResolvedValue(87012);
    getServerSession.mockResolvedValue({ user: { id: 'u2', email: 'someone@example.com' } });
  });

  const call = (qs = '') => getDatabase(new NextRequest(`http://localhost:3000/api/database${qs}`));

  it('never returns reporter phone or email, even to a signed-in caller', async () => {
    const res = await call();
    const body = await res.json();
    const blob = JSON.stringify(body);

    expect(body.isAuthenticated).toBe(true);
    expect(blob).not.toContain(OWNER_PHONE);
    expect(blob).not.toContain(OWNER_EMAIL);
    expect(blob).not.toContain('reporterPhone');
    expect(blob).not.toContain('reporterEmail');
  });

  it('does not select reporter contact from the database at all', async () => {
    await call();

    const select = prisma.case.findMany.mock.calls[0][0].include.reporter.select;
    expect(select.phone).toBeUndefined();
    expect(select.email).toBeUndefined();
    expect(select.firstName).toBe(true);
  });

  it('paginates in the query rather than loading the whole table', async () => {
    await call();

    const args = prisma.case.findMany.mock.calls[0][0];
    expect(args.take).toBe(50);
    expect(args.skip).toBe(0);
  });

  it('caps an oversized page request', async () => {
    await call('?limit=99999');

    expect(prisma.case.findMany.mock.calls[0][0].take).toBe(100);
  });

  it('honours offset and reports the true total separately from the page size', async () => {
    const res = await call('?limit=10&offset=30');
    const body = await res.json();

    expect(prisma.case.findMany.mock.calls[0][0]).toMatchObject({ take: 10, skip: 30 });
    expect(body.total).toBe(87012);
    expect(body.count).toBe(1);
    expect(body.hasMore).toBe(true);
  });

  it('pushes free-text search into the query instead of filtering fetched rows', async () => {
    await call('?search=Max');

    const where = prisma.case.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([{ petName: { contains: 'Max', mode: 'insensitive' } }])
    );
  });
});

describe('GET /api/public/missions/[caseNumber] - the owner\'s id, and whose words an update is', () => {
  const read = async () => (await getPublicCase(publicCaseRequest(), { params: { caseNumber: 'AUS-2026-0001' } })).json();
  const UPDATES = [
    { id: 'up-3', content: 'Max was found, stop looking.', createdAt: new Date('2026-08-03T00:00:00Z'), isPinned: false, authorId: 'u-stranger' },
    { id: 'up-2', content: 'He comes to a squeaky ball.', createdAt: new Date('2026-08-02T00:00:00Z'), isPinned: false, authorId: 'u1' },
    { id: 'up-1', content: 'Dana started searching', createdAt: new Date('2026-08-01T12:00:00Z'), isPinned: false, authorId: 'u-dana' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue(null);
    prisma.case.findUnique.mockResolvedValue({ ...LOST_CASE, updates: UPDATES });
  });

  it('does not send the owner\'s account id: it says only whether the person asking is the owner', async () => {
    const guest = await read();
    expect(guest.reporterId).toBeUndefined();
    expect(JSON.stringify(guest)).not.toMatch(/"u1"/);
    expect(guest.viewerIsOwner).toBe(false);

    getServerSession.mockResolvedValue({ user: { id: 'u-someone-else' } });
    expect((await read()).viewerIsOwner).toBe(false);

    getServerSession.mockResolvedValue({ user: { id: 'u1' } });
    const owner = await read();
    expect(owner.viewerIsOwner).toBe(true);
    expect(owner.reporterId).toBeUndefined();
  });

  it('a session that cannot be read is nobody signed in, and the page still loads', async () => {
    getServerSession.mockRejectedValue(new Error('bad cookie'));
    const body = await read();
    expect(body.viewerIsOwner).toBe(false);
    expect(body.petName).toBe('Max');
  });

  it('shows as an update only what the owner\'s own account wrote', async () => {
    // The page prints each update with no name, as an update on the pet. A stranger's line would read as the owner's.
    const body = await read();
    expect(body.updates.map((u) => u.id)).toEqual(['up-2']);
    expect(JSON.stringify(body.updates)).not.toMatch(/found, stop looking|Dana|authorId|u-stranger/);
  });

  it('at most ten, the newest first', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `o-${i}`, content: `Update ${i}`, createdAt: new Date(Date.UTC(2026, 7, 30 - i)), isPinned: false, authorId: 'u1' }));
    prisma.case.findUnique.mockResolvedValue({ ...LOST_CASE, updates: many });
    const body = await read();
    expect(body.updates).toHaveLength(10);
    expect(body.updates[0].id).toBe('o-0');
  });
});
