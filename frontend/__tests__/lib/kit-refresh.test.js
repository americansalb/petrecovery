/**
 * Kits drawn by an older renderer get redrawn.
 *
 * Flyers and share images are drawn once, when a report is filed. After a
 * design change every open case would keep the old artwork, which is what
 * happened on 2026-11-05: the new flyers deployed and every existing case
 * still showed the old ones. Now every asset row is stamped with the
 * renderer version, and the server redraws the open cases whose stamp is
 * older, newest first, one at a time.
 */

const mockPrisma = {
  case: { findMany: jest.fn(), count: jest.fn() },
  caseActivation: { findUnique: jest.fn() },
  cascadeStep: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
};
jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));

const upsertStep = jest.fn().mockResolvedValue({});
const upsertAsset = jest.fn().mockResolvedValue({});
const rollupSummary = jest.fn().mockResolvedValue({ status: 'COMPLETE' });
jest.mock('@/app/lib/cascade/store', () => ({ upsertStep, upsertAsset, rollupSummary }));

const seedActivation = jest.fn(async (c) => ({ id: `act-${c.id}`, caseId: c.id, caseNumber: c.caseNumber }));
jest.mock('@/app/lib/cascade/runCascade', () => ({ seedActivation, makeGetShared: () => async () => ({}) }));

jest.mock('@/app/lib/cascade/aiCopy', () => ({
  generateAiCopy: jest.fn().mockResolvedValue({ source: 'template', headline: 'Lost dog' }),
}));
const runFlyers = jest.fn().mockResolvedValue({ count: 3, result: { ready: 3 } });
const runSocial = jest.fn().mockResolvedValue({ count: 3, result: { ready: 3 } });
jest.mock('@/app/lib/cascade/actions/flyers', () => ({ runFlyers }));
jest.mock('@/app/lib/cascade/actions/social', () => ({ runSocial }));
jest.mock('@/app/lib/cascade/actions/shareTargets', () => ({
  runShareTargets: jest.fn().mockResolvedValue({ count: 2, result: {} }),
}));

const { RENDERER_VERSION } = require('@/app/lib/cascade/render/version');
const {
  staleKitWhere,
  regenerateCaseAssets,
  refreshStaleKits,
  UNRESOLVED_STATUSES,
} = require('@/app/lib/cascade/refresh');

const aCase = (n) => ({ id: `id-${n}`, caseNumber: `LOS-2026-${n}`, petName: `Pet ${n}` });

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.caseActivation.findUnique.mockImplementation(async ({ where }) => ({ id: where.id }));
});

test('the renderer version is a dated string someone will remember to bump', () => {
  expect(RENDERER_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
});

test('a stale case is an open lost report with no flyer stamped with the current version', () => {
  const where = staleKitWhere();
  expect(where.reportType).toBe('LOST');
  expect(where.status).toEqual({ in: UNRESOLVED_STATUSES });
  expect(UNRESOLVED_STATUSES).not.toContain('REUNITED');
  expect(where.resolvedAt).toBeNull();
  // Reported before the cascade existed, or drawn by an older renderer.
  expect(where.OR[0]).toEqual({ activation: { is: null } });
  expect(where.OR[1]).toEqual({
    activation: {
      assets: { none: { kind: 'FLYER_LETTER', meta: { path: ['rendererVersion'], equals: RENDERER_VERSION } } },
    },
  });
});

test('redrawing one case settles its steps and its activation, and sends nothing', async () => {
  const outcome = await regenerateCaseAssets(aCase(1));
  expect(outcome).toMatchObject({ aiCopy: 'template', flyers: '3 ready', social: '3 ready', shareTargets: '2 targets' });
  const stepKeys = upsertStep.mock.calls.map(([, key, patch]) => `${key}:${patch.status}`);
  expect(stepKeys).toEqual(['ai_copy:SUCCESS', 'flyers:SUCCESS', 'social:SUCCESS', 'share_targets:SUCCESS']);
  // The kit page polls an activation left at RUNNING forever. Steps the
  // original run never finished are skipped (mike's kit sat at RUNNING with
  // recovery_email and followups PENDING), then the rollup settles it.
  expect(mockPrisma.cascadeStep.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { activationId: 'act-id-1', status: { in: ['PENDING', 'RUNNING'] } },
      data: expect.objectContaining({ status: 'SKIPPED' }),
    })
  );
  expect(rollupSummary).toHaveBeenCalledWith({ id: 'act-id-1' });
});

