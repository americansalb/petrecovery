/**
 * Joining a search in one tap (POST /api/volunteer/join) and the helper
 * behind it (app/lib/volunteer/quickJoin.js).
 *
 * The route took no sign-in: a device id or a phone number in the request
 * was the whole of who was asking. Anyone could make guest accounts
 * without limit, add made-up helpers to any open search, or act as an
 * existing guest by sending their phone number. It is for someone signed
 * in, as themselves.
 *
 * The helper also failed every time after it had added the person (it
 * wrote a walk under a field name the schema does not have), and looked a
 * person up with no assignment at all when no force was on the pet.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn() },
    user: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    caseParticipant: { findFirst: jest.fn(), create: jest.fn() },
    caseAssignment: { update: jest.fn(async () => ({})), create: jest.fn() },
    rescueForce: { findMany: jest.fn(async () => []) },
    searchSession: { create: jest.fn() },
    missionVolunteer: { findFirst: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })), rateLimitResponse: () => new Response('{}', { status: 429 }) }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { POST } from '@/app/api/volunteer/join/route';

const post = (body) => POST(new NextRequest('http://localhost/api/volunteer/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const PET = { id: 'case-max', status: 'ACTIVE', assignments: [{ id: 'a-1', rescueSquad: { name: 'Austin', divisions: [] } }] };

beforeEach(() => {
  jest.clearAllMocks();
  withRateLimitAsync.mockResolvedValue({ success: true });
  getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
  prisma.case.findUnique.mockResolvedValue(PET);
  prisma.caseParticipant.findFirst.mockResolvedValue(null);
  prisma.caseParticipant.create.mockResolvedValue({ id: 'p-1' });
});

describe('who is joining', () => {
  test('nobody signed in: 401, and no account or helper is made', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await post({ missionId: 'case-max', deviceId: 'dev-1', phone: '5125550100', name: 'Robin' });
    expect(res.status).toBe(401);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.caseParticipant.create).not.toHaveBeenCalled();
    expect(prisma.case.findUnique).not.toHaveBeenCalled();
  });

  test('someone signed in joins as themselves, whatever device, name or phone the request names', async () => {
    const res = await post({ missionId: 'case-max', deviceId: 'dev-of-dana', phone: '5125550199', name: 'Dana', userId: 'u-dana' });
    expect(res.status).toBe(200);
    expect(prisma.caseParticipant.create).toHaveBeenCalledWith({ data: { assignmentId: 'a-1', userId: 'u-mike', isActive: true } });
    // No guest is looked for or made from what the request says.
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test('a pet named by something that is not text, or a body that is not an object: 400', async () => {
    expect((await post({ missionId: { not: '' } })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post('junk')).status).toBe(400);
    expect(prisma.case.findUnique).not.toHaveBeenCalled();
  });

  test('counted per connection', async () => {
    withRateLimitAsync.mockResolvedValue({ success: false });
    expect((await post({ missionId: 'case-max' })).status).toBe(429);
    expect(prisma.caseParticipant.create).not.toHaveBeenCalled();
  });
});

describe('the join itself', () => {
  test('it answers that the person is in, and writes no walk', async () => {
    const res = await post({ missionId: 'case-max' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, participantId: 'p-1', assignmentId: 'a-1', sessionId: null });
    expect(prisma.searchSession.create).not.toHaveBeenCalled();
    expect(prisma.caseAssignment.update).toHaveBeenCalledWith({ where: { id: 'a-1' }, data: { activeMembers: { increment: 1 } } });
  });

  test('already in: said so, and nothing more is written', async () => {
    prisma.caseParticipant.findFirst.mockResolvedValue({ id: 'p-0' });
    const body = await (await post({ missionId: 'case-max' })).json();
    expect(body).toMatchObject({ success: true, alreadyJoined: true, participantId: 'p-0' });
    expect(prisma.caseParticipant.findFirst.mock.calls[0][0].where).toEqual({ assignmentId: 'a-1', userId: 'u-mike', isActive: true });
    expect(prisma.caseParticipant.create).not.toHaveBeenCalled();
  });

  test('no force on the pet: there is nothing to join, and nobody is looked up without an assignment', async () => {
    prisma.case.findUnique.mockResolvedValue({ ...PET, assignments: [] });
    const res = await post({ missionId: 'case-max' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/No rescue force/);
    expect(prisma.caseParticipant.findFirst).not.toHaveBeenCalled();
    expect(prisma.caseParticipant.create).not.toHaveBeenCalled();
  });

  test('a search that is over is not joined', async () => {
    prisma.case.findUnique.mockResolvedValue({ ...PET, status: 'REUNITED' });
    expect((await post({ missionId: 'case-max' })).status).toBe(400);
    expect(prisma.caseParticipant.create).not.toHaveBeenCalled();
  });
});
