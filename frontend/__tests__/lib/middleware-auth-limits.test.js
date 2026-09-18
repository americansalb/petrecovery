const { middleware } = require('@/middleware');
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
const previous = process.env.RATELIMIT_TRUSTED_IP_HEADER;
beforeAll(() => { process.env.RATELIMIT_TRUSTED_IP_HEADER = 'cf-connecting-ip'; });
afterAll(() => {
  if (previous === undefined) delete process.env.RATELIMIT_TRUSTED_IP_HEADER;
  else process.env.RATELIMIT_TRUSTED_IP_HEADER = previous;
});

function request(index, address) {
  const url = 'https://probablyearth.com/api/geo/auth/request';
  return {
    url, method: 'POST', nextUrl: new URL(url),
    headers: new Headers({ host: 'probablyearth.com', ...(address ? { 'cf-connecting-ip': address } : {}),
      'x-forwarded-for': `192.0.2.${index}`, 'x-real-ip': `198.51.100.${index}`,
      'x-geo-profile': `forged-profile-${index}`, 'x-geo-player': `forged-player-${index}` }),
  };
}

test('real middleware caps email requests even when address and profile headers rotate', async () => {
  const statuses = [];
  for (let i = 0; i < 7; i++) statuses.push((await middleware(request(i, '203.0.113.9'))).status);
  expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429]);
  expect((await middleware(request(9, '203.0.113.10'))).status).toBe(200);
});

test('omitting the trusted edge header cannot restore a fresh key per attempt', async () => {
  const statuses = [];
  for (let i = 20; i < 27; i++) statuses.push((await middleware(request(i))).status);
  expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429]);
});
