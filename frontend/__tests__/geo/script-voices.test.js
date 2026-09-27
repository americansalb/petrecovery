/**
 * Voices (beta): Script rounds read aloud by ElevenLabs v3
 * (server/voice.js, docs/GEO.md "Voices").
 *
 * What matters here is the bill, the answer and the admin's control.
 * Each sentence is paid for once per voice and then played from the
 * database; nothing but corpus text is ever sent; a day's new audio is
 * capped. A Voices round must not carry its text or its script id,
 * because for most languages either one is the answer. And a language
 * can have several voices, picked by weight, each of which the admin can
 * hear, tune, switch off or remove.
 */

const db = { languages: new Map(), voices: new Map(), clips: new Map(), reports: [] };
let seq = 0;
const pick = (row, select) => (select ? Object.fromEntries(Object.keys(select).map((key) => [key, row[key]])) : { ...row });
const fakePrisma = {
  geoVoiceLanguage: {
    findMany: jest.fn(async ({ where, select } = {}) => [...db.languages.values()].filter((row) => !where || row.enabled === where.enabled).map((row) => pick(row, select))),
    findUnique: jest.fn(async ({ where }) => db.languages.get(where.language) || null),
    upsert: jest.fn(async ({ where, create, update }) => {
      const row = db.languages.has(where.language) ? { ...db.languages.get(where.language), ...update } : { ...create };
      db.languages.set(where.language, row);
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }) => {
      let count = 0;
      for (const row of db.languages.values()) {
        if (row.language === where.language && (where.enabled === undefined || row.enabled === where.enabled)) {
          Object.assign(row, data);
          count += 1;
        }
      }
      return { count };
    }),
  },
  geoVoice: {
    findMany: jest.fn(async ({ where = {}, select } = {}) =>
      [...db.voices.values()]
        .filter((voice) => (where.enabled === undefined || voice.enabled === where.enabled) && (where.language === undefined || voice.language === where.language))
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
        .map((voice) => pick(voice, select)),
    ),
    findUnique: jest.fn(async ({ where }) =>
      where.id
        ? db.voices.get(where.id) || null
        : [...db.voices.values()].find((voice) => voice.language === where.language_voiceId.language && voice.voiceId === where.language_voiceId.voiceId) || null,
    ),
    count: jest.fn(async ({ where = {} }) => [...db.voices.values()].filter((voice) => voice.language === where.language && (where.enabled === undefined || voice.enabled === where.enabled)).length),
    create: jest.fn(async ({ data }) => {
      seq += 1;
      const row = { id: `voice${seq}`, enabled: true, weight: 2, delivery: 'natural', createdAt: new Date(1e12 + seq), ...data };
      db.voices.set(row.id, row);
      return row;
    }),
    update: jest.fn(async ({ where, data }) => Object.assign(db.voices.get(where.id), data)),
    delete: jest.fn(async ({ where }) => {
      const row = db.voices.get(where.id);
      db.voices.delete(where.id);
      return row;
    }),
  },
  geoVoiceClip: {
    findUnique: jest.fn(async ({ where }) => db.clips.get(where.key) || null),
    findMany: jest.fn(async ({ where }) => [...db.clips.values()].filter((clip) => where.key.in.includes(clip.key)).map((clip) => ({ key: clip.key }))),
    aggregate: jest.fn(async ({ where }) => ({
      _sum: { chars: [...db.clips.values()].filter((clip) => clip.createdAt >= where.createdAt.gte).reduce((sum, clip) => sum + clip.chars, 0) || null },
    })),
    upsert: jest.fn(async ({ where, create }) => {
      if (!db.clips.has(where.key)) db.clips.set(where.key, { ...create, createdAt: new Date() });
      return db.clips.get(where.key);
    }),
    groupBy: jest.fn(async () => {
      const counts = new Map();
      for (const clip of db.clips.values()) counts.set(clip.language, (counts.get(clip.language) || 0) + 1);
      return [...counts].map(([language, count]) => ({ language, _count: { _all: count } }));
    }),
    deleteMany: jest.fn(async ({ where }) => {
      let count = 0;
      for (const [key, clip] of db.clips) {
        if ((where.key === undefined || clip.key === where.key) && (where.language === undefined || clip.language === where.language) && (where.voiceId === undefined || clip.voiceId === where.voiceId)) {
          db.clips.delete(key);
          count += 1;
        }
      }
      return { count };
    }),
  },
  geoScriptReport: {
    findFirst: jest.fn(async () => null),
    create: jest.fn(async ({ data }) => {
      db.reports.push({ status: 'open', ...data });
      return data;
    }),
    groupBy: jest.fn(async ({ where }) => {
      const counts = new Map();
      for (const row of db.reports.filter((r) => r.language === where.language && r.kind === where.kind && r.status === where.status)) counts.set(row.voice, (counts.get(row.voice) || 0) + 1);
      return [...counts].map(([voice, count]) => ({ voice, _count: { _all: count } }));
    }),
  },
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

