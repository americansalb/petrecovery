/**
 * Emailing a shelter from the site is switched off
 * (POST /api/mission/[missionId]/shelters/[shelterId], action "email").
 *
 * Nothing on the site offers it. Any account could add a "shelter" with
 * any address to any pet, and then have the site send that address a
 * letter built from the request's own words, picture and link.
 */

import { NextRequest } from 'next/server';

const sendShelterEmail = jest.fn(async () => ({ success: true, emailId: 'e-1' }));
const logShelterCall = jest.fn(async () => ({ attemptId: 'a-1', pointsEarned: 8, remainingDaily: 3 }));

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(async () => ({ id: 'u-x' })) },
    shelterContact: { findFirst: jest.fn(async () => ({ id: 'sc-1', shelterName: 'Any Name', shelterEmail: 'someone@example.com', shelterType: 'SHELTER' })) },
    case: { findUnique: jest.fn(async () => ({ id: 'case-max', createdAt: new Date(0) })) },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => ({ user: { id: 'u-x', email: 'x@example.com' } })) }));
jest.mock('@/lib/actions', () => ({ __esModule: true, getEmailService: () => ({ sendShelterEmail }), getVerificationService: () => ({ logShelterCall }) }));

import { POST } from '@/app/api/mission/[missionId]/shelters/[shelterId]/route';

const post = (body) => POST(new NextRequest('http://localhost/api/mission/case-max/shelters/sc-1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ missionId: 'case-max', shelterId: 'sc-1' }) });

beforeEach(() => jest.clearAllMocks());

test('asking the site to email a shelter sends nothing', async () => {
  const res = await post({ action: 'email', petName: 'Max', petDescription: '<a href="https://example.com">Click</a>', caseUrl: 'https://example.com' });
  expect(res.status).toBe(410);
  expect(await res.json()).toEqual({ error: 'Emailing a shelter from the site is not available.', code: 'NOT_AVAILABLE' });
  expect(sendShelterEmail).not.toHaveBeenCalled();
});

test('logging a call still works', async () => {
  const res = await post({ action: 'call', outcome: 'ANSWERED', staffResponse: 'NO_MATCH', notes: 'They took the number.' });
  expect(res.status).toBe(200);
  expect(logShelterCall).toHaveBeenCalledTimes(1);
  expect(sendShelterEmail).not.toHaveBeenCalled();
});
