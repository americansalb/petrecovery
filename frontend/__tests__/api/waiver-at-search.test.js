/**
 * The safety waiver is asked for at the first search action, not when
 * Mission Control opens (app/lib/waiver.js).
 *
 * Reading a pet's search (GET /api/missions/[id]) no longer needs it, and
 * tells the page whether to ask. Going out to search does: starting a walk,
 * claiming a block or marking it searched, joining the search. The pet's
 * owner never needs it for their own pet. A helper reading the search does
 * not get the owner's email or where the owner was when they reported.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    case: { findFirst: jest.fn(), findUnique: jest.fn() },
    gridCell: { findUnique: jest.fn(), updateMany: jest.fn() },
    searchGrid: { update: jest.fn() },
    searchSession: { updateMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    rescueForceMember: { findFirst: jest.fn(), update: jest.fn() },
    caseAssignment: { findFirst: jest.fn() },
    caseParticipant: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/sse/missionStream', () => ({ __esModule: true, broadcast: jest.fn() }));
jest.mock('@/lib/actions', () => ({ __esModule: true, getPointsService: jest.fn() }));
jest.mock('@/app/lib/volunteer/quickJoin', () => ({ __esModule: true, quickJoinCase: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { maySearch, waiverRefusal, WAIVER_CODE } from '@/app/lib/waiver';
import { GET as getMission } from '@/app/api/missions/[missionId]/route';
import { PATCH as patchCell } from '@/app/api/mission/[missionId]/grid/cell/route';
import { POST as postSearch } from '@/app/api/mission/[missionId]/search/route';
import { POST as joinSearch } from '@/app/api/rescue-forces/[id]/missions/[missionId]/help/route';

const CASE = 'cmuh8qki0000d3zr9v5n1kdjy';
const SIGNED = { waiverAcceptedAt: new Date('2026-01-01'), role: 'USER' };
const UNSIGNED = { waiverAcceptedAt: null, role: 'USER' };

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-mike', email: 'mike@example.com' } });
  prisma.case.findUnique.mockResolvedValue({ reporterId: 'u-avery' });
});

describe('maySearch and waiverRefusal', () => {
  test('signed the waiver, or it is their own pet', async () => {
    prisma.user.findUnique.mockResolvedValue(SIGNED);
    expect(await maySearch('u-mike', CASE)).toBe(true);

    prisma.user.findUnique.mockResolvedValue(UNSIGNED);
    expect(await maySearch('u-mike', CASE)).toBe(false);
    expect(await maySearch('u-avery', CASE)).toBe(true);
  });

  test('a refusal is a 403 with the code the page opens the waiver for', async () => {
    prisma.user.findUnique.mockResolvedValue(UNSIGNED);
    const res = await waiverRefusal('u-mike', CASE);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: WAIVER_CODE });

    prisma.user.findUnique.mockResolvedValue(SIGNED);
    expect(await waiverRefusal('u-mike', CASE)).toBeNull();
  });
});

describe('GET /api/missions/[id]: open without the waiver', () => {
  const mission = {
    id: CASE,
    caseNumber: 'AUS-2026-0001',
    status: 'ACTIVE',
    reporterId: 'u-avery',
    petPhotoUrl: null,
    petName: 'Max',
    ownerName: 'Avery Smith',
    ownerPhone: '5125550100',
    ownerEmail: 'avery@example.com',
    reporterLatitude: 30.25,
    reporterLongitude: -97.75,
    reporterToLastSeenMiles: 0.4,
    reporter: { id: 'u-avery', firstName: 'Avery', lastName: 'Smith', email: 'avery@example.com' },
    assignments: [],
    updates: [],
    sightings: [],
  };
  const read = () => getMission(new Request(`http://localhost/api/missions/${CASE}`), { params: { missionId: CASE } });

  beforeEach(() => {
    prisma.case.findFirst.mockResolvedValue({ ...mission, reporter: { ...mission.reporter } });
  });

  test('a helper who has not signed it reads the search, is told to sign before searching, and gets no owner email or home spot', async () => {
    prisma.user.findUnique.mockResolvedValue(UNSIGNED);
    const res = await read();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewer).toEqual({ isOwner: false, waiverAccepted: false });
    expect(body.petName).toBe('Max');
    expect(body.ownerEmail).toBeUndefined();
    expect(body.reporterLatitude).toBeUndefined();
    expect(body.reporterLongitude).toBeUndefined();
    expect(body.reporterToLastSeenMiles).toBeUndefined();
    expect(body.reporter).toEqual({ id: 'u-avery', firstName: 'Avery', lastName: 'Smith' });
  });

  test('a helper who signed it is not asked again', async () => {
    prisma.user.findUnique.mockResolvedValue(SIGNED);
    expect((await (await read()).json()).viewer).toEqual({ isOwner: false, waiverAccepted: true });
  });

  test('the owner and an admin see the whole report', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-avery' } });
    prisma.user.findUnique.mockResolvedValue(UNSIGNED);
    const owner = await (await read()).json();
    expect(owner.viewer).toEqual({ isOwner: true, waiverAccepted: true });
    expect(owner.ownerEmail).toBe('avery@example.com');
    expect(owner.reporter.email).toBe('avery@example.com');

    getServerSession.mockResolvedValue({ user: { id: 'u-admin' } });
    prisma.user.findUnique.mockResolvedValue({ waiverAcceptedAt: null, role: 'ADMIN' });
    const admin = await (await read()).json();
    expect(admin.ownerEmail).toBe('avery@example.com');
    expect(admin.reporterLatitude).toBe(30.25);
  });
});

describe('going out to search takes it', () => {
  const cell = (action) =>
    patchCell(
      new NextRequest(`http://localhost/api/mission/${CASE}/grid/cell`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cellId: 'cell-1', action }),
      }),
      { params: { missionId: CASE } }
    );

  beforeEach(() => {
    prisma.gridCell.findUnique.mockResolvedValue({
      id: 'cell-1',
      gridId: 'grid-1',
      row: 1,
      col: 2,
      status: 'IN_PROGRESS',
      claimedById: 'u-mike',
      claimedAt: new Date(),
      grid: { caseId: CASE },
    });
    prisma.gridCell.updateMany.mockResolvedValue({ count: 1 });
  });

  test('claiming a block or marking it searched: refused without it, nothing written', async () => {
    prisma.user.findUnique.mockResolvedValue(UNSIGNED);
    for (const action of ['claim', 'searched']) {
      const res = await cell(action);
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe(WAIVER_CODE);
    }
    expect(prisma.gridCell.updateMany).not.toHaveBeenCalled();
  });

  test('giving a block back never needs it', async () => {
    prisma.user.findUnique.mockResolvedValue(UNSIGNED);
    const res = await cell('release');
    expect(res.status).not.toBe(403);
    expect(prisma.gridCell.updateMany).toHaveBeenCalled();
  });

  test('starting a walk: refused without it', async () => {
    prisma.user.findUnique.mockImplementation(async (args) => (args.where.email ? { id: 'u-mike' } : UNSIGNED));
    prisma.searchSession.updateMany.mockResolvedValue({ count: 0 });
    const res = await postSearch(
      new NextRequest(`http://localhost/api/mission/${CASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', latitude: 30.26, longitude: -97.77 }),
      }),
      { params: { missionId: CASE } }
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe(WAIVER_CODE);
    expect(prisma.searchSession.create).not.toHaveBeenCalled();
  });

  test('joining the search: refused without it, for a member of the force', async () => {
    prisma.user.findUnique.mockResolvedValue(UNSIGNED);
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'member-mike' });
    const res = await joinSearch(new Request(`http://localhost/api/rescue-forces/force-austin/missions/${CASE}/help`, { method: 'POST' }), {
      params: { id: 'force-austin', missionId: CASE },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe(WAIVER_CODE);
    expect(prisma.caseParticipant.create).not.toHaveBeenCalled();
  });
});
