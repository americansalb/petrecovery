/**
 * GET /api/public/missions/[caseNumber] carries the questionnaire for the
 * pet's page (docs/REPORT_QUESTIONNAIRE.md): the answers minus the chip
 * number, and the finder guide built from them.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { case: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: jest.fn(),
  RateLimitPresets: {},
}));

import prisma from '@/app/lib/prisma';
import { GET } from '@/app/api/public/missions/[caseNumber]/route';

const CASE = {
  id: 'case-1',
  caseNumber: 'AUS-2026-0001',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
  petName: 'Max',
  petSpecies: 'DOG',
  petBreed: 'Golden Retriever',
  petColor: 'Golden',
  petSize: 'LARGE',
  petPhotoUrl: null,
  petDescription: 'Friendly',
  details: { v: 1, temperament: 'SCARED', health: ['DIABETIC'], healthNote: 'insulin twice a day', collar: 'COLLAR', collarColor: 'red', microchip: 'YES', microchipNumber: '985141000123456', lure: ['TREATS'] },
  needsMedication: true,
  hasReward: true,
  rewardAmount: 500,
  escapeScenario: 'spooked',
  lastSeenLatitude: 30.2729,
  lastSeenLongitude: -97.7444,
  lastSeenAddress: 'Zilker Park, Austin, TX 78704',
  lastSeenAt: new Date('2026-11-01T00:00:00Z'),
  searchRadius: 5,
  status: 'ACTIVE',
  priority: 'URGENT',
  reportType: 'LOST',
  resolution: null,
  resolvedAt: null,
  reporterId: 'u1',
  ownerName: 'Avery Jones',
  ownerPhone: '555-0147',
  viewCount: 0,
  shareCount: 0,
  activeSearchers: 0,
  sightings: [],
  updates: [],
};

const get = () => GET(new NextRequest('http://localhost:3000/api/public/missions/AUS-2026-0001'), { params: { caseNumber: 'AUS-2026-0001' } });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findUnique.mockResolvedValue({ ...CASE });
});

test('the finder guide and the answers ship; the chip number never does', async () => {
  const res = await get();
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.finderGuide.approach).toMatch(/^Don't chase, call out or stare\. Max will run\./);
  expect(body.finderGuide.health).toBe('Needs insulin twice a day. Please call the moment you see Max.');
  expect(body.finderGuide.lookFor).toBe('Red collar.');
  expect(body.finderGuide.lure).toBe('Comes to treats or a shaken food bag.');
  expect(body.finderGuide.microchipped).toBe(true);
  expect(body.needsMedication).toBe(true);
  expect(body.hasReward).toBe(true);
  expect(body.rewardAmount).toBe(500);
  expect(body.details.temperament).toBe('SCARED');
  expect(body.details.microchipNumber).toBeUndefined();
  expect(JSON.stringify(body)).not.toContain('985141000123456');
});

test('a report without answers still gets the general line, and no reward', async () => {
  prisma.case.findUnique.mockResolvedValue({ ...CASE, details: null, needsMedication: false, hasReward: false, rewardAmount: null });
  const body = await (await get()).json();
  expect(body.details).toBeNull();
  expect(body.finderGuide.approachKnown).toBe(false);
  expect(body.finderGuide.approach).toMatch(/^Don't chase\./);
  expect(body.finderGuide.health).toBe('');
  expect(body.hasReward).toBe(false);
  expect(body.rewardAmount).toBeNull();
});
