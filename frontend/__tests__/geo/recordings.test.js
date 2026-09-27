/**
 * Voices (beta): recordings from the public, on /geo/record
 * (server/recordings.js, docs/GEO.md "Recordings").
 *
 * What matters: only a signed-in person who agreed to the terms can
 * record, only languages an admin opened are offered (the page must not
 * give away what the game covers), a take is checked before it is kept,
 * nothing reaches players without an admin approving it, a person is a
 * voice in the game only while every sentence has an approved take, and
 * deleting recordings (or the account) takes them out of the game.
 */

// ---- A small in-memory Prisma, enough for the queries these modules make.
let seq = 0;
const DEFAULTS = {
  geoVoice: { kind: 'elevenlabs', enabled: true, weight: 2, delivery: 'natural', about: null, previewUrl: null },
  geoVoiceRecording: { status: 'pending', reason: null, reviewedAt: null },
  geoVoiceLanguage: { enabled: false, recording: false },
};
const UNIQUE = {
  accountId_language: ['accountId', 'language'],
  setId_text: ['setId', 'text'],
  language_voiceId: ['language', 'voiceId'],
};
function matches(row, where = {}) {
  return Object.entries(where || {}).every(([key, cond]) => {
    if (key === 'OR') return cond.some((sub) => matches(row, sub));
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return cond.in.includes(row[key]);
      if ('gte' in cond) return row[key] >= cond.gte;
    }
    return row[key] === cond;
  });
}
const pick = (row, select) => (select ? Object.fromEntries(Object.keys(select).map((key) => [key, row[key]])) : { ...row });
function table(name, primary = 'id') {
  const rows = [];
  const find = (where) => {
    const [key, value] = Object.entries(where)[0];
    if (UNIQUE[key]) return rows.find((row) => UNIQUE[key].every((field) => row[field] === value[field])) || null;
    return rows.find((row) => matches(row, where)) || null;
  };
  const make = (data) => {
    seq += 1;
    const now = new Date(Date.now() + seq);
    const row = { ...(primary === 'id' ? { id: `${name}${seq}` } : {}), createdAt: now, updatedAt: now, ...DEFAULTS[name], ...data };
    rows.push(row);
    return row;
  };
  return {
    rows,
    findUnique: jest.fn(async ({ where, select }) => {
      const row = find(where);
      return row ? pick(row, select) : null;
    }),
    findFirst: jest.fn(async ({ where, select }) => {
      const row = rows.find((item) => matches(item, where));
      return row ? pick(row, select) : null;
    }),
    findMany: jest.fn(async ({ where, select, take } = {}) => rows.filter((row) => matches(row, where)).slice(0, take ?? Infinity).map((row) => pick(row, select))),
    count: jest.fn(async ({ where } = {}) => rows.filter((row) => matches(row, where)).length),
    create: jest.fn(async ({ data }) => make(data)),
    upsert: jest.fn(async ({ where, create, update, select }) => {
      const row = find(where);
      if (row) {
        Object.assign(row, update, { updatedAt: new Date(Date.now() + ++seq) });
        return pick(row, select);
      }
      return pick(make(create), select);
    }),
    update: jest.fn(async ({ where, data, select }) => {
      const row = find(where);
      Object.assign(row, data, { updatedAt: new Date(Date.now() + ++seq) });
      return pick(row, select);
    }),
    updateMany: jest.fn(async ({ where, data }) => {
      let count = 0;
      for (const row of rows) if (matches(row, where)) { Object.assign(row, data); count += 1; }
      return { count };
    }),
    delete: jest.fn(async ({ where }) => rows.splice(rows.indexOf(find(where)), 1)[0]),
    deleteMany: jest.fn(async ({ where }) => {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) { rows.splice(i, 1); count += 1; }
      return { count };
    }),
    groupBy: jest.fn(async ({ by, where }) => {
      const groups = new Map();
      for (const row of rows.filter((item) => matches(item, where))) {
        const key = by.map((field) => row[field]).join('|');
        const group = groups.get(key) || { ...Object.fromEntries(by.map((field) => [field, row[field]])), _count: { _all: 0 } };
        group._count._all += 1;
        groups.set(key, group);
      }
      return [...groups.values()];
    }),
    aggregate: jest.fn(async () => ({ _sum: { chars: null } })),
  };
}
const fakePrisma = {
  geoAccount: table('geoAccount'),
  geoVoiceLanguage: table('geoVoiceLanguage', 'language'),
  geoVoice: table('geoVoice'),
  geoVoiceClip: table('geoVoiceClip'),
  geoVoiceContributor: table('geoVoiceContributor', 'accountId'),
  geoVoiceSet: table('geoVoiceSet'),
  geoVoiceRecording: table('geoVoiceRecording'),
  geoScriptReport: table('geoScriptReport'),
};
jest.mock('@/app/lib/geo/server/db', () => ({ __esModule: true, default: fakePrisma }));
jest.mock('@/app/lib/geo/server/sweep', () => ({ maybeSweep: jest.fn() }));

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