test('a case whose flyers cannot be drawn is stamped anyway, so it is tried once per version, not once per boot', async () => {
  runFlyers.mockRejectedValueOnce(new Error('photo unreadable'));
  const outcome = await regenerateCaseAssets(aCase(2));
  expect(outcome.flyers).toMatch(/^failed: photo unreadable/);
  expect(upsertStep).toHaveBeenCalledWith(expect.anything(), 'flyers', expect.objectContaining({ status: 'FAILED' }));
  expect(upsertAsset).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'act-id-2' }),
    'FLYER_LETTER',
    expect.objectContaining({ status: 'failed', meta: { rendererVersion: RENDERER_VERSION } })
  );
  // The share images still get drawn.
  expect(outcome.social).toBe('3 ready');
});

test('the refresh redraws the stale cases newest first, one at a time, and says how many remain', async () => {
  mockPrisma.case.findMany.mockResolvedValue([aCase(3), aCase(4)]);
  mockPrisma.case.count.mockResolvedValue(5);
  const order = [];
  runFlyers.mockImplementation(async (ctx) => {
    order.push(`start ${ctx.case.caseNumber}`);
    await new Promise((r) => setTimeout(r, 5));
    order.push(`end ${ctx.case.caseNumber}`);
    return { count: 3, result: { ready: 3 } };
  });

  const stats = await refreshStaleKits({ limit: 2, pauseMs: 0, rssBudgetMb: Infinity });

  expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: staleKitWhere(), orderBy: { createdAt: 'desc' }, take: 2, include: { pet: true } })
  );
  expect(order).toEqual(['start LOS-2026-3', 'end LOS-2026-3', 'start LOS-2026-4', 'end LOS-2026-4']);
  expect(stats).toMatchObject({ version: RENDERER_VERSION, attempted: 2, redrawn: 2, failed: [], remaining: 5 });
});

test('a case that fails to redraw is counted, named, and does not stop the rest', async () => {
  mockPrisma.case.findMany.mockResolvedValue([aCase(5), aCase(6)]);
  mockPrisma.case.count.mockResolvedValue(0);
  runSocial.mockRejectedValueOnce(new Error('resvg missing'));

  const stats = await refreshStaleKits({ pauseMs: 0, rssBudgetMb: Infinity });

  expect(stats.attempted).toBe(2);
  expect(stats.redrawn).toBe(1);
  expect(stats.failed).toEqual(['LOS-2026-5']);
  expect(stats.remaining).toBe(0);
});

test('two refreshes never run at once', async () => {
  mockPrisma.case.findMany.mockResolvedValue([aCase(7)]);
  mockPrisma.case.count.mockResolvedValue(0);
  const first = refreshStaleKits({ pauseMs: 0, rssBudgetMb: Infinity });
  const second = await refreshStaleKits({ pauseMs: 0, rssBudgetMb: Infinity });
  expect(second.skipped).toMatch(/already running/);
  await first;
});

test('the pass stops, and says so, when the server has no room for the next case', async () => {
  mockPrisma.case.findMany.mockResolvedValue([aCase(8), aCase(9), aCase(10)]);
  mockPrisma.case.count.mockResolvedValue(2);
  // A budget below what this very process uses: the first case is drawn,
  // the wait for room gives up, and the rest are left for later.
  const stats = await refreshStaleKits({ pauseMs: 0, rssBudgetMb: 1, maxWaitMs: 0 });
  expect(stats.attempted).toBe(1);
  expect(stats.stopped).toMatch(/over the 1 MB budget; 2 left for the next pass/);
  expect(stats.remaining).toBe(2);
});

test('the flyers and social actions stamp every asset row they write', () => {
  const fs = require('fs');
  const path = require('path');
  for (const file of ['flyers.js', 'social.js']) {
    const src = fs.readFileSync(path.resolve(__dirname, '../../app/lib/cascade/actions', file), 'utf8');
    expect(src).toMatch(/import \{ RENDERER_VERSION \} from '\.\.\/render\/version'/);
    // Both the ready row and the failed row carry the stamp.
    expect(src.match(/meta: stamp/g)).toHaveLength(2);
  }
});

test('the server schedules the redraw at boot, in production only', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../../instrumentation.js'), 'utf8');
  expect(src).toContain("process.env.NODE_ENV === 'production'");
  expect(src).toContain("process.env.NEXT_PHASE !== 'phase-production-build'");
  expect(src).toContain('scheduleStaleKitRefresh()');
  // The renderers cannot be bundled for the edge runtime this file is also
  // compiled for (the build died on sharp's child_process), so the boot
  // hook imports the light module that asks the route over loopback.
  expect(src).toContain("import('./app/lib/cascade/refreshBoot')");
  expect(src).not.toContain("import('./app/lib/cascade/refresh')");
});
