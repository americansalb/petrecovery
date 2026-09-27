/**
 * Which Rescue Forces a reported pet goes to, and who hears about it
 * (app/lib/forceCoverage.js). Lost and found reports follow the same rule:
 * inside a force's town outline or within a mile of it, or its circle plus
 * a mile while the outline is not looked up yet. Found reports used to
 * reach no force at all.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    rescueForce: { findMany: jest.fn() },
    rescueForceMember: { findMany: jest.fn() },
    notification: { createMany: jest.fn() },
    caseAssignment: { create: jest.fn() },
    squadPost: { create: jest.fn() },
    case: { findMany: jest.fn() },
  },
}));

import prisma from '@/app/lib/prisma';
import { forcesCovering, alertForceMembers, routeFoundReport, routeFoundReports } from '@/app/lib/forceCoverage';
import { clearForceAreaCache } from '@/app/lib/forceAreas';

const STAMP = new Date('2026-09-01T00:00:00Z');
/** A square town outline `half` degrees each way, stored as GeoJSON. */
function outline(lat, lng, half) {
  return JSON.stringify({
    type: 'Polygon',
    coordinates: [[[lng - half, lat - half], [lng + half, lat - half], [lng + half, lat + half], [lng - half, lat + half], [lng - half, lat - half]]],
  });
}

// Clinton has its outline (a town about 5.5 miles across); Camanche, five
// miles south, is still a circle.
const CLINTON = { id: 'f-clinton', name: 'Clinton Pet Rescue', city: 'Clinton', centerLatitude: 41.844, centerLongitude: -90.188, radiusMiles: 5, isAcceptingCases: true, updatedAt: STAMP };
const CAMANCHE = { id: 'f-camanche', name: 'Camanche Pet Rescue', city: 'Camanche', centerLatitude: 41.79, centerLongitude: -90.26, radiusMiles: 3, isAcceptingCases: true, updatedAt: STAMP };
const OUTLINES = { 'f-clinton': outline(41.844, -90.188, 0.04) };

beforeEach(() => {
  jest.clearAllMocks();
  clearForceAreaCache();
  prisma.rescueForce.findMany.mockImplementation(async (args) =>
    args.select?.customBoundary
      ? args.where.id.in.filter((id) => OUTLINES[id]).map((id) => ({ id, customBoundary: OUTLINES[id] }))
      : [CLINTON, CAMANCHE]
  );
  prisma.notification.createMany.mockResolvedValue({ count: 0 });
  prisma.caseAssignment.create.mockResolvedValue({});
  prisma.squadPost.create.mockResolvedValue({});
});

test('covering: inside the town line or a mile past it; the circle plus a mile for a force without an outline', async () => {
  const at = async (lat, lng) => {
    const forces = await forcesCovering({ lat, lng });
    return forces.filter((f) => f.covers).map((f) => f.id);
  };
  expect(await at(41.844, -90.188)).toEqual(['f-clinton']); // downtown Clinton
  // Half a mile north of the Clinton line: still Clinton's.
  expect(await at(41.844 + 0.04 + 0.5 / 69, -90.188)).toEqual(['f-clinton']);
  // Two miles north of the line: inside Clinton's old 5-mile circle, but not its town any more.
  expect(await at(41.844 + 0.04 + 2 / 69, -90.188)).toEqual([]);
  // Camanche's circle (3 miles) plus a mile.
  expect(await at(41.79 - 3.5 / 69, -90.26)).toEqual(['f-camanche']);

  const all = await forcesCovering({ lat: 41.844, lng: -90.188 });
  expect(all.find((f) => f.id === 'f-camanche').distance).toBeGreaterThan(4);
  // Active forces with a center only, never deleted ones.
  expect(prisma.rescueForce.findMany.mock.calls[0][0].where).toMatchObject({ isActive: true, isDeleted: false });
});

