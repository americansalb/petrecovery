/**
 * The game's rate limiter (app/lib/geo/server/limiter.js).
 *
 * Pinned here: the window counts and then blocks, the block outlasts the
 * window, a key is a key so one player's burst does not touch another's,
 * the address is read from the trusted header when one is configured,
 * and the refusal carries the headers a client needs to back off.
 *
 * Memory backend only. Redis is exercised by the deployment that sets
 * REDIS_URL; without it these are the rules that apply.
 */

const {
  RateLimitPresets,
  checkRateLimitForKeyAsync,
  getClientIP,
  rateLimitResponse,
  withRateLimitAsync,
  _resetLimiter,
} = require('@/app/lib/geo/server/limiter');

const request = (headers = {}) => ({ headers: new Map(Object.entries(headers)) });

beforeEach(() => {
  _resetLimiter();
  delete process.env.RATELIMIT_TRUSTED_IP_HEADER;
  delete process.env.REDIS_URL;
});

describe('the window', () => {
  const rule = { windowMs: 60000, maxRequests: 3, blockDurationMs: 120000 };

  test('counts down, refuses past the limit, and says how long to wait', async () => {
    const first = await checkRateLimitForKeyAsync('a', rule);
    expect(first).toMatchObject({ success: true, remaining: 2, blocked: false });
    expect((await checkRateLimitForKeyAsync('a', rule)).remaining).toBe(1);
    expect((await checkRateLimitForKeyAsync('a', rule)).remaining).toBe(0);

    const refused = await checkRateLimitForKeyAsync('a', rule);
    expect(refused).toMatchObject({ success: false, remaining: 0, blocked: true });
    // The block, not the window, is what the caller waits out.
    expect(refused.retryAfter).toBe(120);
    expect(refused.resetAt).toBeGreaterThan(Date.now());
  });

  test('a blocked key stays blocked while the block lasts', async () => {
    for (let i = 0; i < 4; i++) await checkRateLimitForKeyAsync('b', rule);
    const again = await checkRateLimitForKeyAsync('b', rule);
    expect(again.success).toBe(false);
    expect(again.retryAfter).toBeGreaterThan(0);
    expect(again.retryAfter).toBeLessThanOrEqual(120);
  });

  test('keys are independent, so one player cannot spend what another player has left', async () => {
    for (let i = 0; i < 4; i++) await checkRateLimitForKeyAsync('ada', rule);
    expect((await checkRateLimitForKeyAsync('ada', rule)).success).toBe(false);
    expect((await checkRateLimitForKeyAsync('grace', rule)).success).toBe(true);
  });

  test('the defaults apply when a caller passes nothing', async () => {
    const result = await checkRateLimitForKeyAsync('c');
    expect(result).toMatchObject({ success: true, remaining: 29 });
  });
});

describe('the address behind a request', () => {
  test('the trusted header wins when one is configured', () => {
    process.env.RATELIMIT_TRUSTED_IP_HEADER = 'cf-connecting-ip';
    const ip = getClientIP(request({ 'cf-connecting-ip': '203.0.113.5', 'x-forwarded-for': '198.51.100.9' }));
    expect(ip).toBe('203.0.113.5');
  });

  test('without one it falls back, leftmost first, and says so when there is nothing', () => {
    expect(getClientIP(request({ 'x-real-ip': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(getClientIP(request({ 'x-forwarded-for': '203.0.113.8, 10.0.0.1' }))).toBe('203.0.113.8');
    expect(getClientIP(request({}))).toBe('unknown');
  });

  test('a request is limited by its address, and two addresses do not share a bucket', async () => {
    const rule = { ...RateLimitPresets.PUBLIC_WRITE, maxRequests: 2 };
    const mine = request({ 'x-real-ip': '203.0.113.20' });
    const theirs = request({ 'x-real-ip': '203.0.113.21' });
    expect((await withRateLimitAsync(mine, rule, 'rooms')).success).toBe(true);
    expect((await withRateLimitAsync(mine, rule, 'rooms')).success).toBe(true);
    expect((await withRateLimitAsync(mine, rule, 'rooms')).success).toBe(false);
    expect((await withRateLimitAsync(theirs, rule, 'rooms')).success).toBe(true);
    // A different prefix is a different bucket, so one endpoint cannot exhaust another.
    expect((await withRateLimitAsync(mine, rule, 'profile')).success).toBe(true);
  });
});

describe('the refusal', () => {
  test('is a 429 that tells the caller when to come back', async () => {
    const response = rateLimitResponse({ retryAfter: 45, resetAt: 1770000000000 });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('45');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ error: 'Too many requests', retryAfter: 45 });
  });

  test('always carries a Retry-After, even for a result that has none', () => {
    expect(rateLimitResponse({}).headers.get('Retry-After')).toBe('60');
  });
});

describe('the presets', () => {
  test('match the numbers the pet site uses, so a review reads the same', () => {
    expect(RateLimitPresets.PUBLIC_WRITE).toEqual({ windowMs: 60000, maxRequests: 10, blockDurationMs: 300000 });
    expect(RateLimitPresets.PUBLIC_READ).toEqual({ windowMs: 60000, maxRequests: 60, blockDurationMs: 60000 });
  });
});
