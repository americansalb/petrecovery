/**
 * Adding a need for a pet (step 7): the "Add a need" sheet's choices
 * (app/lib/needOptions.js, GET /api/rescue-forces/[id]/needs/options) and
 * the checks a new need goes through (createNeed in app/lib/forceNeeds.js,
 * POST /api/rescue-forces/[id]/needs).
 *
 * A need's title is public, so it is written from the place's name without
 * a house number, and a phone number or a house number in what someone
 * types is refused in words. A need the pet already has is offered back
 * instead of added twice.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    rescueForceMember: { findFirst: jest.fn() },
    caseAssignment: { findFirst: jest.fn() },
    squadTask: { findMany: jest.fn(), create: jest.fn() },
    caseSighting: { findMany: jest.fn() },
    shelter: { findMany: jest.fn() },
  },
}));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { placeName, petPlaces, needTitle, suggestNeeds } from '@/app/lib/needOptions';
import { createNeed, NeedError } from '@/app/lib/forceNeeds';
import { POST as addNeed } from '@/app/api/rescue-forces/[id]/needs/route';
import { GET as getOptions } from '@/app/api/rescue-forces/[id]/needs/options/route';

const FORCE = 'force-austin';
const HOUR = 3600e3;
const MAX = {
  id: 'case-max',
  status: 'ACTIVE',
  reportType: 'LOST',
  petName: 'Max',
  petSpecies: 'DOG',
  reporterId: 'u-avery',
  lastSeenAddress: '2100 Barton Springs Rd, Austin, TX 78704',
  lastSeenLatitude: 30.265,
  lastSeenLongitude: -97.77,
};
const SIGHTINGS = [
  { id: 's1', sightedAt: new Date(Date.now() - 4 * HOUR), latitude: 30.264, longitude: -97.771, address: 'Barton Springs Pool, Austin, TX' },
  { id: 's2', sightedAt: new Date(Date.now() - 10 * HOUR), latitude: 30.26, longitude: -97.78, address: 'Barton Springs Pool, Austin, TX' },
];
const SHELTERS = [
  { id: 'aac', name: 'Austin Animal Center', latitude: 30.25, longitude: -97.69 },
  { id: 'far', name: 'Far Away Shelter', latitude: 31.5, longitude: -97.7 },
];

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
  prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'member-mike' });
  prisma.caseAssignment.findFirst.mockResolvedValue({ case: MAX });
  prisma.squadTask.findMany.mockResolvedValue([]);
  prisma.caseSighting.findMany.mockResolvedValue(SIGHTINGS);
  prisma.shelter.findMany.mockResolvedValue(SHELTERS);
  prisma.squadTask.create.mockImplementation(async ({ data }) => ({ id: 'need-new', title: data.title }));
});

describe('the choices', () => {
  test('a place is named without its house number', () => {
    expect(placeName('2100 Barton Springs Rd, Austin, TX 78704')).toBe('Barton Springs Rd');
    expect(placeName('Near Zilker Park, Austin')).toBe('Zilker Park');
    expect(placeName('30.26, -97.77')).toBe('');
  });

  test('where it was last seen, then its sightings, each place once', () => {
    const places = petPlaces(MAX, SIGHTINGS);
    expect(places.map((p) => [p.id, p.label])).toEqual([
      ['lastseen', 'Barton Springs Rd'],
      ['sighting:s1', 'Barton Springs Pool'],
    ]);
    expect(places[0].why).toBe('Where Max was last seen');
    expect(places[1].why).toMatch(/^Seen here 4 hours ago/);
  });

  test('ready-made needs: search the latest sighting, check the nearest shelter, doors and flyers where it went missing', () => {
    const places = petPlaces(MAX, SIGHTINGS);
    const shelters = [{ id: 'aac', name: 'Austin Animal Center' }];
    const list = suggestNeeds(MAX, places, shelters, [{ title: 'Put up flyers near Barton Springs Rd', shelterId: null }]);
    expect(list.map((s) => [s.title, s.when, s.people, s.added])).toEqual([
      ['Search near Barton Springs Pool', 'today', 4, false],
      ['Check Austin Animal Center', 'today', 1, false],
      ['Knock on doors near Barton Springs Rd', 'tonight', 2, false],
      ['Put up flyers near Barton Springs Rd', 'today', 3, true],
    ]);
    expect(needTitle('area', {})).toBe('');
  });
});

describe('createNeed', () => {
  const create = (body) => createNeed({ forceId: FORCE, userId: 'u-mike', body: { caseId: 'case-max', when: 'today', people: 2, ...body } });

  test('a ready-made need: its title from the place, the time and note in its details', async () => {
    expect(await create({ kind: 'area', placeId: 'sighting:s1', people: 4, note: 'Bring treats.' })).toEqual({ id: 'need-new', title: 'Search near Barton Springs Pool' });
    expect(prisma.squadTask.create.mock.calls[0][0].data).toMatchObject({
      rescueSquadId: FORCE,
      caseId: 'case-max',
      title: 'Search near Barton Springs Pool',
      description: 'Today. Bring treats.',
      taskType: 'search_area',
      status: 'AVAILABLE',
      role: 'SQUAD',
      peopleNeeded: 4,
      ownerRequested: false,
      address: 'Barton Springs Pool',
      latitude: 30.264,
      createdById: 'u-mike',
    });
  });

  test("a shelter from the list near the pet; the owner's own need is marked as the owner's", async () => {
    await createNeed({ forceId: FORCE, userId: 'u-avery', body: { caseId: 'case-max', kind: 'shelter', shelterId: 'aac', when: 'tomorrow', people: 1 } });
    expect(prisma.squadTask.create.mock.calls[0][0].data).toMatchObject({
      title: 'Check Austin Animal Center',
      shelterId: 'aac',
      description: 'Tomorrow.',
      ownerRequested: true,
      priority: 'HIGH',
    });
    // A shelter far from the pet is not on the list.
    await expect(create({ kind: 'shelter', shelterId: 'far', people: 1 })).rejects.toThrow(/shelter from the list/);
  });

  test('refused in words: no kind, too many people, nothing to do, a phone number, a house number, a long note', async () => {
    await expect(create({ kind: 'party' })).rejects.toThrow(/kind of need/);
    await expect(create({ kind: 'area', placeId: 'lastseen', people: 21 })).rejects.toThrow(/1 to 20/);
    await expect(create({ kind: 'other', title: '  ' })).rejects.toThrow(/Say what needs doing/);
    await expect(create({ kind: 'other', title: 'Call me at 512-555-0100' })).rejects.toThrow(/phone numbers/);
    await expect(create({ kind: 'other', title: 'Check the yard at 412 Oak Street' })).rejects.toThrow(/house numbers/);
    await expect(create({ kind: 'area', placeId: 'lastseen', note: 'x'.repeat(141) })).rejects.toThrow(/under 140/);
    await expect(create({ kind: 'area', placeId: 'somewhere-else' })).rejects.toThrow(/places on the list/);
    await expect(create({ kind: 'area', placeId: 'lastseen', note: 'Gate code is at 12 Elm St' })).rejects.toThrow(/house numbers/);
    expect(prisma.squadTask.create).not.toHaveBeenCalled();
  });

  test('a place whose name has a number in it is not taken for a house number', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([
      { id: 's9', sightedAt: new Date(), latitude: 30.27, longitude: -97.74, address: 'I-35 Frontage Rd, Austin, TX' },
    ]);
    expect((await create({ kind: 'flyers', placeId: 'sighting:s9' })).title).toBe('Put up flyers near I-35 Frontage Rd');
  });

  test('only a member, only for a pet of this force still missing', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValueOnce(null);
    await expect(create({ kind: 'area', placeId: 'lastseen' })).rejects.toMatchObject({ status: 403 });
    prisma.caseAssignment.findFirst.mockResolvedValueOnce(null);
    await expect(create({ kind: 'area', placeId: 'lastseen' })).rejects.toMatchObject({ status: 400 });
    prisma.caseAssignment.findFirst.mockResolvedValueOnce({ case: { ...MAX, status: 'REUNITED' } });
    await expect(create({ kind: 'area', placeId: 'lastseen' })).rejects.toMatchObject({ status: 409 });
  });

  test('a need the pet already has comes back as that need, unless added anyway', async () => {
    prisma.squadTask.findMany.mockResolvedValue([
      {
        id: 'need-trail',
        title: 'Search near Barton Springs Pool',
        shelterId: null,
        peopleNeeded: 4,
        participants: [{ status: 'ACTIVE' }, { status: 'LEFT' }],
      },
    ]);
    const error = await create({ kind: 'area', placeId: 'sighting:s1' }).catch((e) => e);
    expect(error).toBeInstanceOf(NeedError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('Max already has this need: Search near Barton Springs Pool.');
    expect(error.duplicate).toEqual({ id: 'need-trail', title: 'Search near Barton Springs Pool', taken: 1, peopleNeeded: 4 });

    await create({ kind: 'area', placeId: 'sighting:s1', anyway: true });
    expect(prisma.squadTask.create).toHaveBeenCalledTimes(1);
  });
});

describe('the routes', () => {
  const post = (body) =>
    addNeed(new Request(`http://localhost/api/rescue-forces/${FORCE}/needs`, { method: 'POST', body: JSON.stringify(body) }), {
      params: Promise.resolve({ id: FORCE }),
    });
  const options = (qs) =>
    getOptions(new Request(`http://localhost/api/rescue-forces/${FORCE}/needs/options?${qs}`), { params: Promise.resolve({ id: FORCE }) });

  test('POST: 201 with the need, 409 with the duplicate, 401 signed out', async () => {
    const res = await post({ caseId: 'case-max', kind: 'doors', placeId: 'lastseen', when: 'tonight', people: 2 });
    expect(res.status).toBe(201);
    expect((await res.json()).need.title).toBe('Knock on doors near Barton Springs Rd');

    prisma.squadTask.findMany.mockResolvedValue([
      { id: 'need-doors', title: 'Knock on doors near Barton Springs Rd', shelterId: null, peopleNeeded: 2, participants: [] },
    ]);
    const dup = await post({ caseId: 'case-max', kind: 'doors', placeId: 'lastseen', when: 'tonight', people: 2 });
    expect(dup.status).toBe(409);
    expect((await dup.json()).duplicate.id).toBe('need-doors');

    getServerSession.mockResolvedValueOnce(null);
    expect((await post({})).status).toBe(401);
  });

  test('options: the places, shelters and suggestions for a member; not for anyone else', async () => {
    const res = await options('caseId=case-max');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.places.map((p) => p.label)).toEqual(['Barton Springs Rd', 'Barton Springs Pool']);
    expect(body.shelters.map((s) => s.name)).toEqual(['Austin Animal Center']);
    expect(body.suggestions).toHaveLength(4);
    expect(body.whens).toMatchObject({ today: 'Today', weekend: 'This weekend' });

    prisma.rescueForceMember.findFirst.mockResolvedValueOnce(null);
    expect((await options('caseId=case-max')).status).toBe(403);
    prisma.caseAssignment.findFirst.mockResolvedValueOnce(null);
    expect((await options('caseId=someone-else')).status).toBe(404);
  });
});
