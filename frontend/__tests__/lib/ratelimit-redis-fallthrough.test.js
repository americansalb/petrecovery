/**
 * A Redis error mid-request must not silently disable the per-IP rate limit.
 *
 * checkRateLimitRedis used to return { success: true } from its catch block, so
 * one failing Redis command let the request through uncounted - a flaky or
 * misconfigured Redis quietly turned every public-write and auth limit off.
 * (rateLimit-global.test.js locks the same fail-closed contract for the global
 * spend ceiling; this is its per-key twin.)
 *
 * Now a Redis error returns null and the caller falls through to the durable
 * database limiter, or - when there is no database either, as mocked here - to
 * the in-memory limiter. The point is that the request is still COUNTED, not
 * waved through with the full quota intact.
 *
 * The 'redis' import in rateLimit.js is dynamic, so mocking it here is safe from
 * the import-hoist TDZ trap.
 */

const mockIncr = jest.fn();

jest.mock('redis', () => ({
  __esModule: true,
  createClient: () => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    incr: (...a) => mockIncr(...a),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(60),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  }),
}));
// No database, so the fall-through lands on the in-memory limiter. That still
// counts - which is the whole point. (A real deploy falls through to Postgres.)
jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: null }));

import { checkRateLimitForKeyAsync } from '@/app/lib/rateLimit';

const OPTS = { windowMs: 60000, maxRequests: 3, blockDurationMs: 60000 };

describe('a Redis error falls through to a real limiter, never fail-open', () => {
  beforeAll(() => {
    process.env.REDIS_URL = 'redis://localhost:6379';
  });
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockIncr.mockReset();
  });
  afterEach(() => console.error.mockRestore());

  test('a throwing Redis command still counts the request (no allow-all)', async () => {
    mockIncr.mockRejectedValue(new Error('redis connection reset mid-op'));
    const key = `fallthrough:${Date.now()}`;

    const first = await checkRateLimitForKeyAsync(key, OPTS);
    // Fail-open returned { success: true, remaining: maxRequests }; the
    // fall-through counts this request, so the quota drops by one.
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(OPTS.maxRequests - 1);

    await checkRateLimitForKeyAsync(key, OPTS);
    await checkRateLimitForKeyAsync(key, OPTS);
    const overLimit = await checkRateLimitForKeyAsync(key, OPTS);

    // A fail-open limiter could never block; the fall-through does.
    expect(overLimit.success).toBe(false);
    expect(overLimit.blocked).toBe(true);
  });
});
