/**
 * The older flyer maker (POST /api/mission/[missionId]/flyers/generate).
 *
 * Nothing on the site calls it. The flyer it makes carries the owner's
 * phone and email address and the address the pet was lost at, and it
 * answered any account for any pet.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: { case: { findUnique: jest.fn() }, user: { findUnique: jest.fn() } } }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('qrcode', () => ({ __esModule: true, default: { toDataURL: jest.fn(async () => 'data:image/png;base64,AAAA') } }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/mission/[missionId]/flyers/generate/route';

const post = () => POST(new NextRequest('http://localhost/api/mission/case-max/flyers/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ size: 'half' }) }), { params: Promise.resolve({ missionId: 'case-max' }) });
const PET = { id: 'case-max', caseNumber: 'AUS-2026-0001', reporterId: 'u-avery', petName: 'Max', petSpecies: 'DOG', lastSeenAddress: '4001 Ramsey Ave, Austin', ownerPhone: '5125550100', ownerEmail: 'avery@example.com', lastSeenAt: new Date(0), reporter: { phone: '5125550100', email: 'avery@example.com' }, pet: null };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findUnique.mockResolvedValue(PET);
  prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
});

test('an account that is not the owner is given no flyer, and none of what is on it', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'u-stranger', email: 'x@example.com' } });
  const res = await post();
  expect(res.status).toBe(403);
  expect(JSON.stringify(await res.json())).not.toMatch(/avery@example\.com|5125550100|Ramsey/);
});

test('the owner makes it', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'u-avery', email: 'avery@example.com' } });
  const res = await post();
  expect(res.status).toBe(200);
  expect((await res.json()).flyerData).toMatchObject({ petName: 'Max', contactPhone: '5125550100' });
});

test('staff may too, by the role in the database', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'u-staff', email: 's@example.com' } });
  prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
  expect((await post()).status).toBe(200);
});

test('nobody signed in: 401', async () => {
  getServerSession.mockResolvedValue(null);
  expect((await post()).status).toBe(401);
});
