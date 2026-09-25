/**
 * "Something wrong?" on the Script answer screen (server/reports.js).
 *
 * The point of the feature is a count the founder can trust: the same
 * complaint from many people about one language should stand out, and
 * nothing else should be able to fake that. So these check that the
 * language comes from the sealed round rather than the browser, that one
 * person's repeats count once, and that only an admin sees the piles.
 */

const rows = [];
const fakePrisma = {
  geoScriptReport: {
    findFirst: jest.fn(async ({ where }) =>
      rows.find(
        (row) =>
          row.ipHash === where.ipHash &&
          row.language === where.language &&
          row.kind === where.kind &&
          row.status === where.status &&
          row.createdAt >= where.createdAt.gte,
      ) || null,
    ),
    create: jest.fn(async ({ data }) => {
      const row = { id: `r${rows.length + 1}`, status: 'open', createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    }),
    groupBy: jest.fn(async () => {
      const groups = new Map();
      for (const row of rows.filter((r) => r.status === 'open')) {
        const key = `${row.language}:${row.kind}`;
        const group = groups.get(key) || { language: row.language, kind: row.kind, _count: { _all: 0 }, _max: { createdAt: row.createdAt } };
        group._count._all += 1;
        if (row.createdAt > group._max.createdAt) group._max.createdAt = row.createdAt;
        groups.set(key, group);
      }
      return [...groups.values()];
    }),
    findMany: jest.fn(async () => rows.filter((r) => r.status === 'open' && r.note !== null).sort((a, b) => b.createdAt - a.createdAt)),
    updateMany: jest.fn(async ({ where, data }) => {
      let count = 0;
      for (const row of rows) {
        if (row.language === where.language && row.kind === where.kind && row.status === where.status) {
          Object.assign(row, data);
          count += 1;
        }
      }
      return { count };
    }),
  },
};
jest.mock('@/app/lib/geo/server/db', () => ({ __esModule: true, default: fakePrisma }));

const mockRequireAdmin = jest.fn();
jest.mock('@/app/lib/geo/server/admin', () => {
  class AdminDenied extends Error {
    constructor(reason = 'not_admin') {
      super(reason);
      this.reason = reason;
    }
  }
  return { AdminDenied, requireAdmin: (...args) => mockRequireAdmin(...args) };
});

const SECRET = 'a-long-enough-test-secret';
process.env.GEO_TOKEN_SECRET = SECRET;

const { createScriptRound, scriptRoundFromToken } = require('@/app/lib/geo/server/scriptGame');
const { sealToken } = require('@/app/lib/geo/server/tokens');
const { cleanNote, closeReports, fileReport, reportFromRound, reportSummary, REPORT_NOTE_MAX } = require('@/app/lib/geo/server/reports');
const { POST: postReport } = require('@/app/api/geo/script/report/route');
const { GET: getPiles, POST: closePile } = require('@/app/api/geo/admin/reports/route');
const { AdminDenied } = require('@/app/lib/geo/server/admin');

const env = { GEO_TOKEN_SECRET: SECRET };
const roundToken = (seed = 'report-seed', roundIndex = 0) => createScriptRound({ config: { rounds: 5, seed }, roundIndex, env }).token;

function request(body, ip = '198.51.100.7') {
  const headers = new Map([['x-forwarded-for', ip]]);
  return {
    json: async () => (body instanceof Error ? Promise.reject(body) : body),
    headers: { get: (name) => headers.get(name.toLowerCase()) || null },
    url: 'http://localhost/api/geo/script/report',
  };
}

beforeEach(() => {
  rows.length = 0;
  mockRequireAdmin.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore?.();
});

describe('a report is about the round the server dealt', () => {
  test('the language and the text come from the sealed token, not from the browser', () => {
    const token = roundToken();
    const dealt = scriptRoundFromToken({ token, env });
    const report = reportFromRound({ token, kind: 'area', note: 'French is not what people speak in Haiti', language: 'eng', env });
    expect(report.language).toBe(dealt.language.code);
    expect(report.text).toBe(dealt.text);
    expect(report.text.length).toBeGreaterThan(20);
  });

  test('a made-up or tampered token is refused', () => {
    expect(() => reportFromRound({ token: 'g1.not-a-round', kind: 'area', env })).toThrow();
    const forged = sealToken({ c: 'eng', i: 0, seed: 'x' }, { secret: 'somebody-elses-secret' });
    expect(() => reportFromRound({ token: forged, kind: 'area', env })).toThrow();
  });

  test('it has to say what kind of wrong', () => {
    const token = roundToken();
    expect(() => reportFromRound({ token, kind: 'spam', env })).toThrow(/Say what is wrong/);
    expect(() => reportFromRound({ token: '', kind: 'area', env })).toThrow(/round/);
  });

  test('notes are cleaned and capped, pins are checked', () => {
    expect(cleanNote('  two\u0007  spaces\t\there  ')).toBe('two spaces here');
    expect(cleanNote('   ')).toBeNull();
    expect(cleanNote(42)).toBeNull();
    expect([...cleanNote('é'.repeat(REPORT_NOTE_MAX + 50))]).toHaveLength(REPORT_NOTE_MAX);
    const token = roundToken();
    expect(reportFromRound({ token, kind: 'other', guess: { lat: 18.54321987, lng: -72.3388 }, env })).toMatchObject({ guessLat: 18.5432, guessLng: -72.3388 });
    expect(reportFromRound({ token, kind: 'other', guess: { lat: 200, lng: 0 }, env })).toMatchObject({ guessLat: null, guessLng: null });
  });
});

describe('the same person saying the same thing counts once', () => {
  test('repeats within a day are not stored again', async () => {
    const report = reportFromRound({ token: roundToken(), kind: 'area', env });
    expect(await fileReport(report, { ipHash: 'ip:a' })).toEqual({ stored: true });
    expect(await fileReport(report, { ipHash: 'ip:a' })).toEqual({ stored: false });
    expect(await fileReport({ ...report, kind: 'hint' }, { ipHash: 'ip:a' })).toEqual({ stored: true });
    expect(await fileReport(report, { ipHash: 'ip:b' })).toEqual({ stored: true });
    expect(rows).toHaveLength(3);
  });

  test('the next day it counts again', async () => {
    const report = reportFromRound({ token: roundToken(), kind: 'area', env });
    await fileReport(report, { ipHash: 'ip:a' });
    rows[0].createdAt = new Date(Date.now() - 2 * 86400000);
    expect(await fileReport(report, { ipHash: 'ip:a' })).toEqual({ stored: true });
  });
});

describe('the piles', () => {
  test('grouped by language and kind, biggest first, with the latest notes', async () => {
    const french = { language: 'fra', kind: 'area', note: null, text: 'Bonjour', guessLat: null, guessLng: null };
    for (const ip of ['ip:1', 'ip:2', 'ip:3']) await fileReport({ ...french, note: `not in Haiti ${ip}` }, { ipHash: ip });
    await fileReport({ ...french, language: 'tha', kind: 'hint', note: null }, { ipHash: 'ip:1' });
    const piles = await reportSummary();
    expect(piles.map((p) => [p.language, p.kind, p.count])).toEqual([
      ['fra', 'area', 3],
      ['tha', 'hint', 1],
    ]);
    expect(piles[0].name).toBe('French');
    expect(piles[0].notes).toHaveLength(3);
    expect(piles[1].notes).toEqual([]);
  });

  test('a pile marked done disappears, and new reports start a new one', async () => {
    const french = { language: 'fra', kind: 'area', note: 'x', text: null, guessLat: null, guessLng: null };
    await fileReport(french, { ipHash: 'ip:1' });
    await fileReport(french, { ipHash: 'ip:2' });
    expect(await closeReports({ language: 'fra', kind: 'area' })).toBe(2);
    expect(await reportSummary()).toEqual([]);
    // After the fix ships, the same person saying it again counts again.
    expect(await fileReport(french, { ipHash: 'ip:1' })).toEqual({ stored: true });
    expect((await reportSummary()).map((p) => p.count)).toEqual([1]);
    await expect(closeReports({ language: 'fra', kind: 'nonsense' })).rejects.toThrow();
  });
});

describe('POST /api/geo/script/report', () => {
  test('stores a report about the dealt language and answers ok', async () => {
    const token = roundToken('route-seed');
    const response = await postReport(request({ token, kind: 'language', note: 'This reads like Portuguese', guess: { lat: 1, lng: 2 } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].language).toBe(scriptRoundFromToken({ token, env }).language.code);
    expect(rows[0].ipHash).toMatch(/^ip:[0-9a-f]{24}$/);
    expect(rows[0].note).toBe('This reads like Portuguese');
  });

  test('pressing Send twice is one report', async () => {
    const body = { token: roundToken('twice'), kind: 'hint' };
    expect((await postReport(request(body))).status).toBe(200);
    expect((await postReport(request(body))).status).toBe(200);
    expect(rows).toHaveLength(1);
  });

  test('bad bodies, kinds and tokens are 400s', async () => {
    expect((await postReport(request(new Error('not json')))).status).toBe(400);
    expect((await postReport(request({ token: roundToken(), kind: 'nope' }))).status).toBe(400);
    const bad = await postReport(request({ token: 'g1.bogus', kind: 'area' }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe('invalid');
    expect(rows).toHaveLength(0);
  });
});

describe('/api/geo/admin/reports', () => {
  test('refuses anyone who is not an admin', async () => {
    mockRequireAdmin.mockRejectedValue(new AdminDenied('not_admin'));
    expect((await getPiles(request({}))).status).toBe(403);
    expect((await closePile(request({ language: 'fra', kind: 'area' }))).status).toBe(403);
  });

  test('shows an admin the piles and lets them close one', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin' });
    await fileReport({ language: 'fra', kind: 'area', note: 'Haiti', text: null, guessLat: null, guessLng: null }, { ipHash: 'ip:9' });
    const piles = await (await getPiles(request({}))).json();
    expect(piles.groups).toHaveLength(1);
    const closed = await closePile(request({ language: 'fra', kind: 'area' }));
    expect(await closed.json()).toEqual({ ok: true, closed: 1 });
    expect((await closePile(request({ language: 'fra' }))).status).toBe(400);
  });
});
