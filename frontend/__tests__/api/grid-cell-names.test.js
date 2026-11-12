/**
 * The older block route (PATCH /api/mission/[missionId]/grid/cell) says
 * that a block is held, and never by whom.
 *
 * Any account can call it and any account can listen to the search's
 * stream. Who holds a block is for the owner and the forces looking for
 * the pet, who ask the board (app/lib/searcher.js, `seesNames`). This
 * route told a stranger the holder's first name when they lost a block to
 * them, and sent the holder's account id and first name to every listener.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    gridCell: { findUnique: jest.fn(), updateMany: jest.fn() },
    searchGrid: { update: jest.fn(async () => ({})) },
    user: { findUnique: jest.fn() },
    case: { findUnique: jest.fn(async () => ({ petName: 'Max', caseNumber: 'AUS-1' })) },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => ({ user: { id: 'u-stranger' } })) }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/sse/missionStream', () => ({ __esModule: true, broadcast: jest.fn() }));
jest.mock('@/app/lib/waiver', () => ({ __esModule: true, waiverRefusal: jest.fn(async () => null) }));
jest.mock('@/app/lib/forceFeed', () => ({ __esModule: true, forcesOf: jest.fn(async () => []) }));
jest.mock('@/app/lib/wake', () => ({ __esModule: true, wakeForces: jest.fn(async () => ({})), WAKE_KINDS: { BLOCK_FREE: 'BLOCK_FREE' } }));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })), rateLimitResponse: () => new Response('{}', { status: 429 }) }));

import prisma from '@/app/lib/prisma';
import { broadcast } from '@/app/lib/sse/missionStream';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { PATCH } from '@/app/api/mission/[missionId]/grid/cell/route';

const CASE = 'case-max';
const patch = (body) => PATCH(new NextRequest(`http://localhost/api/mission/${CASE}/grid/cell`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), { params: { missionId: CASE } });
const CELL = { id: 'cell-1', gridId: 'grid-1', row: 1, col: 2, status: 'UNSEARCHED', claimedById: null, claimedAt: null, grid: { caseId: CASE } };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.gridCell.findUnique.mockResolvedValue(CELL);
  prisma.gridCell.updateMany.mockResolvedValue({ count: 1 });
  prisma.user.findUnique.mockResolvedValue({ firstName: 'Dana' });
  withRateLimitAsync.mockResolvedValue({ success: true });
});

test('losing a block to someone says someone has it, and does not look up who', async () => {
  // The claim itself loses; the first updateMany is the release of anything already held.
  prisma.gridCell.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
  prisma.gridCell.findUnique.mockResolvedValueOnce(CELL).mockResolvedValueOnce({ claimedById: 'u-dana', status: 'IN_PROGRESS' });
  const res = await patch({ cellId: 'cell-1', action: 'claim' });
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe('CELL_TAKEN');
  expect(body.error).toMatch(/^Someone just claimed .+\. Pick a block nearby\.$/);
  expect(JSON.stringify(body)).not.toMatch(/Dana|u-dana/);
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
});

test('what every listener is sent says a block is held, never by whom', async () => {
  prisma.gridCell.findUnique
    .mockResolvedValueOnce(CELL)
    .mockResolvedValueOnce({ id: 'cell-1', row: 1, col: 2, status: 'IN_PROGRESS', claimedById: 'u-stranger', claimedAt: new Date(0), searchedAt: null, searchCount: 0 });
  const res = await patch({ cellId: 'cell-1', action: 'claim' });
  expect(res.status).toBe(200);
  expect(broadcast).toHaveBeenCalledTimes(1);
  const [to, event] = broadcast.mock.calls[0];
  expect(to).toBe(CASE);
  expect(event.type).toBe('CELL_CLAIMED');
  expect(event.cell).toMatchObject({ id: 'cell-1', status: 'IN_PROGRESS', claimed: true });
  expect(Object.keys(event.cell)).not.toEqual(expect.arrayContaining(['claimedById']));
  expect(Object.keys(event.cell)).not.toEqual(expect.arrayContaining(['claimedByName']));
  expect(JSON.stringify(event)).not.toMatch(/u-stranger|Dana/);
  // The person who took it is still told it is theirs.
  expect((await res.json()).cell).toMatchObject({ mine: true });
});

test('a block id that is not text, or a body that is not an object, is refused before anything is read', async () => {
  expect((await patch({ cellId: { $ne: null }, action: 'claim' })).status).toBe(400);
  expect((await patch('[]')).status).toBe(400);
  expect((await patch({ cellId: 'cell-1', action: 'erase' })).status).toBe(400);
  expect(prisma.gridCell.findUnique).not.toHaveBeenCalled();
});

test('counted per connection, since giving a block back wakes the forces looking', async () => {
  await patch({ cellId: 'cell-1', action: 'release' });
  const [, limit, key] = withRateLimitAsync.mock.calls[0];
  expect(key).toBe('grid:cell');
  expect(limit).toMatchObject({ windowMs: 60000, maxRequests: 20 });
  withRateLimitAsync.mockResolvedValue({ success: false });
  expect((await patch({ cellId: 'cell-1', action: 'release' })).status).toBe(429);
});
