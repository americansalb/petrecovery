/**
 * Flyers are never redrawn all at once.
 *
 * Redrawing every open search's flyers back to back ran the 512 MB server
 * out of memory: it was killed, came back, started again and was killed
 * again, on 2026-11-05 and for most of an hour on 2026-11-13 (founder: "I
 * got badgateway a couple times ... now blank white", "Fix asap").
 *
 * A stale kit is now drawn again when the person running that search opens
 * it: one at a time, with a rest, with memory to spare, once per version,
 * and with the attempt written down first.
 */
const fs = require('fs');
const path = require('path');

const mockPrisma = {
  caseActivation: { findUnique: jest.fn() },
  cascadeStep: { upsert: jest.fn().mockResolvedValue({}) },
  case: { findUnique: jest.fn() },
};
jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
const mockRegenerate = jest.fn();
jest.mock('@/app/lib/cascade/refresh', () => ({ __esModule: true, regenerateCaseAssets: (...args) => mockRegenerate(...args) }));

const { openRedrawVerdict, redrawOnOpen, resetOpenRedraw, OPEN_REDRAW_STEP, OPEN_REDRAW_RSS_MB, OPEN_REDRAW_REST_MS } = require('@/app/lib/cascade/redrawOnOpen');
const { RENDERER_VERSION } = require('@/app/lib/cascade/render/version');

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const room = { rss: 200, busy: false, sinceLast: Infinity, status: 'COMPLETE' };

describe('whether one search is redrawn now', () => {
  test('a kit drawn by an older renderer is, when nothing else is being drawn and there is memory to spare', () => {
    expect(openRedrawVerdict({ ...room, stamped: '2026-11-06.8', tried: undefined })).toBe('redraw');
    expect(openRedrawVerdict({ ...room, stamped: undefined, tried: undefined })).toBe('redraw');
  });

  test('a kit already drawn by this renderer is left alone', () => {
    expect(openRedrawVerdict({ ...room, stamped: RENDERER_VERSION })).toBe('current');
  });

  test('once per search and version: a redraw that was tried is not tried again, whatever became of it', () => {
    expect(openRedrawVerdict({ ...room, stamped: '2026-11-06.8', tried: RENDERER_VERSION })).toBe('tried');
    // A new renderer version is a new try.
    expect(openRedrawVerdict({ ...room, stamped: '2026-11-06.8', tried: '2026-11-13.1' })).toBe('redraw');
  });

  test('one at a time, with a rest between two, and never while the kit is still being drawn the first time', () => {
    expect(openRedrawVerdict({ ...room, stamped: 'old', busy: true })).toBe('busy');
    expect(openRedrawVerdict({ ...room, stamped: 'old', sinceLast: OPEN_REDRAW_REST_MS - 1 })).toBe('resting');
    expect(openRedrawVerdict({ ...room, stamped: 'old', status: 'RUNNING' })).toBe('drawing');
    expect(openRedrawVerdict({ ...room, stamped: 'old', status: 'PENDING' })).toBe('drawing');
    expect(OPEN_REDRAW_REST_MS).toBeGreaterThanOrEqual(2 * 60 * 1000);
  });

  test('only with memory to spare, and the bar is under the 400 MB the batch used when it took the site down', () => {
    expect(openRedrawVerdict({ ...room, stamped: 'old', rss: OPEN_REDRAW_RSS_MB + 1 })).toBe('no-room');
    expect(openRedrawVerdict({ ...room, stamped: 'old', rss: NaN })).toBe('no-room');
    expect(OPEN_REDRAW_RSS_MB).toBeLessThan(400);
  });
});

