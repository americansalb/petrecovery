/**
 * Keystone regression for the GLOBAL spend ceiling (app/lib/rateLimit.js
 * checkGlobalLimitAsync) - AC-e from Delphi disc. 1.
 *
 * The decisive assertion (evil-architect msg 350 / architect msg 360): a COST
 * ceiling must FAIL CLOSED. When a Redis op throws mid-window, the ceiling must
 * NOT wave the request through (success:true) - that would open the paid-API
 * money tap exactly when infra is stressed. This locks the fail-closed contract
 * so a future refactor can't silently reintroduce fail-open.
 *
 * The 'redis' import in rateLimit.js is dynamic (await import('redis') inside
 * getRedisClient), so mocking it here is safe from the import-hoist TDZ trap.
 */

const mockIncr = jest.fn();
const mockExpire = jest.fn().mockResolvedValue(1);
const mockTtl = jest.fn().mockResolvedValue(60);

jest.mock('redis', () => ({
  __esModule: true,
  createClient: () => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    incr: (...a) => mockIncr(...a),
    expire: (...a) => mockExpire(...a),
    ttl: (...a) => mockTtl(...a),
  }),
}));

import { checkGlobalLimitAsync } from '@/app/lib/rateLimit';

const OPTS = { windowMs: 60000, maxRequests: 100, blockDurationMs: 60000 };

describe('checkGlobalLimitAsync - global spend ceiling (AC-e)', () => {
  beforeAll(() => {
    process.env.REDIS_URL = 'redis://localhost:6379';
  });
  beforeEach(() => {
    mockIncr.mockReset();
    mockExpire.mockResolvedValue(1);
    mockTtl.mockResolvedValue(60);
  });

  test('KEYSTONE: a Redis op error FAILS CLOSED - rejects, never allow-all', async () => {
    mockIncr.mockRejectedValue(new Error('redis connection reset mid-op'));
    const res = await checkGlobalLimitAsync('ai:analyze-pet', OPTS);
    expect(res.success).toBe(false);
    expect(res.blocked).toBe(true);
  });

  test('over the ceiling => blocked (success:false)', async () => {
    mockIncr.mockResolvedValue(OPTS.maxRequests + 1);
    const res = await checkGlobalLimitAsync('ai:analyze-pet', OPTS);
    expect(res.success).toBe(false);
    expect(res.blocked).toBe(true);
  });

  test('under the ceiling => allowed, with remaining headroom', async () => {
    mockIncr.mockResolvedValue(1);
    const res = await checkGlobalLimitAsync('ai:analyze-pet', OPTS);
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(OPTS.maxRequests - 1);
  });

  test('first request in a window sets the TTL (so the window actually expires)', async () => {
    mockIncr.mockResolvedValue(1);
    await checkGlobalLimitAsync('ai:analyze-pet', OPTS);
    expect(mockExpire).toHaveBeenCalled();
  });
});
