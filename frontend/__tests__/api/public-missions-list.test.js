/**
 * GET /api/public/missions: the filters the Lost & Found board and the city
 * pages send.
 *
 * The city filter used to write the state into the same `contains` as the
 * town, which dropped the town: /lost-pet/orlando-fl listed every address
 * containing the letters "fl", anywhere in the country. Town and state are
 * separate conditions now, and the state matches either spelling a real
 * address uses.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { case: { findMany: jest.fn(), count: jest.fn() } },
}));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimit: jest.fn(() => ({ success: true })),
  rateLimitResponse: jest.fn(),
  RateLimitPresets: { PUBLIC_READ: {} },
}));

import prisma from '@/app/lib/prisma';
import { GET } from '@/app/api/public/missions/route';

function list(query) {
  return GET(new Request(`http://localhost/api/public/missions?${query}`));
}

function lastWhere() {
  return prisma.case.findMany.mock.calls.at(-1)[0].where;
}

beforeEach(() => {
  prisma.case.findMany.mockReset().mockResolvedValue([]);
  prisma.case.count.mockReset().mockResolvedValue(0);
});

test('a city page filters by the town AND the state, not the state alone', async () => {
  const res = await list('city=Orlando&state=FL&limit=6');
  expect(res.status).toBe(200);

  const where = lastWhere();
  expect(where.lastSeenAddress).toBeUndefined();
  expect(where.AND).toEqual([
    { lastSeenAddress: { contains: 'Orlando', mode: 'insensitive' } },
    {
      OR: [
        { lastSeenAddress: { contains: ', FL' } },
        { lastSeenAddress: { contains: 'florida', mode: 'insensitive' } },
      ],
    },
  ]);
});

test('the search box and the city filter combine instead of overwriting each other', async () => {
  await list('q=golden&city=Austin&state=TX');
  const where = lastWhere();
  expect(where.OR).toHaveLength(4);
  expect(where.OR[0]).toEqual({ petName: { contains: 'golden', mode: 'insensitive' } });
  expect(where.AND[0]).toEqual({ lastSeenAddress: { contains: 'Austin', mode: 'insensitive' } });
  expect(where.AND[1].OR).toContainEqual({ lastSeenAddress: { contains: 'texas', mode: 'insensitive' } });
});

test('no city or state means no place filter', async () => {
  await list('type=FOUND');
  const where = lastWhere();
  expect(where.AND).toBeUndefined();
  expect(where.reportType).toBe('FOUND');
});

test('every card gets a readable place label', async () => {
  prisma.case.findMany.mockResolvedValue([
    { id: '1', caseNumber: 'C-1', lastSeenAddress: 'Walmart, 3838 South Semoran Boulevard, Orlando, Florida', _count: { sightings: 2 } },
    { id: '2', caseNumber: 'C-2', lastSeenAddress: '28.5383, -81.3792', _count: { sightings: 0 } },
  ]);
  prisma.case.count.mockResolvedValue(2);

  const body = await (await list('city=Orlando&state=FL')).json();
  expect(body.cases[0]).toMatchObject({ caseNumber: 'C-1', place: 'Orlando, FL', city: 'Orlando', state: 'FL', sightingCount: 2 });
  expect(body.cases[1]).toMatchObject({ caseNumber: 'C-2', place: null, city: 'Unknown', state: 'XX' });
});