describe('the redraw itself', () => {
  const kit = (over = {}) => ({ id: 'act-1', caseId: 'case-1', caseNumber: 'AUS-2026-TEST01', status: 'COMPLETE', assets: [{ meta: { rendererVersion: '2026-11-06.8' } }], steps: [], ...over });
  const usedMb = (mb) => jest.spyOn(process, 'memoryUsage').mockReturnValue({ rss: mb * 1024 * 1024 });

  beforeEach(() => {
    jest.clearAllMocks();
    resetOpenRedraw();
    usedMb(200);
    mockRegenerate.mockResolvedValue({ flyers: '3 ready', social: '3 ready' });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockPrisma.case.findUnique.mockResolvedValue({ id: 'case-1', caseNumber: 'AUS-2026-TEST01', reportType: 'LOST', resolvedAt: null, pet: null });
  });
  afterEach(() => jest.restoreAllMocks());

  test('that it was tried is written down before anything is drawn, so a redraw that kills the server is not started again', async () => {
    mockPrisma.caseActivation.findUnique.mockResolvedValue(kit());
    const order = [];
    mockPrisma.cascadeStep.upsert.mockImplementation(async () => { order.push('written'); return {}; });
    mockRegenerate.mockImplementation(async () => { order.push('drawn'); return { flyers: '3 ready', social: '3 ready' }; });
    expect(await redrawOnOpen('case-1', { now: 1_000_000 })).toBe('redrawn');
    expect(order).toEqual(['written', 'drawn', 'written']);
    expect(mockPrisma.cascadeStep.upsert.mock.calls.map((c) => c[0].create.result.state)).toEqual(['started', 'done']);
    const row = mockPrisma.cascadeStep.upsert.mock.calls[0][0];
    expect(row.where).toEqual({ activationId_key: { activationId: 'act-1', key: OPEN_REDRAW_STEP } });
    expect(row.create.result).toMatchObject({ version: RENDERER_VERSION, state: 'started' });
    // Left at "started" if the server dies here, and "started" is never tried again.
    expect(openRedrawVerdict({ ...room, stamped: 'old', tried: RENDERER_VERSION, state: 'started' })).toBe('tried');
    expect(openRedrawVerdict({ ...room, stamped: 'old', tried: RENDERER_VERSION, state: 'started-again' })).toBe('tried');
  });

  test('a redraw the server lived through but that brought no files gets one more try, and no third', async () => {
    mockPrisma.caseActivation.findUnique.mockResolvedValue(kit());
    mockRegenerate.mockResolvedValue({ flyers: 'failed: No flyer could be stored (all variants failed)', social: '3 ready' });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(await redrawOnOpen('case-1', { now: 1_000_000 })).toBe('failed');
    expect(mockPrisma.cascadeStep.upsert.mock.calls.map((c) => c[0].create.result.state)).toEqual(['started', 'retry']);
    expect(openRedrawVerdict({ ...room, stamped: 'old', tried: RENDERER_VERSION, state: 'retry' })).toBe('redraw');
    // The second try, from "retry": it ends at "failed", which is never tried again.
    resetOpenRedraw();
    mockPrisma.cascadeStep.upsert.mockClear();
    mockPrisma.caseActivation.findUnique.mockResolvedValue(kit({ steps: [{ result: { version: RENDERER_VERSION, state: 'retry' } }] }));
    expect(await redrawOnOpen('case-1', { now: Date.now() + 10 * 60 * 1000 })).toBe('failed');
    expect(mockPrisma.cascadeStep.upsert.mock.calls.map((c) => c[0].create.result.state)).toEqual(['started-again', 'failed']);
    expect(openRedrawVerdict({ ...room, stamped: 'old', tried: RENDERER_VERSION, state: 'failed' })).toBe('tried');
  });

  test('a failed redraw leaves the old flyer where it was', () => {
    const refresh = read('app/lib/cascade/refresh.js');
    expect(refresh).toMatch(/upsertAsset: \(kind, patch\) => keepOrFail\(activation, kind, patch\),/);
    expect(refresh).toMatch(/if \(had\?\.status === 'ready' && had\.url\) \{/);
    expect(refresh).not.toMatch(/await upsertAsset\(activation, '(FLYER_LETTER|SOCIAL_STORY)', \{ status: 'failed'/);
  });

  test('a kit whose redraw was tried is not drawn again, and a current one is not touched', async () => {
    mockPrisma.caseActivation.findUnique.mockResolvedValue(kit({ steps: [{ result: { version: RENDERER_VERSION } }] }));
    expect(await redrawOnOpen('case-1', { now: 1_000_000 })).toBe('tried');
    resetOpenRedraw();
    mockPrisma.caseActivation.findUnique.mockResolvedValue(kit({ assets: [{ meta: { rendererVersion: RENDERER_VERSION } }] }));
    expect(await redrawOnOpen('case-1', { now: 1_000_000 })).toBe('current');
    expect(mockRegenerate).not.toHaveBeenCalled();
    expect(mockPrisma.cascadeStep.upsert).not.toHaveBeenCalled();
  });

  test('two searches opened together: the second waits for the rest after the first', async () => {
    mockPrisma.caseActivation.findUnique.mockImplementation(async ({ where }) => kit({ id: `act-${where.caseId}`, caseId: where.caseId }));
    expect(await redrawOnOpen('case-1', { now: Date.now() })).toBe('redrawn');
    expect(await redrawOnOpen('case-2', { now: Date.now() })).toBe('resting');
    expect(mockRegenerate).toHaveBeenCalledTimes(1);
  });

  test('with the server short of memory nothing is drawn, and nothing is written', async () => {
    usedMb(OPEN_REDRAW_RSS_MB + 40);
    mockPrisma.caseActivation.findUnique.mockResolvedValue(kit());
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await redrawOnOpen('case-1', { now: 1_000_000 })).toBe('no-room');
    expect(mockRegenerate).not.toHaveBeenCalled();
    expect(mockPrisma.cascadeStep.upsert).not.toHaveBeenCalled();
  });

  test('the desk asks for its plan every minute: the same search is looked at once in ten', async () => {
    mockPrisma.caseActivation.findUnique.mockResolvedValue(kit({ assets: [{ meta: { rendererVersion: RENDERER_VERSION } }] }));
    expect(await redrawOnOpen('case-1', { now: 1_000_000 })).toBe('current');
    expect(await redrawOnOpen('case-1', { now: 1_000_000 + 60_000 })).toBe('looked');
    expect(mockPrisma.caseActivation.findUnique).toHaveBeenCalledTimes(1);
  });

  test('a failure never reaches the page that asked', async () => {
    mockPrisma.caseActivation.findUnique.mockRejectedValue(new Error('database away'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(redrawOnOpen('case-1', { now: 1_000_000 })).resolves.toBe('failed');
  });
});

describe('where a redraw can start from', () => {
  test('only the plan route, for whoever runs the search, and it is not waited for', () => {
    const plan = read('app/api/mission/[missionId]/plan/route.js');
    expect(plan).toMatch(/if \(searcher\.leads && isCaseOpen\(pet\.status\)\) redrawOnOpen\(pet\.id\)\.catch\(\(\) => \{\}\);/);
  });

  test('nothing a visitor or a crawler can reach starts one, and nothing starts one at boot', () => {
    // The pet's public kit and the public board are read by anyone.
    expect(read('app/api/cases/[caseNumber]/recovery-kit/route.js')).not.toMatch(/redrawOnOpen|regenerateCaseAssets|refreshStaleKits/);
    expect(read('app/api/mission/[missionId]/board/route.js')).not.toMatch(/redrawOnOpen|regenerateCaseAssets|refreshStaleKits/);
    const boot = read('instrumentation.js');
    expect(boot).toContain("process.env.CASCADE_REFRESH_ON_BOOT === '1'");
    expect(boot).not.toMatch(/redrawOnOpen/);
    // No loop and no timer in the redraw itself.
    const code = read('app/lib/cascade/redrawOnOpen.js').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code).not.toMatch(/setInterval|setTimeout|while \(|for \(/);
  });
});