const SECRET = 'a-long-enough-test-secret-for-voices';
process.env.GEO_TOKEN_SECRET = SECRET;

const { normalizeScriptConfig, scriptConfigToQuery } = require('@/app/lib/geo/script');
const { createScriptRound, createVoiceRound, evaluateScriptGuess, passageSentences, scriptRoundFromToken, ScriptGameError } = require('@/app/lib/geo/server/scriptGame');
const voice = require('@/app/lib/geo/server/voice');
const { reportFromRound, fileReport } = require('@/app/lib/geo/server/reports');
const { samplesFor } = require('@/app/lib/geo/server/samples');
const { openToken } = require('@/app/lib/geo/server/tokens');
const { SCRIPTS, languageByCode } = require('@/app/lib/geo/languages');
const { GAME_RATE_LIMITS } = require('@/app/lib/geo/site');
const { POST: postRound } = require('@/app/api/geo/script/round/route');
const { GET: getClip } = require('@/app/api/geo/voice/clip/route');
const { GET: getVoices, POST: postVoices } = require('@/app/api/geo/admin/voices/route');
const { GET: getAdminClip, POST: postAdminClip } = require('@/app/api/geo/admin/voices/clip/route');
const { GET: browse } = require('@/app/api/geo/admin/voices/browse/route');
const { AdminDenied } = require('@/app/lib/geo/server/admin');

const env = { GEO_TOKEN_SECRET: SECRET };
const realFetch = global.fetch;
const ADAM = 'pNInz6obpgDQGcFmaJgB';
const GEORGE = 'JBFqnCBsd6RMkjVDRZzb';
const mp3 = (label) => new TextEncoder().encode(`ID3 ${label}`).buffer;
const okAudio = (label = 'audio') => ({ ok: true, status: 200, arrayBuffer: async () => mp3(label) });
const okJson = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const jsonRequest = (body, url = 'http://localhost/api/geo/x') => ({ json: async () => body, headers: new Map(), url });
const getRequest = (url) => ({ headers: new Map(), url });
const text = async (response) => Buffer.from(await response.arrayBuffer()).toString();
const opts = (fetchImpl, extra = {}) => ({ store: fakePrisma, fetchImpl, env: { ELEVENLABS_API_KEY: 'test-key', ...extra } });

/** A language that is on, with the given voices on it. */
async function voiced(language, voices) {
  const rows = [];
  for (const [voiceId, patch = {}] of voices) {
    const row = await voice.addVoice({ language, voiceId, name: voiceId.slice(0, 4) });
    if (Object.keys(patch).length) Object.assign(db.voices.get(row.id), patch);
    rows.push(db.voices.get(row.id));
  }
  await voice.setLanguageEnabled({ language, enabled: true });
  return rows;
}

beforeEach(() => {
  db.languages.clear();
  db.voices.clear();
  db.clips.clear();
  db.reports.length = 0;
  mockRequireAdmin.mockReset();
  delete process.env.ELEVENLABS_API_KEY;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore?.();
  global.fetch = realFetch;
});

describe('the Voices flag and its settings', () => {
  test('rides in the config and the link only when it is on', () => {
    expect(normalizeScriptConfig({ rounds: '5' })).not.toHaveProperty('voice');
    expect(normalizeScriptConfig({ rounds: '5', voice: '0' })).not.toHaveProperty('voice');
    expect(normalizeScriptConfig({ rounds: '5', voice: '1' }).voice).toBe(true);
    const query = scriptConfigToQuery({ rounds: 5, seed: 'abc', voice: true });
    expect(query).toContain('voice=1');
    expect(normalizeScriptConfig(Object.fromEntries(new URLSearchParams(query))).voice).toBe(true);
    expect(scriptConfigToQuery({ rounds: 5, seed: 'abc' })).not.toContain('voice');
  });

  test('every v3 language is one the game has, filed under a library code', () => {
    for (const [code, library] of Object.entries(voice.V3_LANGUAGES)) {
      expect({ code, known: Boolean(languageByCode(code)), library: /^[a-z]{2,3}$/.test(library) }).toEqual({ code, known: true, library: true });
    }
  });

  test('the clip route has a rate limit', () => {
    expect(GAME_RATE_LIMITS['/api/geo/voice/clip']).toBeTruthy();
  });
});

