/**
 * An update on a pet's page (POST /api/missions/[missionId]/notes).
 *
 * It is what the owner tells everyone helping: it shows on the pet's page
 * and on every helper's card. The boxes it is typed in stop at 400 and 500
 * characters, but the route itself took anything: no limit on length, a
 * value that was not text crashed it, and when it failed it sent the
 * server's own error text back to the screen.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: { case: { findUnique: jest.fn() }, caseUpdate: { create: jest.fn(async ({ data }) => ({ id: 'up-1', ...data })), findMany: jest.fn() } } }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => ({ user: { id: 'u-avery', role: 'USER' } })) }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => ({})) }));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })), rateLimitResponse: () => new Response('{}', { status: 429 }) }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { GET, POST } from '@/app/api/missions/[missionId]/notes/route';
import { UPDATE_MAX } from '@/app/lib/searchText';

const post = (body) => POST(new NextRequest('http://localhost/api/missions/case-max/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), { params: { missionId: 'case-max' } });
const saved = () => prisma.caseUpdate.create.mock.calls.at(-1)[0].data;

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-avery', role: 'USER' } });
  prisma.case.findUnique.mockResolvedValue({ id: 'case-max', caseNumber: 'AUS-1', reporterId: 'u-avery', assignments: [] });
  withRateLimitAsync.mockResolvedValue({ success: true });
});

test('the owner\'s words are kept as written, with their line breaks', async () => {
  const res = await post({ content: '  Max comes to a squeaky ball.\n\n\n\nHe is wearing a blue collar.  ' });
  expect(res.status).toBe(201);
  expect(saved()).toMatchObject({ caseId: 'case-max', authorId: 'u-avery', content: 'Max comes to a squeaky ball.\n\nHe is wearing a blue collar.', isUpdate: true, isPinned: false });
});

test('held to a length, without what is not text', async () => {
  await post({ content: 'x'.repeat(50000) });
  expect(saved().content).toHaveLength(UPDATE_MAX);
  expect(UPDATE_MAX).toBe(1000);
  await post({ content: `Seen${String.fromCharCode(0)} near${String.fromCharCode(0x202e)} the creek` });
  expect(saved().content).toBe('Seen near the creek');
});

test.each([
  ['nothing', {}],
  ['only spaces', { content: '   \n ' }],
  ['only characters that draw as nothing', { content: String.fromCharCode(0x200b, 0x200d, 0x3164) }],
  ['a number', { content: 12345 }],
  ['an object', { content: { $ne: null } }],
  ['a list', { content: ['a', 'b'] }],
])('%s is not an update: 400, and nothing is kept', async (_what, body) => {
  const res = await post(body);
  expect(res.status).toBe(400);
  expect(prisma.caseUpdate.create).not.toHaveBeenCalled();
});

test('a body that is not an object is refused the same way', async () => {
  expect((await post('[1]')).status).toBe(400);
  expect((await post('not json')).status).toBe(400);
});

test('pinned only by a plain true', async () => {
  await post({ content: 'One', isPinned: 'yes' });
  expect(saved().isPinned).toBe(false);
  await post({ content: 'Two', isPinned: true });
  expect(saved().isPinned).toBe(true);
});

test('someone who is not the owner, staff or assigned to the pet is refused', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'u-stranger', role: 'USER' } });
  const res = await post({ content: 'New sighting reported near 4001 Ramsey Ave' });
  expect(res.status).toBe(403);
  expect(prisma.caseUpdate.create).not.toHaveBeenCalled();
});

test('nobody signed in: 401', async () => {
  getServerSession.mockResolvedValue(null);
  expect((await post({ content: 'Hello' })).status).toBe(401);
});

test('counted per connection: twenty a minute', async () => {
  await post({ content: 'One' });
  const [, limit, key] = withRateLimitAsync.mock.calls[0];
  expect(key).toBe('case:note');
  expect(limit).toMatchObject({ windowMs: 60000, maxRequests: 20 });
  withRateLimitAsync.mockResolvedValue({ success: false });
  expect((await post({ content: 'Two' })).status).toBe(429);
  expect(prisma.caseUpdate.create).toHaveBeenCalledTimes(1);
});

test('when it fails, the screen is told so in a sentence and not in the server\'s own words', async () => {
  prisma.caseUpdate.create.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2'));
  const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await post({ content: 'Hello' });
  quiet.mockRestore();
  expect(res.status).toBe(500);
  const body = await res.json();
  expect(body).toEqual({ error: 'Failed to add note', message: 'That did not post. Try again in a moment.' });
  expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|hunter2|10\.0\.0\.5/);
});

describe('reading the notes', () => {
  const read = () => GET(new NextRequest('http://localhost/api/missions/case-max/notes'), { params: { missionId: 'case-max' } });
  const NOTE = { id: 'up-1', content: 'Max comes to a squeaky ball.', createdAt: new Date(0), isUpdate: true, isPinned: false };

  test('the owner sees who wrote each note in full', async () => {
    prisma.caseUpdate.findMany.mockResolvedValue([{ ...NOTE, authorId: 'u-avery', author: { id: 'u-avery', firstName: 'Avery', lastName: 'Lindqvist' } }]);
    const res = await read();
    expect(res.status).toBe(200);
    expect(prisma.caseUpdate.findMany.mock.calls[0][0].include.author.select).toEqual({ id: true, firstName: true, lastName: true });
    expect((await res.json()).updates[0].author.lastName).toBe('Lindqvist');
  });

  test('a helper is told a first name and whether a note is their own, and no account id', async () => {
    // Starting a walk makes any account a helper on the pet.
    getServerSession.mockResolvedValue({ user: { id: 'u-helper', role: 'USER' } });
    prisma.case.findUnique.mockResolvedValue({ id: 'case-max', reporterId: 'u-avery', assignments: [{ participants: [{ id: 'p-1' }] }] });
    prisma.caseUpdate.findMany.mockResolvedValue([
      { ...NOTE, authorId: 'u-avery', author: { firstName: 'Avery' } },
      { ...NOTE, id: 'up-2', authorId: 'u-helper', author: { firstName: 'Robin' } },
    ]);
    const res = await read();
    expect(res.status).toBe(200);
    expect(prisma.caseUpdate.findMany.mock.calls[0][0].include.author.select).toEqual({ firstName: true });
    const { updates } = await res.json();
    expect(updates.map((u) => u.mine)).toEqual([false, true]);
    expect(JSON.stringify(updates)).not.toMatch(/authorId|u-avery|u-helper|lastName/);
  });

  test('a stranger is refused, and nobody signed in is 401', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-stranger', role: 'USER' } });
    expect((await read()).status).toBe(403);
    getServerSession.mockResolvedValue(null);
    expect((await read()).status).toBe(401);
    expect(prisma.caseUpdate.findMany).not.toHaveBeenCalled();
  });
});
