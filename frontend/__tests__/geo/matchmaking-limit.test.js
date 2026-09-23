/**
 * Quick match's own rate limit was keyed on the address alone: forty a
 * minute, against a search that polls fifteen times a minute. The third
 * player searching from one school, office or carrier address was
 * refused. It is keyed per account now, which the session proves, with a
 * ceiling on the address far above a household and far below a flood.
 */
jest.mock('@/app/lib/geo/server/requireAccount', () => ({ requireAccount: async () => null }));
jest.mock('@/app/lib/geo/server/identity', () => ({ accountFromRequest: (request) => ({ accountId: request.headers.get('x-test-account') }) }));
jest.mock('@/app/lib/geo/server/meterRequest', () => ({ subjectsFor: async () => ({ profileId: 'p', accountId: 'a' }) }));
jest.mock('@/app/lib/geo/server/roomStore', () => ({ prismaRoomStore: {} }));
jest.mock('@/app/lib/geo/server/matchmaking', () => ({ matchmaking: async () => ({ status: 'waiting', game: 'street', joinedAt: 0 }) }));
jest.mock('@/app/lib/geo/server/limiter', () => {
  const actual = jest.requireActual('@/app/lib/geo/server/limiter');
  return { ...actual, getClientIP: () => '203.0.113.9' };
});

const { _resetLimiter } = require('@/app/lib/geo/server/limiter');
const { POST } = require('@/app/api/geo/matchmaking/route');

const poll = (account) => POST(new Request('https://probablyearth.com/api/geo/matchmaking', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-test-account': account },
  body: JSON.stringify({ action: 'poll', game: 'street' }),
}));

beforeEach(() => _resetLimiter());

test('five players behind one address can all search for a minute', async () => {
  for (let tick = 0; tick < 15; tick += 1) {
    for (const account of ['a1', 'a2', 'a3', 'a4', 'a5']) {
      const response = await poll(account);
      expect({ account, tick, status: response.status }).toEqual({ account, tick, status: 200 });
    }
  }
});

test('one account still has a limit of its own', async () => {
  const statuses = [];
  for (let i = 0; i < 45; i += 1) statuses.push((await poll('greedy')).status);
  expect(statuses.slice(0, 40).every((s) => s === 200)).toBe(true);
  expect(statuses.slice(40)).toContain(429);
});