describe('a Voices round', () => {
  const fra = [{ id: 'va', voiceId: ADAM, weight: 2, delivery: 'natural' }];
  const tha = [{ id: 'vb', voiceId: GEORGE, weight: 2, delivery: 'natural' }, { id: 'vc', voiceId: ADAM, weight: 2, delivery: 'robust' }];

  test('is drawn only from the languages with a voice, read by one of that language’s voices', () => {
    const voices = { fra, tha };
    for (let seed = 0; seed < 20; seed++) {
      for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
        const round = createVoiceRound({ config: { rounds: 5, seed: `v${seed}`, voice: true }, roundIndex, env, voices });
        const { c, v } = openToken(round.token, { secret: SECRET });
        expect(['fra', 'tha']).toContain(c);
        expect(voices[c].map((entry) => entry.id)).toContain(v);
      }
    }
  });

  test('picks voices by weight, and the same seed hears the same voice', () => {
    const voices = { deu: [{ id: 'light', voiceId: ADAM, weight: 1 }, { id: 'heavy', voiceId: GEORGE, weight: 4 }] };
    const heard = { light: 0, heavy: 0 };
    for (let seed = 0; seed < 300; seed++) {
      heard[openToken(createVoiceRound({ config: { rounds: 5, seed: `w${seed}`, voice: true }, env, voices }).token, { secret: SECRET }).v] += 1;
    }
    expect(heard.heavy).toBeGreaterThan(heard.light * 2);
    expect(heard.light).toBeGreaterThan(0);
    const again = (seed) => openToken(createVoiceRound({ config: { rounds: 5, seed, voice: true }, roundIndex: 2, env, voices }).token, { secret: SECRET }).v;
    expect(again('replay')).toBe(again('replay'));
  });

  test('carries the token and a clip count, never the text or the script', () => {
    const round = createVoiceRound({ config: { rounds: 5, seed: 'quiet', voice: true }, roundIndex: 1, env, voices: { tha } });
    expect(Object.keys(round).sort()).toEqual(['clips', 'roundIndex', 'token']);
    const { c, i, seed } = openToken(round.token, { secret: SECRET });
    expect(round.clips).toBe(passageSentences(languageByCode(c), seed, i, SECRET).length);
    expect(round.clips).toBeGreaterThanOrEqual(1);
    expect(round.clips).toBeLessThanOrEqual(6);
  });

  test('with no language switched on, it says so', () => {
    expect(() => createVoiceRound({ config: { rounds: 5, seed: 'none', voice: true }, env, voices: {} })).toThrow(ScriptGameError);
    expect(() => createVoiceRound({ config: { rounds: 5, seed: 'none', voice: true }, env, voices: { fra: [] } })).toThrow(/No languages have a voice/);
  });

  test('a Script round still reads the same sentences, joined as before, with no voice', () => {
    for (const [seed, code] of [['join-a', 'fra'], ['join-b', 'cmn']]) {
      const round = createScriptRound({ config: { rounds: 5, seed }, roundIndex: 0, env, pool: [languageByCode(code)] });
      expect(round.text).toBe(passageSentences(languageByCode(code), seed, 0, SECRET).join(code === 'cmn' ? '' : ' '));
      expect(scriptRoundFromToken({ token: round.token, env }).voice).toBeNull();
    }
  });

  test('the guess hands back the text, since the round never sent it', () => {
    const round = createVoiceRound({ config: { rounds: 5, seed: 'reveal', voice: true }, env, voices: { deu: fra } });
    const result = evaluateScriptGuess({ token: round.token, guess: { lat: 52.5, lng: 13.4 }, env });
    expect(result.text).toBe(passageSentences(languageByCode('deu'), 'reveal', 0, SECRET).join(' '));
    expect(result.answer.script).toBe('latn');
    expect(scriptRoundFromToken({ token: round.token, env }).voice).toBe('va');
  });
});

describe('"How it sounds" reports', () => {
  test('name the voice that read the round, and only a heard round can make one', async () => {
    const heard = createVoiceRound({ config: { rounds: 5, seed: 'sound', voice: true }, env, voices: { fra: [{ id: 'vx', voiceId: ADAM, weight: 2 }] } });
    const report = reportFromRound({ token: heard.token, kind: 'voice', note: 'Sounds Canadian', env });
    expect(report).toMatchObject({ language: 'fra', kind: 'voice', voice: 'vx' });
    await fileReport(report, { ipHash: 'ip:1' });
    expect(db.reports[0].voice).toBe('vx');
    const read = createScriptRound({ config: { rounds: 5, seed: 'sound' }, env });
    expect(() => reportFromRound({ token: read.token, kind: 'voice', env })).toThrow(/heard/);
    expect(reportFromRound({ token: read.token, kind: 'area', env }).voice).toBeNull();
  });
});