describe('alertForceMembers', () => {
  const LOST = { id: 'case-max', caseNumber: 'CLI-2026-0001', reportType: 'LOST', petName: 'Max', petSpecies: 'DOG', lastSeenAddress: '412 Main Ave, Clinton, IA' };

  test('each member hears once, never the person who reported it, with no house number', async () => {
    prisma.rescueForceMember.findMany.mockResolvedValue([
      { userId: 'u-ann', rescueSquadId: 'f-clinton' },
      { userId: 'u-bo', rescueSquadId: 'f-clinton' },
      { userId: 'u-ann', rescueSquadId: 'f-camanche' },
      { userId: 'u-owner', rescueSquadId: 'f-clinton' },
    ]);
    expect(await alertForceMembers({ forces: [CLINTON, CAMANCHE], pet: LOST, exceptUserId: 'u-owner' })).toBe(2);
    const rows = prisma.notification.createMany.mock.calls[0][0].data;
    expect(rows.map((r) => r.userId)).toEqual(['u-ann', 'u-bo']);
    expect(rows[0]).toMatchObject({
      type: 'FORCE_PET_LOST',
      title: 'Max is missing near Main Ave',
      message: 'Clinton Pet Rescue is looking for Max. See how you can help.',
      actionUrl: '/cases/CLI-2026-0001',
    });
    expect(prisma.rescueForceMember.findMany.mock.calls[0][0].where).toMatchObject({ isActive: true });
  });

  test('a found pet asks whether it is one of theirs; no forces, no alerts', async () => {
    prisma.rescueForceMember.findMany.mockResolvedValue([{ userId: 'u-ann', rescueSquadId: 'f-clinton' }]);
    await alertForceMembers({ forces: [CLINTON], pet: { ...LOST, reportType: 'FOUND', petName: 'Black dog', lastSeenAddress: 'Riverview Park, Clinton, IA' } });
    expect(prisma.notification.createMany.mock.calls[0][0].data[0]).toMatchObject({
      type: 'FORCE_PET_FOUND',
      title: 'A dog was found near Riverview Park',
      message: 'Is it one of the pets Clinton Pet Rescue is looking for? See the report.',
    });

    expect(await alertForceMembers({ forces: [], pet: LOST })).toBe(0);
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
  });
});

describe('found pets reach the forces around them', () => {
  const FOUND = {
    id: 'case-found',
    caseNumber: 'CLI-2026-0002',
    reporterId: 'u-finder',
    petSpecies: 'CAT',
    lastSeenAddress: 'Riverview Park, Clinton, IA',
    lastSeenLatitude: 41.846,
    lastSeenLongitude: -90.19,
  };

  test('each covering force that takes reports gets it, with a post about the pet', async () => {
    const routed = await routeFoundReport(FOUND, { reporterId: 'u-finder' });
    expect(routed.map((f) => f.id)).toEqual(['f-clinton']);
    expect(prisma.caseAssignment.create).toHaveBeenCalledWith({
      data: { missionId: 'case-found', rescueSquadId: 'f-clinton', status: 'ACCEPTED', acceptedById: 'u-finder' },
    });
    expect(prisma.squadPost.create.mock.calls[0][0].data).toMatchObject({
      rescueSquadId: 'f-clinton',
      caseId: 'case-found',
      title: 'A cat was found near Riverview Park',
      content: 'Someone found a cat near Riverview Park and reported it. Is it one of the pets this force is looking for? See the report: Case #CLI-2026-0002.',
    });
  });

  test('a force that paused new reports, or already has it, is left alone', async () => {
    prisma.rescueForce.findMany.mockImplementation(async (args) =>
      args.select?.customBoundary ? [] : [{ ...CLINTON, isAcceptingCases: false }]
    );
    expect(await routeFoundReport(FOUND)).toEqual([]);

    prisma.rescueForce.findMany.mockImplementation(async (args) => (args.select?.customBoundary ? [] : [CLINTON]));
    prisma.caseAssignment.create.mockRejectedValueOnce(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));
    expect(await routeFoundReport(FOUND)).toEqual([]);
    expect(prisma.squadPost.create).not.toHaveBeenCalled();
  });

  test('recent found pets that reached no force are routed later, quietly', async () => {
    prisma.case.findMany.mockResolvedValue([FOUND]);
    expect(await routeFoundReports({ now: new Date('2026-09-27T12:00:00Z') })).toEqual({ checked: 1, routed: 1 });
    const { where } = prisma.case.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ reportType: 'FOUND', assignments: { none: {} } });
    expect(where.createdAt.gte).toEqual(new Date('2026-08-28T12:00:00Z'));
    // Old news: no post, no alert.
    expect(prisma.squadPost.create).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});
