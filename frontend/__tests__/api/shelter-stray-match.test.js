/**
 * The shelter-confirms-first invariant, end to end:
 *  - logging a STRAY schedules the matcher without blocking the create
 *  - while a match is PENDING, the case owner is never contacted (the
 *    matcher notifies only the shelter's claimer)
 *  - confirm notifies the owner through in-app + email + push + Alert
 *  - dismiss notifies nobody
 *  - other shelters' matches read as 404
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  renderBrandedEmail: jest.fn(() => '<html>mail</html>'),
}));
jest.mock('@/app/lib/config', () => ({ getEmailBaseUrl: () => 'https://reunitepets.org' }));
jest.mock('@/app/lib/notifications-inapp', () => ({
  createInAppNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('@/app/lib/push', () => ({ sendPushToUser: jest.fn().mockResolvedValue({}) }));
jest.mock('@/app/lib/ai/comparePetPhotos', () => ({
  comparePetPhotos: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    pet: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    case: { findMany: jest.fn() },
    shelterProfile: { findFirst: jest.fn() },
    shelterMember: { findFirst: jest.fn(), findMany: jest.fn() },
    shelter: { findUnique: jest.fn() },
    shelterStrayMatch: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    alert: { create: jest.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendPushToUser } from '@/app/lib/push';
import { runStrayIntakeMatch } from '@/app/lib/shelterMatching';
import { GET as listMatches } from '@/app/api/shelter/matches/route';
import { POST as actOnMatch } from '@/app/api/shelter/matches/[matchId]/route';

const matchParams = { params: Promise.resolve({ matchId: 'match-1' }) };

const STRAY_PET = {
  id: 'pet-1',
  name: 'Scout',
  species: 'DOG',
  breed: 'Beagle',
  color: 'Brown and white',
  microchipId: null,
  primaryPhotoUrl: '',
  intakeType: 'STRAY',
  intakeDate: new Date('2026-07-15'),
  intakeFoundLatitude: 42.04,
  intakeFoundLongitude: -88.28,
  createdAt: new Date('2026-07-15'),
  managedByShelterId: 'shelter-1',
  managedByShelter: { latitude: 42.05, longitude: -88.3 },
};

const LOST_CASE = {
  id: 'case-1',
  caseNumber: 'AUS-2026-0009',
  petName: 'Biscuit',
  petSpecies: 'DOG',
  petBreed: 'Beagle',
  petColor: 'Brown and white',
  lastSeenLatitude: 42.041,
  lastSeenLongitude: -88.281,
  lastSeenAt: new Date('2026-07-10'),
  createdAt: new Date('2026-07-10'),
  reporterId: 'owner-1',
  pet: { microchipId: null },
};

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'claimer-1', email: 'claimer@shelter.org' } });
  prisma.shelterProfile.findFirst.mockResolvedValue({ shelterId: 'shelter-1', claimedById: 'claimer-1' });
  prisma.shelterMember.findFirst.mockResolvedValue(null);
  prisma.shelterMember.findMany.mockResolvedValue([]);
});

describe('the matcher (intake direction) contacts only the shelter', () => {
  test('PENDING rows are written and the owner is never notified', async () => {
    prisma.pet.findUnique.mockResolvedValue(STRAY_PET);
    prisma.case.findMany.mockResolvedValue([LOST_CASE]);
    prisma.shelterStrayMatch.findUnique.mockResolvedValue(null);
    prisma.shelterStrayMatch.create.mockResolvedValue({ id: 'match-1' });

    const result = await runStrayIntakeMatch('pet-1');
    expect(result.written).toBe(1);

    const created = prisma.shelterStrayMatch.create.mock.calls[0][0].data;
    expect(created.status).toBeUndefined(); // schema default PENDING
    expect(created.direction).toBe('STRAY_INTAKE');
    expect(created.caseId).toBe('case-1');

    // The shelter claimer hears about it; the case owner does not.
    expect(createInAppNotification).toHaveBeenCalledTimes(1);
    expect(createInAppNotification.mock.calls[0][0].userId).toBe('claimer-1');
    expect(sendPushToUser.mock.calls.every(([, userId]) => userId === 'claimer-1')).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('human decisions are never overwritten by a re-run', async () => {
    prisma.pet.findUnique.mockResolvedValue(STRAY_PET);
    prisma.case.findMany.mockResolvedValue([LOST_CASE]);
    prisma.shelterStrayMatch.findUnique.mockResolvedValue({ id: 'match-1', status: 'DISMISSED', visualVerdict: null });

    const result = await runStrayIntakeMatch('pet-1');
    expect(result.written).toBe(0);
    expect(prisma.shelterStrayMatch.update).not.toHaveBeenCalled();
    expect(prisma.shelterStrayMatch.create).not.toHaveBeenCalled();
  });

  test('non-stray or personal pets never match', async () => {
    prisma.pet.findUnique.mockResolvedValue({ ...STRAY_PET, intakeType: 'SURRENDER' });
    const result = await runStrayIntakeMatch('pet-1');
    expect(result.written).toBe(0);
    expect(prisma.case.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/shelter/matches', () => {
  test('401 unauthenticated, 403 for non-shelter users', async () => {
    getServerSession.mockResolvedValue(null);
    expect((await listMatches()).status).toBe(401);

    getServerSession.mockResolvedValue({ user: { id: 'rando-1' } });
    prisma.shelterProfile.findFirst.mockResolvedValue(null);
    expect((await listMatches()).status).toBe(403);
  });

  test('confident photo mismatches are hidden from the review list', async () => {
    const row = (id, extra = {}) => ({
      id,
      pTrueMatch: 0.7,
      band: 'actionable',
      matchSource: 'attribute',
      visualVerdict: null,
      visualConfidence: null,
      createdAt: new Date(),
      pet: { id: 'pet-1', name: 'Scout', species: 'DOG', breed: null, primaryPhotoUrl: '', intakeDate: null, intakeFoundAddress: null, isDeleted: false, managedByShelterId: 'shelter-1' },
      case: { id: 'case-1', caseNumber: 'C1', status: 'ACTIVE', petName: 'Biscuit', petSpecies: 'DOG', petBreed: null, petColor: 'Brown', petPhotoUrl: '', lastSeenAddress: '1 Oak St, Elgin, IL', lastSeenAt: null, createdAt: new Date(), pet: null },
      ...extra,
    });
    prisma.shelterStrayMatch.findMany.mockResolvedValue([
      row('keep'),
      row('hide', { visualVerdict: 'DIFFERENT', visualConfidence: 0.9 }),
      row('gone-case', { case: { ...row('x').case, status: 'REUNITED' } }),
    ]);

    const res = await listMatches();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.matches.map((m) => m.id)).toEqual(['keep']);
    // PII never leaves: the coarse area replaces the raw address
    expect(JSON.stringify(body)).not.toContain('1 Oak St');
  });
});

describe('POST /api/shelter/matches/[matchId]', () => {
  const PENDING_MATCH = {
    id: 'match-1',
    shelterId: 'shelter-1',
    status: 'PENDING',
    pet: { name: 'Scout', species: 'DOG', primaryPhotoUrl: '' },
    case: {
      id: 'case-1',
      caseNumber: 'AUS-2026-0009',
      petName: 'Biscuit',
      reporterId: 'owner-1',
      reporter: { email: 'owner@x.com', firstName: 'Jo' },
    },
  };

  beforeEach(() => {
    prisma.shelterStrayMatch.findFirst.mockResolvedValue(PENDING_MATCH);
    prisma.shelterStrayMatch.update.mockResolvedValue({});
    prisma.shelter.findUnique.mockResolvedValue({
      name: 'Austin Animal Center', address: '7201 Levander Loop',
      city: 'Austin', state: 'TX', phone: '512-555-0199', email: 'aac@x.org',
    });
    prisma.alert.create.mockResolvedValue({});
  });

  const req = (action) => ({ json: async () => ({ action }) });

  test('confirm notifies the owner through every channel and stamps ownerNotifiedAt', async () => {
    const res = await actOnMatch(req('confirm'), matchParams);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('CONFIRMED');

    expect(createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'owner-1', type: 'SHELTER_MATCH_CONFIRMED' })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@x.com' })
    );
    expect(sendPushToUser).toHaveBeenCalled();
    expect(prisma.alert.create).toHaveBeenCalled();

    const updates = prisma.shelterStrayMatch.update.mock.calls.map(([args]) => args.data);
    expect(updates[0]).toEqual(expect.objectContaining({ status: 'CONFIRMED', confirmedById: 'claimer-1' }));
    expect(updates[1].ownerNotifiedAt).toBeInstanceOf(Date);
  });

  test('dismiss is silent: nobody is notified', async () => {
    const res = await actOnMatch(req('dismiss'), matchParams);
    expect(res.status).toBe(200);
    expect(createInAppNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  test('another shelter\'s match reads as 404', async () => {
    prisma.shelterStrayMatch.findFirst.mockResolvedValue(null);
    const res = await actOnMatch(req('confirm'), matchParams);
    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('unknown action is a 400', async () => {
    const res = await actOnMatch(req('maybe'), matchParams);
    expect(res.status).toBe(400);
  });
});