const SECRET = 'a-long-enough-test-secret-for-recordings';
process.env.GEO_TOKEN_SECRET = SECRET;

const rec = require('@/app/lib/geo/server/recordings');
const { enabledVoices, voiceClip, languageVoices } = require('@/app/lib/geo/server/voice');
const { deleteAccount } = require('@/app/lib/geo/server/accounts');
const { samplesFor } = require('@/app/lib/geo/server/samples');
const { sealSession } = require('@/app/lib/geo/server/identity');
const { openToken } = require('@/app/lib/geo/server/tokens');
const { GAME_RATE_LIMITS, GAME_SHORT_PATHS } = require('@/app/lib/geo/site');
const recordRoute = require('@/app/api/geo/record/route');
const setRoute = require('@/app/api/geo/record/set/route');
const takeRoute = require('@/app/api/geo/record/take/route');
const adminRoute = require('@/app/api/geo/admin/recordings/route');
const adminAudio = require('@/app/api/geo/admin/recordings/audio/route');
const { POST: postRound } = require('@/app/api/geo/script/round/route');
const { GET: getClip } = require('@/app/api/geo/voice/clip/route');
const { AdminDenied } = require('@/app/lib/geo/server/admin');

const GUJ = samplesFor('guj');
const webm = (label = 'take') => Buffer.from(`webm ${label}`);

const cookieFor = (accountId) => `geo_session=${encodeURIComponent(sealSession({ accountId, email: `${accountId}@example.test` }))}`;
const request = ({ url = 'http://localhost/api/geo/record', body, raw, type, cookie } = {}) => {
  const headers = new Map([['cookie', cookie || ''], ['content-type', type || 'application/json']]);
  if (raw) headers.set('content-length', String(raw.length));
  return {
    url,
    headers: { get: (name) => headers.get(name.toLowerCase()) || null },
    json: async () => body,
    arrayBuffer: async () => (raw ? raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length) : new ArrayBuffer(0)),
  };
};

/** An account that agreed to the terms and started Gujarati. */
async function speaker(id = 'acct1', { region = 'Ahmedabad' } = {}) {
  fakePrisma.geoAccount.rows.push({ id, email: `${id}@example.test`, suspendedAt: null });
  await rec.joinRecording({ accountId: id, name: `Name ${id}`, agree: true });
  await rec.startSet({ accountId: id, language: 'guj', region });
  return id;
}

/** Every Gujarati sentence read by one person, then approved. */
async function fullSet(id) {
  for (let n = 0; n < GUJ.length; n++) await rec.saveTake({ accountId: id, language: 'guj', n, audio: webm(`${id}-${n}`), mime: 'audio/webm;codecs=opus', durationMs: 2400 });
  const set = fakePrisma.geoVoiceSet.rows.find((row) => row.accountId === id);
  await rec.approveSet({ setId: set.id });
  return set;
}

beforeEach(async () => {
  for (const model of Object.values(fakePrisma)) model.rows.length = 0;
  mockRequireAdmin.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await rec.setRecordingOpen({ language: 'guj', open: true });
});

afterEach(() => {
  console.error.mockRestore?.();
});

describe('the public page offers only what an admin opened', () => {
  test('open languages, with how many people have started each', async () => {
    await speaker('a');
    const open = await rec.openLanguages();
    expect(open).toEqual([expect.objectContaining({ code: 'guj', name: 'Gujarati', script: 'gujr', sentences: GUJ.length, speakers: 1 })]);
    await rec.setRecordingOpen({ language: 'guj', open: false });
    expect(await rec.openLanguages()).toEqual([]);
  });

  test('a language with no sentences cannot be opened', async () => {
    await expect(rec.setRecordingOpen({ language: 'xyz', open: true })).rejects.toMatchObject({ code: 'bad_language' });
  });

  test('the route has a rate limit and a short path on the game’s own domain', () => {
    expect(GAME_RATE_LIMITS['/api/geo/record']).toBeTruthy();
    expect(GAME_SHORT_PATHS['/record']).toBe('/geo/record');
  });
});