describe('clipAudio', () => {
  const sentence = { language: 'fra', voiceId: GEORGE, delivery: 'natural', text: 'Il fait beau aujourd’hui.' };

  test('makes a missing clip with v3 in the voice’s delivery, and stores it', async () => {
    const fetchImpl = jest.fn(async () => okAudio('fr'));
    expect(Buffer.from(await voice.clipAudio(sentence, opts(fetchImpl))).toString()).toBe('ID3 fr');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${GEORGE}?output_format=mp3_44100_64`);
    expect(init.method).toBe('POST');
    expect(init.headers['xi-api-key']).toBe('test-key');
    expect(JSON.parse(init.body)).toEqual({ text: sentence.text, model_id: 'eleven_v3', voice_settings: { stability: 0.5 } });
    expect(db.clips.get(voice.clipKey(sentence))).toMatchObject({ language: 'fra', voiceId: GEORGE, model: 'eleven_v3', text: sentence.text, chars: [...sentence.text].length });

    await voice.clipAudio({ ...sentence, delivery: 'creative' }, opts(fetchImpl));
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).voice_settings).toEqual({ stability: 0 });
  });

  test('plays the stored copy after that, without asking again, even with no key', async () => {
    const fetchImpl = jest.fn(async () => okAudio('fr'));
    await voice.clipAudio(sentence, opts(fetchImpl));
    expect(Buffer.from(await voice.clipAudio(sentence, opts(fetchImpl))).toString()).toBe('ID3 fr');
    expect(Buffer.from(await voice.clipAudio(sentence, { store: fakePrisma, fetchImpl, env: {} })).toString()).toBe('ID3 fr');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('two requests for the same new sentence pay for it once', async () => {
    let finish;
    const fetchImpl = jest.fn(() => new Promise((resolve) => { finish = () => resolve(okAudio('once')); }));
    const first = voice.clipAudio(sentence, opts(fetchImpl));
    const second = voice.clipAudio(sentence, opts(fetchImpl));
    await new Promise((resolve) => setImmediate(resolve));
    finish();
    expect((await Promise.all([first, second])).map((audio) => Buffer.from(audio).toString())).toEqual(['ID3 once', 'ID3 once']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('a different voice, delivery or language is a different clip', () => {
    const key = voice.clipKey(sentence);
    expect(voice.clipKey({ ...sentence, voiceId: ADAM })).not.toBe(key);
    expect(voice.clipKey({ ...sentence, delivery: 'robust' })).not.toBe(key);
    expect(voice.clipKey({ ...sentence, language: 'glg' })).not.toBe(key);
  });

  test('a remake throws the stored take away and makes a new one', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(okAudio('first')).mockResolvedValueOnce(okAudio('second'));
    await voice.clipAudio(sentence, opts(fetchImpl));
    expect(Buffer.from(await voice.remakeClip(sentence, opts(fetchImpl))).toString()).toBe('ID3 second');
    expect(Buffer.from(db.clips.get(voice.clipKey(sentence)).audio).toString()).toBe('ID3 second');
  });

  test('without a key it refuses and sends nothing', async () => {
    const fetchImpl = jest.fn();
    await expect(voice.clipAudio(sentence, { store: fakePrisma, fetchImpl, env: {} })).rejects.toMatchObject({ code: 'no_key' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('stops at the day’s cap', async () => {
    const fetchImpl = jest.fn(async () => okAudio());
    await voice.clipAudio(sentence, opts(fetchImpl, { GEO_VOICE_DAILY_CHARACTERS: '40' }));
    await expect(voice.clipAudio({ ...sentence, text: 'Une autre phrase assez longue.' }, opts(fetchImpl, { GEO_VOICE_DAILY_CHARACTERS: '40' }))).rejects.toMatchObject({ code: 'daily_cap' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('an ElevenLabs refusal stores nothing and keeps what it said for the admin', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 401, text: async () => '{"detail":{"status":"invalid_api_key","message":"Invalid API key"}}' }));
    await expect(voice.clipAudio(sentence, opts(fetchImpl))).rejects.toMatchObject({ code: 'upstream', detail: 'Invalid API key' });
    expect(db.clips.size).toBe(0);
    const unreachable = jest.fn(async () => { throw new Error('socket hang up'); });
    await expect(voice.clipAudio(sentence, opts(unreachable))).rejects.toMatchObject({ code: 'upstream' });
  });
});

describe('voices on a language', () => {
  test('a voice id has to look like one, once per language, up to the limit', async () => {
    await expect(voice.addVoice({ language: 'French', voiceId: ADAM })).rejects.toMatchObject({ code: 'bad_language' });
    await expect(voice.addVoice({ language: 'fra', voiceId: 'not an id' })).rejects.toMatchObject({ code: 'bad_voice' });
    const added = await voice.addVoice({ language: 'fra', voiceId: ` ${ADAM} `, name: 'Adam', about: 'american, male', previewUrl: 'javascript:alert(1)' });
    expect(added).toMatchObject({ voiceId: ADAM, name: 'Adam', about: 'american, male', previewUrl: null, enabled: true, weight: 2, delivery: 'natural' });
    await expect(voice.addVoice({ language: 'fra', voiceId: ADAM })).rejects.toMatchObject({ code: 'duplicate' });
    // The same voice can read another language.
    await expect(voice.addVoice({ language: 'deu', voiceId: ADAM })).resolves.toMatchObject({ language: 'deu' });
    for (let i = 1; i < voice.MAX_VOICES_PER_LANGUAGE; i++) await voice.addVoice({ language: 'fra', voiceId: `Voice${String(i).padStart(6, '0')}` });
    await expect(voice.addVoice({ language: 'fra', voiceId: 'OneTooMany01' })).rejects.toMatchObject({ code: 'too_many' });
  });

  test('a language goes on only with a voice that is on, and goes off with its last one', async () => {
    await expect(voice.setLanguageEnabled({ language: 'fra', enabled: true })).rejects.toMatchObject({ code: 'no_voice' });
    const [adam, george] = await voiced('fra', [[ADAM], [GEORGE]]);
    expect(await voice.enabledVoices()).toEqual({ fra: [expect.objectContaining({ id: adam.id }), expect.objectContaining({ id: george.id })] });

    expect((await voice.updateVoice({ id: adam.id, enabled: false })).languageOff).toBe(false);
    expect((await voice.enabledVoices()).fra.map((row) => row.id)).toEqual([george.id]);
    expect((await voice.updateVoice({ id: george.id, enabled: false })).languageOff).toBe(true);
    expect(await voice.enabledVoices()).toEqual({});
  });

  test('weight and delivery take only the values the screen offers', async () => {
    const [adam] = await voiced('fra', [[ADAM]]);
    await expect(voice.updateVoice({ id: adam.id, weight: 3 })).rejects.toMatchObject({ code: 'bad_weight' });
    await expect(voice.updateVoice({ id: adam.id, delivery: 'shouty' })).rejects.toMatchObject({ code: 'bad_delivery' });
    await expect(voice.updateVoice({ id: 'gone', weight: 1 })).rejects.toMatchObject({ code: 'no_voice' });
    expect((await voice.updateVoice({ id: adam.id, weight: 4, delivery: 'robust' })).voice).toMatchObject({ weight: 4, delivery: 'robust' });
  });

  test('removing a voice deletes its clips for that language only', async () => {
    const [adam] = await voiced('fra', [[ADAM]]);
    const fetchImpl = jest.fn(async () => okAudio());
    await voice.clipAudio({ language: 'fra', voiceId: ADAM, text: 'Bonjour a tous.' }, opts(fetchImpl));
    await voice.clipAudio({ language: 'deu', voiceId: ADAM, text: 'Guten Tag allerseits.' }, opts(fetchImpl));
    expect(await voice.removeVoice({ id: adam.id })).toEqual({ languageOff: true });
    expect([...db.clips.values()].map((clip) => clip.language)).toEqual(['deu']);
    expect(db.voices.size).toBe(0);
  });

  test('the language view says which sentences each voice has made, and what players reported', async () => {
    const [adam, george] = await voiced('fra', [[ADAM], [GEORGE, { delivery: 'creative' }]]);
    const sentences = samplesFor('fra');
    const fetchImpl = jest.fn(async () => okAudio());
    await voice.clipAudio({ language: 'fra', voiceId: ADAM, delivery: 'natural', text: sentences[1] }, opts(fetchImpl));
    // Made in another delivery: not this voice's current audio.
    await voice.clipAudio({ language: 'fra', voiceId: GEORGE, delivery: 'natural', text: sentences[0] }, opts(fetchImpl));
    db.reports.push({ language: 'fra', kind: 'voice', status: 'open', voice: george.id }, { language: 'fra', kind: 'voice', status: 'done', voice: george.id });

    const view = await voice.languageVoices('fra');
    expect(view).toMatchObject({ code: 'fra', name: 'French', v3: true, libraryLanguage: 'fr', enabled: true });
    expect(view.sentences).toEqual(sentences);
    const [a, g] = view.voices;
    expect(a).toMatchObject({ id: adam.id, reports: 0 });
    expect(a.made.map((made, n) => (made ? n : -1)).filter((n) => n >= 0)).toEqual([1]);
    expect(g).toMatchObject({ id: george.id, delivery: 'creative', reports: 1 });
    expect(g.made.every((made) => !made)).toBe(true);
  });
});

describe('finding voices on ElevenLabs', () => {
  test('the account’s voices, with the languages they speak', async () => {
    const fetchImpl = jest.fn(async () => okJson({
      voices: [
        { voice_id: ADAM, name: 'Adam', labels: { accent: 'american', gender: 'male', language: 'en' }, preview_url: 'https://storage.googleapis.com/a.mp3' },
        { voice_id: 'bad id!', name: 'Broken' },
        { voice_id: GEORGE, name: 'George', labels: {}, verified_languages: [{ language: 'fr' }, { language: 'de' }], preview_url: 'http://insecure' },
      ],
      has_more: false,
    }));
    const found = await voice.accountVoices({ search: 'a', fetchImpl, env: { ELEVENLABS_API_KEY: 'k' } });
    expect(found).toEqual([
      { voiceId: ADAM, name: 'Adam', about: 'american, male', languages: ['en'], previewUrl: 'https://storage.googleapis.com/a.mp3' },
      { voiceId: GEORGE, name: 'George', about: '', languages: ['fr', 'de'], previewUrl: '' },
    ]);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.elevenlabs.io/v2/voices?page_size=100&search=a');
    await expect(voice.accountVoices({ fetchImpl, env: {} })).rejects.toMatchObject({ code: 'no_key' });
  });

  test('the Voice Library, by language, and saving a library voice to the account', async () => {
    const owner = 'a'.repeat(64);
    const fetchImpl = jest.fn(async () => okJson({
      voices: [
        { voice_id: GEORGE, public_owner_id: owner, name: 'Maya', accent: 'gujarati', gender: 'female', age: 'young', description: 'Warm and clear', language: 'gu', preview_url: 'https://storage.googleapis.com/m.mp3', cloned_by_count: 12 },
        { voice_id: ADAM, public_owner_id: 'x', name: 'No owner' },
        { voice_id: 'KiranVoice0002', public_owner_id: owner, name: 'Kiran', accent: 'ahmedabad', gender: 'male', age: 'middle_aged', language: 'gu' },
      ],
      has_more: true,
    }));
    const found = await voice.libraryVoices({ language: 'gu', search: 'warm', gender: 'female', page: 1, fetchImpl, env: { ELEVENLABS_API_KEY: 'k' } });
    expect(found).toEqual({
      voices: [
        { voiceId: GEORGE, ownerId: owner, name: 'Maya', about: 'gujarati, female, young', description: 'Warm and clear', language: 'gu', previewUrl: 'https://storage.googleapis.com/m.mp3', uses: 12 },
        { voiceId: 'KiranVoice0002', ownerId: owner, name: 'Kiran', about: 'ahmedabad, male, middle aged', description: '', language: 'gu', previewUrl: '', uses: 0 },
      ],
      hasMore: true,
    });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.elevenlabs.io/v1/shared-voices?page_size=24&page=1&language=gu&search=warm&gender=female');

    const save = jest.fn(async () => okJson({ voice_id: GEORGE }));
    expect(await voice.saveLibraryVoice({ ownerId: owner, voiceId: GEORGE, name: 'Maya' }, { fetchImpl: save, env: { ELEVENLABS_API_KEY: 'k' } })).toBe(GEORGE);
    expect(save.mock.calls[0][0]).toBe(`https://api.elevenlabs.io/v1/voices/add/${owner}/${GEORGE}`);
    expect(JSON.parse(save.mock.calls[0][1].body)).toEqual({ new_name: 'Maya' });
    const already = jest.fn(async () => ({ ok: false, status: 400, text: async () => '{"detail":{"status":"voice_already_added","message":"This voice is already in your library"}}' }));
    expect(await voice.saveLibraryVoice({ ownerId: owner, voiceId: GEORGE, name: 'Maya' }, { fetchImpl: already, env: { ELEVENLABS_API_KEY: 'k' } })).toBe(GEORGE);
    await expect(voice.saveLibraryVoice({ ownerId: 'x', voiceId: GEORGE }, { fetchImpl: save, env: { ELEVENLABS_API_KEY: 'k' } })).rejects.toMatchObject({ code: 'bad_voice' });
  });
});

