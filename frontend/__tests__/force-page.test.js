/**
 * A Rescue Force's page (app/rescue-forces/[id]/(tabs)/): the data behind
 * its header, map and Pets tab (app/lib/forcePage.js), and what the Needs
 * and Discussion tabs show to someone who is not a member.
 *
 * The page is public. Members appear by first name, a pet's place never
 * starts with a house number, a need's notes are for members (like the
 * tasks API they come from), and the discussion is members-only because
 * posts can hold addresses.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    rescueForce: { findFirst: jest.fn(), findMany: jest.fn() },
    rescueForceMember: { findMany: jest.fn() },
    caseAssignment: { findMany: jest.fn() },
    case: { findMany: jest.fn() },
    squadTask: { groupBy: jest.fn(), findMany: jest.fn() },
    squadActivity: { findMany: jest.fn() },
  },
}));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('@/app/lib/authz', () => ({ __esModule: true, getUserRole: jest.fn() }));
jest.mock('@/app/lib/forceViewer', () => ({ __esModule: true, getForceViewer: jest.fn() }));
jest.mock('next/navigation', () => ({ __esModule: true, notFound: jest.fn(() => { throw new Error('notFound'); }) }));
// The tabs' client views are not under test here, only what the server hands them.
jest.mock('@/app/rescue-forces/[id]/(tabs)/needs/NeedsTab', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/rescue-forces/[id]/(tabs)/discussion/UpdatesClient', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/rescue-forces/[id]/(tabs)/discussion/LockedDiscussion', () => ({ __esModule: true, default: () => null }));

import fs from 'fs';
import path from 'path';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { getUserRole } from '@/app/lib/authz';
import { getForceViewer } from '@/app/lib/forceViewer';
import { getForcePage, nearText, whenText } from '@/app/lib/forcePage';
import { clearForceAreaCache } from '@/app/lib/forceDirectory';
import ForceNeedsPage from '@/app/rescue-forces/[id]/(tabs)/needs/page';
import ForceDiscussionPage from '@/app/rescue-forces/[id]/(tabs)/discussion/page';
import LockedDiscussion from '@/app/rescue-forces/[id]/(tabs)/discussion/LockedDiscussion';
import UpdatesClient from '@/app/rescue-forces/[id]/(tabs)/discussion/UpdatesClient';

const HOUR = 3600e3;
const FORCE = {
  id: 'force-austin',
  name: 'Austin Rescue Force',
  city: 'Austin',
  state: 'TX',
  slogan: null,
  description: null,
  photoUrl: null,
  logoUrl: null,
  centerLatitude: 30.27,
  centerLongitude: -97.74,
  radiusMiles: 15,
  isActive: true,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
};
const kase = (over) => ({
  id: 'case-max',
  caseNumber: 'AUS-2026-0001',
  status: 'IN_PROGRESS',
  reportType: 'LOST',
  resolution: null,
  petName: 'Max',
  petSpecies: 'DOG',
  petPhotoUrl: 'https://cdn.example/max.jpg',
  lastSeenAddress: '6701 Burnet Rd, Austin, TX 78757',
  lastSeenAt: new Date(Date.now() - 18 * HOUR),
  lastSeenLatitude: 30.27,
  lastSeenLongitude: -97.74,
  createdAt: new Date(Date.now() - 18 * HOUR),
  resolvedAt: null,
  ...over,
});

function answer({ userId = null, platformRole = 'USER' } = {}) {
  getServerSession.mockResolvedValue(userId ? { user: { id: userId } } : null);
  getUserRole.mockResolvedValue(platformRole);
  prisma.rescueForce.findFirst.mockResolvedValue(FORCE);
  prisma.rescueForce.findMany.mockResolvedValue([]); // no stored outline
  prisma.rescueForceMember.findMany.mockResolvedValue([
    { id: 'm1', role: 'MEMBER', user: { id: 'u-mike', firstName: 'Mike', profileImage: null } },
    { id: 'm2', role: 'FOUNDER', user: { id: 'u-avery', firstName: 'Avery', profileImage: null } },
  ]);
  prisma.caseAssignment.findMany.mockImplementation(async (args) =>
    args.where.case.status === 'REUNITED'
      ? [{ case: kase({ id: 'case-biscuit', caseNumber: 'AUS-2025-0099', status: 'REUNITED', petName: 'Biscuit', resolvedAt: new Date(Date.now() - 48 * HOUR) }) }]
      : [
          { case: kase({ id: 'case-old', caseNumber: 'AUS-2026-0002', petName: 'Luna', lastSeenAt: new Date(Date.now() - 72 * HOUR), lastSeenAddress: 'Hyde Park, Austin, TX' }) },
          { case: kase({}) },
          { case: kase({ id: 'case-found', caseNumber: 'AUS-2026-0003', reportType: 'FOUND', petName: 'Unknown', lastSeenAddress: '30.26, -97.77' }) },
        ]
  );
  prisma.squadTask.groupBy.mockResolvedValue([
    { caseId: 'case-max', _count: { _all: 2 } },
    { caseId: null, _count: { _all: 1 } },
    { caseId: 'case-closed', _count: { _all: 4 } }, // a pet no longer being looked for
  ]);
}

beforeEach(() => {
  jest.clearAllMocks();
  clearForceAreaCache();
});

describe('getForcePage', () => {
  test('pets: newest lost and found first, then reunited, with plain words', async () => {
    answer();
    const { pets, needsCount } = await getForcePage('force-austin');
    expect(pets.map((p) => [p.name, p.status])).toEqual([
      ['Max', 'lost'],
      ['Found dog', 'found'],
      ['Luna', 'lost'],
      ['Biscuit', 'home'],
    ]);
    expect(pets[0]).toMatchObject({ when: 'Lost 18 hours ago', near: 'Near Burnet Rd', needs: 2, photo: 'https://cdn.example/max.jpg' });
    expect(pets[1].near).toBe(''); // coordinates, not a place
    expect(pets[3].when).toBe('Reunited 2 days ago');
    // The force's own need and Max's two; not the four of a pet no longer missing.
    expect(needsCount).toBe(3);
  });

  test('members by first name, leaders first, without account ids', async () => {
    answer();
    const { members } = await getForcePage('force-austin');
    expect(members).toEqual([
      { id: 'm2', name: 'Avery', image: null, role: 'FOUNDER' },
      { id: 'm1', name: 'Mike', image: null, role: 'MEMBER' },
    ]);
    expect(JSON.stringify(members)).not.toMatch(/u-avery|u-mike/);
  });

  test('who is looking', async () => {
    answer();
    expect((await getForcePage('force-austin')).viewer).toMatchObject({ signedIn: false, isMember: false });

    answer({ userId: 'u-mike' });
    expect((await getForcePage('force-austin')).viewer).toMatchObject({ signedIn: true, isMember: true, isLeader: false });

    answer({ userId: 'u-avery' });
    expect((await getForcePage('force-austin')).viewer).toMatchObject({ isMember: true, isLeader: true, role: 'FOUNDER' });

    answer({ userId: 'u-someone', platformRole: 'ADMIN' });
    expect((await getForcePage('force-austin')).viewer).toMatchObject({ isMember: false, isAdmin: true });
  });

  test('a missing or deleted force', async () => {
    answer();
    prisma.rescueForce.findFirst.mockResolvedValue(null);
    expect(await getForcePage('nope')).toBeNull();
  });
});

describe('place and time words', () => {
  test('a street without its house number, or the town', () => {
    expect(nearText('6701 Burnet Rd, Austin, TX 78757')).toBe('Near Burnet Rd');
    expect(nearText('near Zilker Park, Austin')).toBe('Near Zilker Park');
    expect(nearText('13107, Southeast 169th Avenue, Happy Valley, Oregon, 97086, United States')).toBe('Near Happy Valley, OR');
    expect(nearText('30.26, -97.77')).toBe('');
    expect(nearText('')).toBe('');
  });

  test('lost, found and reunited', () => {
    const now = Date.now();
    expect(whenText({ lastSeenAt: new Date(now - 3 * HOUR) }, 'found')).toBe('Found 3 hours ago');
    expect(whenText({ resolvedAt: null }, 'home')).toBe('Reunited');
  });
});

describe('the tabs for someone who is not a member', () => {
  const params = Promise.resolve({ id: 'force-austin' });

  function needRows() {
    const at = new Date(Date.now() - 2 * HOUR);
    return [
      { id: 'n1', title: 'Search the greenbelt', description: 'Meet at 4412 Oak St', caseId: 'case-max', peopleNeeded: 3, ownerRequested: true, ownerRequestedHelp: false, createdAt: at, participants: [{ userId: 'u-mike', status: 'ACTIVE' }, { userId: 'u-x', status: 'LEFT' }] },
      { id: 'n2', title: 'Put up flyers on Lamar', description: null, caseId: null, peopleNeeded: 1, ownerRequested: false, ownerRequestedHelp: false, createdAt: at, participants: [] },
      { id: 'n3', title: 'Check the shelter', description: null, caseId: 'case-closed', peopleNeeded: 1, ownerRequested: false, ownerRequestedHelp: false, createdAt: at, participants: [] },
    ];
  }

  function answerNeeds() {
    prisma.squadTask.findMany.mockResolvedValue(needRows());
    prisma.case.findMany.mockResolvedValue([
      kase({}),
      kase({ id: 'case-closed', caseNumber: 'AUS-2026-0009', status: 'REUNITED' }),
    ]);
    prisma.squadActivity.findMany.mockResolvedValue([
      { id: 'a1', details: 'Call the animal center', actorId: 'u-mike', createdAt: new Date(), actor: { firstName: 'Mike' } },
    ]);
  }

  test('Needs: everyone sees what is needed; only members see the notes and their own place', async () => {
    answer();
    answerNeeds();
    const page = await ForceNeedsPage({ params });
    const visitor = page.props.needs;
    expect(visitor.map((n) => n.id)).toEqual(['n1', 'n2']); // not the reunited pet's
    expect(visitor[0]).toMatchObject({
      title: 'Search the greenbelt',
      details: null,
      mine: null,
      peopleNeeded: 3,
      onIt: 1,
      taken: 1,
      byOwner: true,
      asked: 'Asked 2 hours ago',
    });
    expect(visitor[0].pet).toMatchObject({ name: 'Max', caseNumber: 'AUS-2026-0001', status: 'lost' });
    expect(visitor[1].pet).toBeNull();
    expect(page.props.recent).toEqual([expect.objectContaining({ text: 'Mike finished: Call the animal center' })]);

    clearForceAreaCache();
    answer({ userId: 'u-mike' });
    answerNeeds();
    const member = await ForceNeedsPage({ params: Promise.resolve({ id: 'force-austin' }) });
    expect(member.props.needs[0]).toMatchObject({ details: 'Meet at 4412 Oak St', mine: 'on' });
    expect(member.props.recent[0].text).toBe('You finished: Call the animal center');

    // Owner-only tasks are not the force's needs.
    expect(prisma.squadTask.findMany.mock.calls[0][0].where).toMatchObject({ role: { not: 'OWNER' } });
  });

  test('Discussion: members and admins read it; anyone else gets the way in', async () => {
    getForceViewer.mockResolvedValue({ force: FORCE, userId: 'u-x', membership: null, isAdmin: false });
    expect((await ForceDiscussionPage({ params })).type).toBe(LockedDiscussion);

    getForceViewer.mockResolvedValue({ force: FORCE, userId: 'u-mike', membership: { role: 'MEMBER' }, isAdmin: false });
    const page = await ForceDiscussionPage({ params: Promise.resolve({ id: 'force-austin' }) });
    expect(page.props.children.type).toBe(UpdatesClient);
    expect(page.props.children.props).toMatchObject({ canPost: true, canAnnounce: false });
  });
});

test('the tabs sit under the navbar, never in its place', () => {
  const shell = fs.readFileSync(path.join(__dirname, '..', 'app/rescue-forces/[id]/(tabs)/ForceShell.js'), 'utf8');
  expect(shell).toMatch(/sticky top-16/);
  expect(shell).not.toMatch(/sticky top-0|fixed top-0/);
  for (const tab of ['/needs', '/discussion']) expect(shell).toContain(tab);
});