describe('recording', () => {
  test('needs the terms agreed, an open language and where it was learned', async () => {
    await expect(rec.startSet({ accountId: 'x', language: 'guj', region: 'Surat' })).rejects.toMatchObject({ code: 'no_consent' });
    await expect(rec.joinRecording({ accountId: 'x', name: 'X', agree: false })).rejects.toMatchObject({ code: 'no_consent' });
    await expect(rec.joinRecording({ accountId: 'x', name: '  ', agree: true })).rejects.toMatchObject({ code: 'no_name' });
    await rec.joinRecording({ accountId: 'x', name: 'X', agree: true });
    await expect(rec.startSet({ accountId: 'x', language: 'guj', region: '' })).rejects.toMatchObject({ code: 'no_region' });
    await expect(rec.startSet({ accountId: 'x', language: 'tam', region: 'Chennai' })).rejects.toMatchObject({ code: 'closed' });
    await expect(rec.startSet({ accountId: 'x', language: 'guj', region: 'Surat' })).resolves.toMatchObject({ language: 'guj', region: 'Surat' });
  });

  test('a take is checked before it is kept', async () => {
    const id = await speaker();
    const base = { accountId: id, language: 'guj', n: 0, audio: webm(), mime: 'audio/webm', durationMs: 2000 };
    await expect(rec.saveTake({ ...base, mime: 'text/html' })).rejects.toMatchObject({ code: 'bad_audio' });
    await expect(rec.saveTake({ ...base, audio: Buffer.alloc(0) })).rejects.toMatchObject({ code: 'empty' });
    await expect(rec.saveTake({ ...base, audio: Buffer.alloc(rec.MAX_TAKE_BYTES + 1) })).rejects.toMatchObject({ code: 'too_big' });
    await expect(rec.saveTake({ ...base, durationMs: 100 })).rejects.toMatchObject({ code: 'too_short' });
    await expect(rec.saveTake({ ...base, durationMs: 60000 })).rejects.toMatchObject({ code: 'too_long' });
    await expect(rec.saveTake({ ...base, n: GUJ.length })).rejects.toMatchObject({ code: 'bad_sentence' });
    await expect(rec.saveTake(base)).resolves.toMatchObject({ status: 'pending' });
  });

  test('a second take of a sentence replaces the first and waits again', async () => {
    const id = await speaker();
    const first = await rec.saveTake({ accountId: id, language: 'guj', n: 1, audio: webm('one'), mime: 'audio/mp4', durationMs: 2000 });
    await rec.reviewTake({ id: first.id, decision: 'reject', reason: 'noise' });
    const second = await rec.saveTake({ accountId: id, language: 'guj', n: 1, audio: webm('two'), mime: 'audio/mp4', durationMs: 2100 });
    expect(second.id).toBe(first.id);
    expect(fakePrisma.geoVoiceRecording.rows).toHaveLength(1);
    expect(fakePrisma.geoVoiceRecording.rows[0]).toMatchObject({ status: 'pending', reason: null, mime: 'audio/mp4', durationMs: 2100 });
  });

  test('a closed language keeps what was recorded but takes nothing new', async () => {
    const id = await speaker();
    await rec.saveTake({ accountId: id, language: 'guj', n: 0, audio: webm(), mime: 'audio/webm', durationMs: 2000 });
    await rec.setRecordingOpen({ language: 'guj', open: false });
    await expect(rec.saveTake({ accountId: id, language: 'guj', n: 1, audio: webm(), mime: 'audio/webm', durationMs: 2000 })).rejects.toMatchObject({ code: 'closed' });
    const detail = await rec.setDetail({ accountId: id, language: 'guj' });
    expect(detail.language.open).toBe(false);
    expect(detail.sentences[0].status).toBe('pending');
  });

  test('a sentence can be flagged instead of read, and the studio shows where each one stands', async () => {
    const id = await speaker();
    const kept = await rec.saveTake({ accountId: id, language: 'guj', n: 0, audio: webm(), mime: 'audio/webm', durationMs: 2000 });
    await rec.reviewTake({ id: kept.id, decision: 'reject', reason: 'volume' });
    await expect(rec.flagSentence({ accountId: id, language: 'guj', n: 2, note: '' })).rejects.toMatchObject({ code: 'no_note' });
    await rec.flagSentence({ accountId: id, language: 'guj', n: 2, note: 'It has a mistake' });
    const detail = await rec.setDetail({ accountId: id, language: 'guj' });
    expect(detail.language).toMatchObject({ code: 'guj', region: 'Ahmedabad', open: true });
    expect(detail.sentences.map((row) => row.status).slice(0, 3)).toEqual(['rejected', 'new', 'flagged']);
    expect(detail.sentences[0].reason).toBe('Too quiet or too loud');
    expect(detail.sentences[2].reason).toBe('It has a mistake');
    expect(detail.sentences.every((row, n) => row.text === GUJ[n])).toBe(true);
  });

  test('a day’s takes are capped', async () => {
    const id = await speaker();
    fakePrisma.geoVoiceRecording.count.mockResolvedValueOnce(rec.TAKES_PER_DAY);
    await expect(rec.saveTake({ accountId: id, language: 'guj', n: 0, audio: webm(), mime: 'audio/webm', durationMs: 2000 })).rejects.toMatchObject({ code: 'daily_cap' });
  });
});