describe('POST /api/geo/script/round with voice', () => {
  test('sends no text, no script and nothing that names the language', async () => {
    const [adam] = await voiced('tha', [[ADAM]]);
    const res = await postRound(jsonRequest({ config: { rounds: 5, seed: 'route-voice', voice: true }, roundIndex: 0 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config.voice).toBe(true);
    expect(body.round).not.toHaveProperty('text');
    expect(body.round).not.toHaveProperty('script');
    const sealed = openToken(body.round.token, { secret: SECRET });
    expect(sealed).toMatchObject({ c: 'tha', v: adam.id });
    const language = languageByCode('tha');
    const shown = JSON.stringify(body);
    for (const giveaway of [language.name, language.endonym, SCRIPTS[language.script].name, `"${language.code}"`, ADAM]) expect(shown).not.toContain(giveaway);
  });

  test('with nothing switched on it is a plain 400', async () => {
    await voice.addVoice({ language: 'fra', voiceId: ADAM });
    const res = await postRound(jsonRequest({ config: { rounds: 5, seed: 'route-empty', voice: true } }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('empty_pool');
  });
});

describe('GET /api/geo/voice/clip', () => {
  const clipUrl = (token, n) => `http://localhost/api/geo/voice/clip?t=${encodeURIComponent(token)}&n=${n}`;
  const dealt = async (seed = 'clip-seed') => {
    const voices = await voice.enabledVoices();
    return createVoiceRound({ config: { rounds: 5, seed, voice: true }, env, voices });
  };

  test('plays each sentence of the round in the voice it was dealt, made once', async () => {
    await voiced('fra', [[ADAM, { delivery: 'robust' }]]);
    process.env.ELEVENLABS_API_KEY = 'test-key';
    global.fetch = jest.fn(async () => okAudio('clip'));
    const round = await dealt();
    for (let n = 0; n < round.clips; n++) {
      const res = await getClip(getRequest(clipUrl(round.token, n)));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('audio/mpeg');
      expect(await text(res)).toBe('ID3 clip');
    }
    const { seed, i } = openToken(round.token, { secret: SECRET });
    expect(global.fetch.mock.calls.map(([, init]) => JSON.parse(init.body).text)).toEqual(passageSentences(languageByCode('fra'), seed, i, SECRET));
    expect(global.fetch.mock.calls.every(([url, init]) => url.includes(ADAM) && JSON.parse(init.body).voice_settings.stability === 1)).toBe(true);
    await getClip(getRequest(clipUrl(round.token, 0)));
    expect(global.fetch).toHaveBeenCalledTimes(round.clips);
  });

  test('refuses what is not a sentence of a dealt round', async () => {
    await voiced('fra', [[ADAM]]);
    const round = await dealt();
    expect((await getClip(getRequest(clipUrl(round.token, round.clips)))).status).toBe(404);
    expect((await getClip(getRequest(clipUrl(round.token, -1)))).status).toBe(404);
    expect((await getClip(getRequest(clipUrl('g1.forged', 0)))).status).toBe(400);
    // A Script round's token has no voice to read it with.
    const read = createScriptRound({ config: { rounds: 5, seed: 'read' }, env, pool: [languageByCode('fra')] });
    expect((await (await getClip(getRequest(clipUrl(read.token, 0)))).json()).code).toBe('no_voice');
  });

  test('a voice switched off stops at once, and a missing key is a 503', async () => {
    const [adam] = await voiced('fra', [[ADAM], [GEORGE]]);
    const voices = { fra: [db.voices.get(adam.id)] };
    const round = createVoiceRound({ config: { rounds: 5, seed: 'off', voice: true }, env, voices });
    const keyless = await getClip(getRequest(clipUrl(round.token, 0)));
    expect(keyless.status).toBe(503);
    expect((await keyless.json()).code).toBe('no_key');
    await voice.updateVoice({ id: adam.id, enabled: false });
    const off = await getClip(getRequest(clipUrl(round.token, 0)));
    expect(off.status).toBe(404);
    expect((await off.json()).code).toBe('no_voice');
  });
});

describe('the admin routes', () => {
  test('refuse anyone who is not an admin, and change nothing', async () => {
    mockRequireAdmin.mockRejectedValue(new AdminDenied('not_admin'));
    expect((await getVoices(getRequest('http://localhost/api/geo/admin/voices'))).status).toBe(403);
    expect((await postVoices(jsonRequest({ action: 'add', language: 'fra', voiceId: ADAM }))).status).toBe(403);
    expect((await getAdminClip(getRequest('http://localhost/api/geo/admin/voices/clip?voice=x&n=0'))).status).toBe(403);
    expect((await postAdminClip(jsonRequest({ voice: 'x', n: 0 }))).status).toBe(403);
    expect((await browse(getRequest('http://localhost/api/geo/admin/voices/browse?source=library'))).status).toBe(403);
    expect(db.voices.size).toBe(0);
  });

  test('add voices, tune them, switch the language on, hear a sentence, remove one', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin' });
    const overview = await (await getVoices(getRequest('http://localhost/api/geo/admin/voices'))).json();
    expect(overview).toMatchObject({ keySet: false, cap: 20000, usedToday: 0 });
    expect(overview.languages.find((row) => row.code === 'fra')).toMatchObject({ v3: true, enabled: false, voices: 0, voicesOn: 0, clips: 0 });

    expect((await postVoices(jsonRequest({ action: 'language', language: 'fra', enabled: true }))).status).toBe(400);
    expect((await postVoices(jsonRequest({ action: 'add', language: 'fra', voiceId: 'nope nope' }))).status).toBe(400);
    const first = await (await postVoices(jsonRequest({ action: 'add', language: 'fra', voiceId: ADAM, name: 'Adam' }))).json();
    const second = await (await postVoices(jsonRequest({ action: 'add', language: 'fra', voiceId: GEORGE, name: 'George' }))).json();
    expect((await postVoices(jsonRequest({ action: 'update', id: second.id, weight: 4, delivery: 'creative' }))).status).toBe(200);
    expect(await (await postVoices(jsonRequest({ action: 'language', language: 'fra', enabled: true }))).json()).toEqual({ ok: true, enabled: true });
    expect((await postVoices(jsonRequest({ action: 'dance' }))).status).toBe(400);

    process.env.ELEVENLABS_API_KEY = 'test-key';
    global.fetch = jest.fn(async () => okAudio('admin'));
    const played = await getAdminClip(getRequest(`http://localhost/api/geo/admin/voices/clip?voice=${first.id}&n=0`));
    expect(played.status).toBe(200);
    expect(await text(played)).toBe('ID3 admin');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).text).toBe(samplesFor('fra')[0]);
    expect((await getAdminClip(getRequest(`http://localhost/api/geo/admin/voices/clip?voice=${first.id}&n=9999`))).status).toBe(404);
    expect((await postAdminClip(jsonRequest({ voice: first.id, n: 0, remake: true }))).status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const detail = await (await getVoices(getRequest('http://localhost/api/geo/admin/voices?language=fra'))).json();
    expect(detail.language.voices.map((row) => [row.name, row.weight, row.delivery, row.made[0]])).toEqual([
      ['Adam', 2, 'natural', true],
      ['George', 4, 'creative', false],
    ]);
    expect((await getVoices(getRequest('http://localhost/api/geo/admin/voices?language=zzz'))).status).toBe(400);

    const removed = await (await postVoices(jsonRequest({ action: 'remove', id: first.id }))).json();
    expect(removed).toEqual({ ok: true, languageOff: false });
    expect((await voice.enabledVoices()).fra.map((row) => row.voiceId)).toEqual([GEORGE]);
  });

  test('a library voice is saved to the account before it is added', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin' });
    process.env.ELEVENLABS_API_KEY = 'test-key';
    const owner = 'b'.repeat(64);
    global.fetch = jest.fn(async () => okJson({ voice_id: GEORGE }));
    const res = await postVoices(jsonRequest({ action: 'add', language: 'guj', voiceId: GEORGE, ownerId: owner, name: 'Maya', about: 'gujarati, female', previewUrl: 'https://storage.googleapis.com/m.mp3' }));
    expect(res.status).toBe(200);
    expect(global.fetch.mock.calls[0][0]).toBe(`https://api.elevenlabs.io/v1/voices/add/${owner}/${GEORGE}`);
    expect([...db.voices.values()][0]).toMatchObject({ language: 'guj', voiceId: GEORGE, name: 'Maya', previewUrl: 'https://storage.googleapis.com/m.mp3' });
  });

  test('browsing passes the filters through and says why when ElevenLabs is not connected', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin' });
    const keyless = await browse(getRequest('http://localhost/api/geo/admin/voices/browse?source=library&language=fr'));
    expect(keyless.status).toBe(503);
    expect((await keyless.json()).error).toMatch(/ELEVENLABS_API_KEY/);
    process.env.ELEVENLABS_API_KEY = 'test-key';
    global.fetch = jest.fn(async () => okJson({ voices: [], has_more: false }));
    const found = await browse(getRequest('http://localhost/api/geo/admin/voices/browse?source=library&language=fr&gender=male&search=paris'));
    expect(await found.json()).toEqual({ voices: [], hasMore: false });
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.elevenlabs.io/v1/shared-voices?page_size=24&page=0&language=fr&search=paris&gender=male');
    global.fetch = jest.fn(async () => ({ ok: false, status: 401, text: async () => '{"detail":{"message":"Missing permission voices_read"}}' }));
    const refused = await browse(getRequest('http://localhost/api/geo/admin/voices/browse?source=account'));
    expect(refused.status).toBe(502);
    expect((await refused.json()).error).toMatch(/Missing permission voices_read/);
  });
});
