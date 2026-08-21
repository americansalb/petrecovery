/**
 * Account deletion.
 *
 * The Danger Zone button in /settings asked "Are you sure? This cannot be
 * undone", waited for the person to say yes, and then told them account
 * deletion was not implemented and to contact support. A dead control on
 * the one thing a privacy law actually guarantees.
 *
 * Implementing it is not prisma.user.delete(). Case.reporter and
 * CaseSighting.reportedBy are both onDelete: Cascade, so deleting the row
 * would take with it every case that person reported - including a search
 * volunteers might be out running right now - and every sighting they had
 * reported on other people's cases. Someone exercising their own right to
 * erasure must not silently erase the thing other people are looking for.
 *
 * These tests pin the three rules that make that safe.
 */

const { NextResponse } = require('next/server');

const mockPrisma = {
  user: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
  case: { findMany: jest.fn(), update: jest.fn() },
  caseSighting: { updateMany: jest.fn() },
  caseUpdate: { updateMany: jest.fn() },
  squadPost: { updateMany: jest.fn() },
  squadPostComment: { updateMany: jest.fn() },
  missionVolunteer: { updateMany: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/rateLimit', () => ({
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  RateLimitPresets: { AUTH: {} },
  rateLimitResponse: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const { getServerSession } = require('next-auth');
const { POST } = require('@/app/api/account/delete/route');

const PASSWORD = 'correct-horse-battery-staple';
let passwordHash;

function request(body) {
  return { json: async () => body, headers: new Map() };
}

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
});

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'user_1' } });
  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === 'user_1') {
      return Promise.resolve({ id: 'user_1', email: 'me@example.com', passwordHash });
    }
    // tombstone lookup
    return Promise.resolve({ id: 'tombstone_1' });
  });
  mockPrisma.case.findMany.mockResolvedValue([]);
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
  for (const model of ['caseSighting', 'caseUpdate', 'squadPost', 'squadPostComment', 'missionVolunteer']) {
    mockPrisma[model].updateMany.mockResolvedValue({ count: 0 });
  }
  mockPrisma.user.delete.mockResolvedValue({});
});

describe('POST /api/account/delete', () => {
  it('refuses when nobody is signed in', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await POST(request({ password: PASSWORD }));
    expect(res.status).toBe(401);
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it('refuses on the wrong password', async () => {
    // A logged-in tab left open on a shared machine should not be one
    // click away from destroying the account.
    const res = await POST(request({ password: 'not-it' }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('BAD_PASSWORD');
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it('refuses while a report of theirs is still being searched for', async () => {
    mockPrisma.case.findMany.mockResolvedValue([
      { caseNumber: 'AUS-2026-0002', petName: 'Whiskers', status: 'ACTIVE' },
    ]);

    const res = await POST(request({ password: PASSWORD }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('OPEN_CASES');
    // Naming the pet is the point: "you have an open report" sends someone
    // hunting through their account for which one.
    expect(body.error).toContain('Whiskers');
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it('allows deletion once their own cases are all closed', async () => {
    mockPrisma.case.findMany.mockResolvedValue([
      { caseNumber: 'AUS-2026-0001', petName: 'Max', status: 'REUNITED' },
      { caseNumber: 'AUS-2025-0099', petName: 'Old', status: 'CLOSED_OTHER' },
    ]);

    const res = await POST(request({ password: PASSWORD }));

    expect(res.status).toBe(200);
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user_1' } });
  });

  it('moves contributions others rely on to the tombstone before deleting', async () => {
    await POST(request({ password: PASSWORD }));

    // Sightings on other people's cases: the owner of that case still
    // needs to see where their animal was seen.
    expect(mockPrisma.caseSighting.updateMany).toHaveBeenCalledWith({
      where: { reportedById: 'user_1' },
      data: { reportedById: 'tombstone_1' },
    });
    expect(mockPrisma.caseUpdate.updateMany).toHaveBeenCalledWith({
      where: { authorId: 'user_1' },
      data: { authorId: 'tombstone_1' },
    });
    // Volunteer history keeps the record of the search, drops the name.
    expect(mockPrisma.missionVolunteer.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      data: { userId: null, isAnonymous: true, displayName: 'Deleted account' },
    });
  });

  it('does all of it in one transaction', async () => {
    // A half-deleted account - contributions moved, user row still there,
    // or worse the reverse - is the failure mode that matters here.
    await POST(request({ password: PASSWORD }));
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