describe('review, and into the game', () => {
  test('approve, send back with a reason, undo, dismiss a flag', async () => {
    const id = await speaker();
    const take = await rec.saveTake({ accountId: id, language: 'guj', n: 0, audio: webm(), mime: 'audio/webm', durationMs: 2000 });
    await expect(rec.reviewTake({ id: take.id, decision: 'reject', reason: 'bad' })).rejects.toMatchObject({ code: 'bad_reason' });
    expect(await rec.reviewTake({ id: take.id, decision: 'approve' })).toMatchObject({ status: 'approved' });
    expect(await rec.reviewTake({ id: take.id, decision: 'reopen' })).toMatchObject({ status: 'pending' });
    const flag = await rec.flagSentence({ accountId: id, language: 'guj', n: 1, note: 'Typo' });
    await expect(rec.reviewTake({ id: flag.id, decision: 'approve' })).rejects.toMatchObject({ code: 'bad_decision' });
    await rec.reviewTake({ id: flag.id, decision: 'dismiss' });
    // "It is fine": the sentence is back on the speaker's list.
    expect((await rec.setDetail({ accountId: id, language: 'guj' })).sentences[1].status).toBe('new');
    const queue = await rec.reviewQueue();
    expect(queue.waiting).toBe(1);
    expect(queue.items[0]).toMatchObject({ id: take.id, text: GUJ[0], speaker: { name: 'Name acct1', email: 'acct1@example.test', region: 'Ahmedabad' } });
    expect(queue.flags).toEqual([]);
  });

  test('a person joins the game only with every sentence approved', async () => {
    const id = await speaker();
    for (let n = 0; n < GUJ.length - 1; n++) await rec.saveTake({ accountId: id, language: 'guj', n, audio: webm(`${n}`), mime: 'audio/webm', durationMs: 2000 });
    const set = fakePrisma.geoVoiceSet.rows[0];
    expect(await rec.approveSet({ setId: set.id })).toEqual({ approved: GUJ.length - 1 });
    await expect(rec.addSetAsVoice({ setId: set.id })).rejects.toMatchObject({ code: 'incomplete' });
    await rec.saveTake({ accountId: id, language: 'guj', n: GUJ.length - 1, audio: webm('last'), mime: 'audio/webm', durationMs: 2000 });
    await rec.approveSet({ setId: set.id });
    const voice = await rec.addSetAsVoice({ setId: set.id });
    expect(voice).toMatchObject({ language: 'guj', kind: 'recorded', voiceId: id, name: 'Name acct1', about: 'Recorded, from Ahmedabad', enabled: true });
    expect((await rec.addSetAsVoice({ setId: set.id })).id).toBe(voice.id);
    const sets = await rec.speakerSets();
    expect(sets[0]).toMatchObject({ complete: true, voice: { id: voice.id, enabled: true } });
  });

  test('rounds hear a recorded voice while it is complete, and its takes are what plays', async () => {
    const id = await speaker();
    const set = await fullSet(id);
    const voice = await rec.addSetAsVoice({ setId: set.id });
    await fakePrisma.geoVoiceLanguage.upsert({ where: { language: 'guj' }, create: { language: 'guj', enabled: true }, update: { enabled: true } });
    expect((await enabledVoices()).guj.map((row) => row.id)).toEqual([voice.id]);
    const take = await voiceClip({ kind: 'recorded', language: 'guj', voiceId: id, text: GUJ[3] });
    expect(take.mime).toBe('audio/webm');
    expect(take.audio.toString()).toBe(`webm ${id}-3`);
    const view = await languageVoices('guj');
    expect(view.voices[0]).toMatchObject({ kind: 'recorded', made: GUJ.map(() => true) });

    // One take sent back: the voice sits out until it is read again.
    const one = fakePrisma.geoVoiceRecording.rows.find((row) => row.text === GUJ[2]);
    await rec.reviewTake({ id: one.id, decision: 'reject', reason: 'cut' });
    expect(await enabledVoices()).toEqual({});
    await expect(voiceClip({ kind: 'recorded', language: 'guj', voiceId: id, text: GUJ[2] })).rejects.toMatchObject({ code: 'no_clip' });
  });

  test('deleting recordings takes the voice out of the game; deleting the account deletes everything', async () => {
    const id = await speaker();
    const set = await fullSet(id);
    await rec.addSetAsVoice({ setId: set.id });
    expect(await rec.deleteRecordings({ accountId: id, language: 'guj' })).toEqual({ removed: GUJ.length });
    expect(fakePrisma.geoVoice.rows).toEqual([]);
    expect(fakePrisma.geoVoiceSet.rows).toEqual([]);
    expect(fakePrisma.geoVoiceContributor.rows).toHaveLength(1);
    await rec.deleteRecordings({ accountId: id });
    expect(fakePrisma.geoVoiceContributor.rows).toEqual([]);

    const store = {
      getAccountById: jest.fn(async () => ({ id: 'z', email: 'z@example.test' })),
      getProfileByAccountId: jest.fn(async () => null),
      deleteAccount: jest.fn(async () => {}),
      deleteLoginTokensForEmail: jest.fn(async () => {}),
      deleteVoiceContributions: jest.fn(async () => {}),
    };
    await deleteAccount(store, { accountId: 'z' });
    expect(store.deleteVoiceContributions).toHaveBeenCalledWith('z');
  });
});

