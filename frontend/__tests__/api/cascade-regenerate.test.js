/**
 * POST /api/cascade/regenerate: the shared secret redraws anything; the
 * in-process boot token redraws the stale kits and nothing else.
 */

const mockPrisma = { case: { findFirst: jest.fn() } };
jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: mockPrisma }));

const refreshStaleKits = jest.fn();
const countStaleCases = jest.fn();
const regenerateCaseAssets = jest.fn();
jest.mock('@/app/lib/cascade/refresh', () => ({ refreshStaleKits, countStaleCases, regenerateCaseAssets }));

const { POST } = require('@/app/api/cascade/regenerate/route');
const { bootRefreshToken } = require('@/app/lib/cascade/refreshBoot');

const post = (query, headers = {}) =>
  POST(new Request(`http://localhost/api/cascade/regenerate?${query}`, { method: 'POST', headers }));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CASCADE_SWEEP_SECRET = 'shh';
  refreshStaleKits.mockResolvedValue({ version: 'v', attempted: 1, redrawn: 1, failed: [], remaining: 0, ms: 10 });
  countStaleCases.mockResolvedValue(3);
  regenerateCaseAssets.mockResolvedValue({ aiCopy: 'template', flyers: '3 ready', social: '3 ready' });
  mockPrisma.case.findFirst.mockResolvedValue({ id: 'c1', caseNumber: 'LOS-2026-1' });
});

test('no secret and no token is unauthorized; no secret configured at all is 503', async () => {
  expect((await post('stale=1')).status).toBe(401);
  expect((await post('stale=1', { 'x-sweep-secret': 'wrong' })).status).toBe(401);
  delete process.env.CASCADE_SWEEP_SECRET;
  expect((await post('stale=1')).status).toBe(503);
  // The boot token still works without the secret: that is its point.
  expect((await post('stale=1', { 'x-kit-refresh-token': bootRefreshToken() })).status).toBe(200);
});

test('the secret redraws the stale kits and waits for the result', async () => {
  const res = await post('stale=1&limit=7', { 'x-sweep-secret': 'shh' });
  expect(res.status).toBe(200);
  expect(refreshStaleKits).toHaveBeenCalledWith({ limit: 7, pauseMs: 0 });
  expect(await res.json()).toMatchObject({ ok: true, attempted: 1, redrawn: 1, remaining: 0 });
});

test('wait=0 answers at once with the stale count and redraws in the background', async () => {
  let resolveRefresh;
  refreshStaleKits.mockReturnValue(new Promise((r) => (resolveRefresh = r)));
  const res = await post('stale=1&limit=200&wait=0', { 'x-kit-refresh-token': bootRefreshToken() });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, started: true, stale: 3 });
  expect(refreshStaleKits).toHaveBeenCalledWith({ limit: 200 });
  resolveRefresh({ attempted: 3, redrawn: 3, failed: [], remaining: 0, ms: 1 });
});

test('wait=0 with nothing stale starts nothing', async () => {
  countStaleCases.mockResolvedValue(0);
  const res = await post('stale=1&wait=0', { 'x-kit-refresh-token': bootRefreshToken() });
  expect(await res.json()).toMatchObject({ ok: true, started: false, stale: 0 });
  expect(refreshStaleKits).not.toHaveBeenCalled();
});

test('the boot token cannot redraw an arbitrary case', async () => {
  const res = await post('case=LOS-2026-1', { 'x-kit-refresh-token': bootRefreshToken() });
  expect(res.status).toBe(403);
  expect(regenerateCaseAssets).not.toHaveBeenCalled();
});

test('the secret redraws one case by number', async () => {
  const res = await post('case=LOS-2026-1', { 'x-sweep-secret': 'shh' });
  expect(res.status).toBe(200);
  expect(regenerateCaseAssets).toHaveBeenCalledWith(
    expect.objectContaining({ caseNumber: 'LOS-2026-1' }),
    { correlationId: 'regen-LOS-2026-1' }
  );
  expect(await res.json()).toMatchObject({ ok: true, caseNumber: 'LOS-2026-1', flyers: '3 ready' });
});

test('the boot token is one value for the life of the process', () => {
  expect(bootRefreshToken()).toBe(bootRefreshToken());
  expect(bootRefreshToken()).toMatch(/^[0-9a-f-]{36}$/);
});