describe('the routes', () => {
  test('anyone sees the open languages; everything else needs a session', async () => {
    const open = await (await recordRoute.GET(request())).json();
    expect(open).toMatchObject({ signedIn: false, open: [expect.objectContaining({ code: 'guj' })] });
    expect((await recordRoute.POST(request({ body: { action: 'join', name: 'A', agree: true } }))).status).toBe(401);
    expect((await setRoute.GET(request({ url: 'http://localhost/api/geo/record/set?language=guj' }))).status).toBe(401);
    expect((await takeRoute.POST(request({ url: 'http://localhost/api/geo/record/take?language=guj&n=0&ms=2000', raw: webm(), type: 'audio/webm' }))).status).toBe(401);
  });

  test('a speaker signs up, reads a sentence, and hears it back; nobody else can', async () => {
    fakePrisma.geoAccount.rows.push({ id: 'p1', email: 'p1@example.test', suspendedAt: null }, { id: 'p2', email: 'p2@example.test', suspendedAt: null });
    const cookie = cookieFor('p1');
    const joined = await (await recordRoute.POST(request({ cookie, body: { action: 'join', name: 'Priya', agree: true } }))).json();
    expect(joined).toMatchObject({ ok: true, contributor: { name: 'Priya', agreed: true }, sets: [] });
    await recordRoute.POST(request({ cookie, body: { action: 'start', language: 'guj', region: 'Vadodara' } }));
    const kept = await takeRoute.POST(request({ cookie, url: 'http://localhost/api/geo/record/take?language=guj&n=0&ms=2300', raw: webm('mine'), type: 'audio/ogg;codecs=opus' }));
    expect(kept.status).toBe(200);
    const { id } = await kept.json();
    const detail = await (await setRoute.GET(request({ cookie, url: 'http://localhost/api/geo/record/set?language=guj' }))).json();
    expect(detail.sentences[0]).toMatchObject({ id, status: 'pending' });
    const played = await takeRoute.GET(request({ cookie, url: `http://localhost/api/geo/record/take?id=${id}` }));
    expect(played.headers.get('content-type')).toBe('audio/ogg');
    expect(Buffer.from(await played.arrayBuffer()).toString()).toBe('webm mine');
    expect((await takeRoute.GET(request({ cookie: cookieFor('p2'), url: `http://localhost/api/geo/record/take?id=${id}` }))).status).toBe(404);
    const state = await (await recordRoute.GET(request({ cookie }))).json();
    expect(state).toMatchObject({ signedIn: true, email: 'p1@example.test', sets: [expect.objectContaining({ code: 'guj', region: 'Vadodara' })] });
  });

  test('an oversized upload is refused before it is read', async () => {
    fakePrisma.geoAccount.rows.push({ id: 'p3', email: 'p3@example.test', suspendedAt: null });
    const big = request({ cookie: cookieFor('p3'), url: 'http://localhost/api/geo/record/take?language=guj&n=0&ms=2000', raw: webm(), type: 'audio/webm' });
    const headers = new Map([['cookie', cookieFor('p3')], ['content-length', String(rec.MAX_TAKE_BYTES + 1)], ['content-type', 'audio/webm']]);
    big.headers = { get: (name) => headers.get(name.toLowerCase()) || null };
    expect((await takeRoute.POST(big)).status).toBe(413);

    // Without a length, the read itself stops at the limit.
    let pulled = 0;
    const endless = request({ cookie: cookieFor('p3'), url: 'http://localhost/api/geo/record/take?language=guj&n=0&ms=2000', type: 'audio/webm' });
    endless.body = { getReader: () => ({ read: async () => { pulled += 1; return { done: false, value: new Uint8Array(400000) }; }, cancel: async () => {} }) };
    expect((await takeRoute.POST(endless)).status).toBe(413);
    expect(pulled).toBe(4);
  });

  test('the admin routes refuse anyone who is not an admin', async () => {
    mockRequireAdmin.mockRejectedValue(new AdminDenied('not_admin'));
    expect((await adminRoute.GET(request({ url: 'http://localhost/api/geo/admin/recordings?view=queue' }))).status).toBe(403);
    expect((await adminRoute.POST(request({ body: { action: 'open', language: 'tam', open: true } }))).status).toBe(403);
    expect((await adminAudio.GET(request({ url: 'http://localhost/api/geo/admin/recordings/audio?id=x' }))).status).toBe(403);
    expect(await rec.openLanguages()).toHaveLength(1);
  });

  test('from a reading to a Voices round that plays it', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin' });
    const id = await speaker('reader');
    await fullSet(id);
    const sets = await (await adminRoute.GET(request({ url: 'http://localhost/api/geo/admin/recordings?view=speakers' }))).json();
    expect(sets.sets[0]).toMatchObject({ complete: true, voice: null });
    const added = await (await adminRoute.POST(request({ body: { action: 'addVoice', setId: sets.sets[0].id } }))).json();
    expect(added).toMatchObject({ ok: true, language: 'guj' });
    await fakePrisma.geoVoiceLanguage.upsert({ where: { language: 'guj' }, create: { language: 'guj', enabled: true }, update: { enabled: true } });

    const round = await (await postRound(request({ url: 'http://localhost/api/geo/script/round', body: { config: { rounds: 3, seed: 'heard', voice: true }, roundIndex: 0 } }))).json();
    expect(openToken(round.round.token, { secret: SECRET })).toMatchObject({ c: 'guj', v: added.voiceId });
    const clip = await getClip(request({ url: `http://localhost/api/geo/voice/clip?t=${encodeURIComponent(round.round.token)}&n=0` }));
    expect(clip.status).toBe(200);
    expect(clip.headers.get('content-type')).toBe('audio/webm');
    expect(Buffer.from(await clip.arrayBuffer()).toString()).toMatch(/^webm reader-\d+$/);

    const languages = await (await adminRoute.GET(request({ url: 'http://localhost/api/geo/admin/recordings?view=languages' }))).json();
    expect(languages.languages.find((row) => row.code === 'guj')).toMatchObject({ open: true, speakers: 1, approved: GUJ.length, pending: 0 });
    const audio = await adminAudio.GET(request({ url: `http://localhost/api/geo/admin/recordings/audio?id=${fakePrisma.geoVoiceRecording.rows[0].id}` }));
    expect(audio.status).toBe(200);
  });
});
