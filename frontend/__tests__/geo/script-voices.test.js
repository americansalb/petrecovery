/**
 * Voices (beta): Script rounds read aloud by ElevenLabs v3
 * (server/voice.js, docs/GEO.md "Voices").
 *
 * What matters here is the bill and the answer. Each sentence is paid
 * for once and then played from the database; nothing but corpus text is
 * ever sent; a day's new audio is capped. And a Voices round must not
 * carry its text or its script id, because for most languages either one
 * is the answer.
 */

const languages = new Map();
const clips = new Map();
const fakePrisma = {
  geoVoiceLanguage: {
    findMany: jest.fn(async ({ where } = {}) => [...languages.values()].filter((row) => !where || row.enabled === where.enabled)),
    upsert: jest.fn(async ({ where, create, update }) => {
      const row = languages.has(where.language) ? { ...languages.get(where.language), ...update } : { ...create };
      languages.set(where.language, row);
      return row;
    }),
  },
  geoVoiceClip: {
    findUnique: jest.fn(async ({ where }) => clips.get(where.key) || null),
    aggregate: jest.fn(async ({ where }) => ({
      _sum: { chars: [...clips.values()].filter((clip) => clip.createdAt >= where.createdAt.gte).reduce((sum, clip) => sum + clip.chars, 0) || null },
    })),
    upsert: jest.fn(async ({ where, create }) => {
      if (!clips.has(where.key)) clips.set(where.key, { ...create, createdAt: new Date() });
      return clips.get(where.key);
    }),
    groupBy: jest.fn(async () => {
      const counts = new Map();
      for (const clip of clips.values()) counts.set(clip.language, (counts.get(clip.language) || 0) + 1);
      return [...counts].map(([language, count]) => ({ language, _count: { _all: count } }));
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
const { createScriptRound, createVoiceRound, evaluateScriptGuess, passageSentences, ScriptGameError } = require('@/app/lib/geo/server/scriptGame');
const { accountVoices, clipAudio, clipKey, enabledVoices, saveVoiceSetting, V3_LANGUAGES, VoiceError } = require('@/app/lib/geo/server/voice');
const { openToken } = require('@/app/lib/geo/server/tokens');
const { LANGUAGES, SCRIPTS, languageByCode } = require('@/app/lib/geo/languages');
const { GAME_RATE_LIMITS } = require('@/app/lib/geo/site');
const { POST: postRound } = require('@/app/api/geo/script/round/route');
const { GET: getClip } = require('@/app/api/geo/voice/clip/route');
const { GET: getVoices, POST: postVoice } = require('@/app/api/geo/admin/voices/route');
const { GET: getSample } = require('@/app/api/geo/admin/voices/sample/route');
const { AdminDenied } = require('@/app/lib/geo/server/admin');

const env = { GEO_TOKEN_SECRET: SECRET };
const realFetch = global.fetch;
const VOICE = 'JBFqnCBsd6RMkjVDRZzb';
const mp3 = (label) => new TextEncoder().encode(`ID3 ${label}`).buffer;
const okAudio = (label = 'audio') => ({ ok: true, status: 200, arrayBuffer: async () => mp3(label) });
const jsonRequest = (body, url = 'http://localhost/api/geo/x') => ({ json: async () => body, headers: new Map(), url });
const getRequest = (url) => ({ headers: new Map(), url });

beforeEach(() => {
  languages.clear();
  clips.clear();
  mockRequireAdmin.mockReset();
  delete process.env.ELEVENLABS_API_KEY;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore?.();
  global.fetch = realFetch;
});

describe('the Voices flag', () => {
  test('rides in the config and the link only when it is on', () => {
    expect(normalizeScriptConfig({ rounds: '5' })).not.toHaveProperty('voice');
    expect(normalizeScriptConfig({ rounds: '5', voice: '0' })).not.toHaveProperty('voice');
    expect(normalizeScriptConfig({ rounds: '5', voice: '1' }).voice).toBe(true);
    const query = scriptConfigToQuery({ rounds: 5, seed: 'abc', voice: true });
    expect(query).toContain('voice=1');
    expect(normalizeScriptConfig(Object.fromEntries(new URLSearchParams(query))).voice).toBe(true);
    expect(scriptConfigToQuery({ rounds: 5, seed: 'abc' })).not.toContain('voice');
  });

  test('every v3 language named is one the game has', () => {
    for (const code of V3_LANGUAGES) expect({ code, known: Boolean(languageByCode(code)) }).toEqual({ code, known: true });
  });

  test('the clip route has a rate limit', () => {
    expect(GAME_RATE_LIMITS['/api/geo/voice/clip']).toBeTruthy();
  });
});

describe('a Voices round', () => {
  test('is drawn only from the languages with a voice switched on', () => {
    const voiced = ['fra', 'tha', 'swh'];
    for (let seed = 0; seed < 20; seed++) {
      for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
        const round = createVoiceRound({ config: { rounds: 5, seed: `v${seed}`, voice: true }, roundIndex, env, voiced });
        expect(voiced).toContain(openToken(round.token, { secret: SECRET }).c);
      }
    }
  });

  test('carries the token and a clip count, never the text or the script', () => {
    const round = createVoiceRound({ config: { rounds: 5, seed: 'quiet', voice: true }, roundIndex: 1, env, voiced: ['tha', 'kor'] });
    expect(Object.keys(round).sort()).toEqual(['clips', 'roundIndex', 'token']);
    const { c, i, seed } = openToken(round.token, { secret: SECRET });
    expect(round.clips).toBe(passageSentences(languageByCode(c), seed, i, SECRET).length);
    expect(round.clips).toBeGreaterThanOrEqual(1);
    expect(round.clips).toBeLessThanOrEqual(6);
  });

  test('with no language switched on, it says so', () => {
    expect(() => createVoiceRound({ config: { rounds: 5, seed: 'none', voice: true }, env, voiced: [] })).toThrow(ScriptGameError);
    expect(() => createVoiceRound({ config: { rounds: 5, seed: 'none', voice: true }, env, voiced: [] })).toThrow(/No languages have a voice/);
  });

  test('a Script round still reads the same sentences, joined as before', () => {
    for (const [seed, code] of [['join-a', 'fra'], ['join-b', 'cmn']]) {
      const round = createScriptRound({ config: { rounds: 5, seed }, roundIndex: 0, env, pool: [languageByCode(code)] });
      const sentences = passageSentences(languageByCode(code), seed, 0, SECRET);
      expect(round.text).toBe(sentences.join(code === 'cmn' ? '' : ' '));
    }
  });

  test('the guess hands back the text, since the round never sent it', () => {
    const round = createVoiceRound({ config: { rounds: 5, seed: 'reveal', voice: true }, env, voiced: ['deu'] });
    const result = evaluateScriptGuess({ token: round.token, guess: { lat: 52.5, lng: 13.4 }, env });
    expect(result.text).toBe(passageSentences(languageByCode('deu'), 'reveal', 0, SECRET).join(' '));
    expect(result.answer.script).toBe('latn');
  });
});

describe('clipAudio', () => {
  const sentence = { language: 'fra', voiceId: VOICE, text: 'Il fait beau aujourd’hui.' };
  const options = (fetchImpl, extra = {}) => ({ store: fakePrisma, fetchImpl, env: { ELEVENLABS_API_KEY: 'test-key', ...extra } });

  test('makes a missing clip with v3 and stores it', async () => {
    const fetchImpl = jest.fn(async () => okAudio('fr'));
    const audio = await clipAudio(sentence, options(fetchImpl));
    expect(Buffer.from(audio).toString()).toBe('ID3 fr');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`);
    expect(init.method).toBe('POST');
    expect(init.headers['xi-api-key']).toBe('test-key');
    expect(JSON.parse(init.body)).toEqual({ text: sentence.text, model_id: 'eleven_v3' });
    const stored = clips.get(clipKey(sentence));
    expect(stored).toMatchObject({ language: 'fra', voiceId: VOICE, model: 'eleven_v3', text: sentence.text, chars: [...sentence.text].length });
  });

  test('plays the stored copy after that, without asking again', async () => {
    const fetchImpl = jest.fn(async () => okAudio('fr'));
    await clipAudio(sentence, options(fetchImpl));
    const again = await clipAudio(sentence, options(fetchImpl));
    expect(Buffer.from(again).toString()).toBe('ID3 fr');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Even with no key: stored audio does not need ElevenLabs.
    expect(Buffer.from(await clipAudio(sentence, { store: fakePrisma, fetchImpl, env: {} })).toString()).toBe('ID3 fr');
  });

  test('two requests for the same new sentence pay for it once', async () => {
    let finish;
    const fetchImpl = jest.fn(() => new Promise((resolve) => { finish = () => resolve(okAudio('once')); }));
    const first = clipAudio(sentence, options(fetchImpl));
    const second = clipAudio(sentence, options(fetchImpl));
    await new Promise((resolve) => setImmediate(resolve));
    finish();
    const [a, b] = await Promise.all([first, second]);
    expect(Buffer.from(a).toString()).toBe('ID3 once');
    expect(Buffer.from(b).toString()).toBe('ID3 once');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('a different voice is a different clip', () => {
    expect(clipKey(sentence)).not.toBe(clipKey({ ...sentence, voiceId: 'EXAVITQu4vr4xnSDxMaL' }));
  });

  test('without a key it refuses and sends nothing', async () => {
    const fetchImpl = jest.fn();
    await expect(clipAudio(sentence, { store: fakePrisma, fetchImpl, env: {} })).rejects.toMatchObject({ code: 'no_key' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('stops at the day’s cap', async () => {
    const fetchImpl = jest.fn(async () => okAudio());
    await clipAudio(sentence, options(fetchImpl, { GEO_VOICE_DAILY_CHARACTERS: '40' }));
    await expect(clipAudio({ ...sentence, text: 'Une autre phrase assez longue.' }, options(fetchImpl, { GEO_VOICE_DAILY_CHARACTERS: '40' }))).rejects.toMatchObject({ code: 'daily_cap' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('an ElevenLabs refusal stores nothing', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 401, text: async () => '{"detail":"invalid_api_key"}' }));
    await expect(clipAudio(sentence, options(fetchImpl))).rejects.toMatchObject({ code: 'upstream' });
    expect(clips.size).toBe(0);
    const unreachable = jest.fn(async () => { throw new Error('socket hang up'); });
    await expect(clipAudio(sentence, options(unreachable))).rejects.toBeInstanceOf(VoiceError);
  });
});

describe('voice settings', () => {
  test('need a real language, a voice id that looks like one, and a voice before switching on', async () => {
    await expect(saveVoiceSetting({ language: 'French', voiceId: VOICE, enabled: true })).rejects.toMatchObject({ code: 'bad_language' });
    await expect(saveVoiceSetting({ language: 'fra', voiceId: 'x y', enabled: false })).rejects.toMatchObject({ code: 'bad_voice' });
    await expect(saveVoiceSetting({ language: 'fra', voiceId: '', enabled: true })).rejects.toMatchObject({ code: 'no_voice' });
    await saveVoiceSetting({ language: 'fra', voiceId: ` ${VOICE} `, enabled: true });
    await saveVoiceSetting({ language: 'deu', voiceId: VOICE, enabled: false });
    expect(await enabledVoices()).toEqual({ fra: VOICE });
  });

  test('the account’s voices are listed for the picker, and a failure is an empty list', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ voices: [
        { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', labels: { accent: 'american', gender: 'male' } },
        { voice_id: 'bad id!', name: 'Broken' },
        { voice_id: VOICE, name: 'George', labels: {} },
      ] }),
    }));
    expect(await accountVoices({ fetchImpl, env: { ELEVENLABS_API_KEY: 'k' } })).toEqual([
      { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', about: 'american, male' },
      { id: VOICE, name: 'George', about: '' },
    ]);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.elevenlabs.io/v1/voices');
    expect(await accountVoices({ fetchImpl, env: {} })).toEqual([]);
    expect(await accountVoices({ fetchImpl: async () => ({ ok: false }), env: { ELEVENLABS_API_KEY: 'k' } })).toEqual([]);
    expect(await accountVoices({ fetchImpl: async () => { throw new Error('offline'); }, env: { ELEVENLABS_API_KEY: 'k' } })).toEqual([]);
  });
});

describe('POST /api/geo/script/round with voice', () => {
  test('sends no text, no script and nothing that names the language', async () => {
    languages.set('tha', { language: 'tha', voiceId: VOICE, enabled: true });
    const res = await postRound(jsonRequest({ config: { rounds: 5, seed: 'route-voice', voice: true }, roundIndex: 0 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config.voice).toBe(true);
    expect(body.round).not.toHaveProperty('text');
    expect(body.round).not.toHaveProperty('script');
    const language = languageByCode(openToken(body.round.token, { secret: SECRET }).c);
    expect(language.code).toBe('tha');
    const shown = JSON.stringify(body);
    for (const giveaway of [language.name, language.endonym, SCRIPTS[language.script].name, `"${language.code}"`]) expect(shown).not.toContain(giveaway);
  });

  test('with nothing switched on it is a plain 400', async () => {
    const res = await postRound(jsonRequest({ config: { rounds: 5, seed: 'route-empty', voice: true } }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('empty_pool');
  });
});

describe('GET /api/geo/voice/clip', () => {
  const voiceRound = (seed = 'clip-seed') => createVoiceRound({ config: { rounds: 5, seed, voice: true }, env, voiced: ['fra'] });
  const clipUrl = (token, n) => `http://localhost/api/geo/voice/clip?t=${encodeURIComponent(token)}&n=${n}`;

  test('plays each sentence of the round, made once', async () => {
    languages.set('fra', { language: 'fra', voiceId: VOICE, enabled: true });
    process.env.ELEVENLABS_API_KEY = 'test-key';
    global.fetch = jest.fn(async () => okAudio('clip'));
    const round = voiceRound();
    for (let n = 0; n < round.clips; n++) {
      const res = await getClip(getRequest(clipUrl(round.token, n)));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('audio/mpeg');
      expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('ID3 clip');
    }
    const sent = global.fetch.mock.calls.map(([, init]) => JSON.parse(init.body).text);
    const { seed, i } = openToken(round.token, { secret: SECRET });
    expect(sent).toEqual(passageSentences(languageByCode('fra'), seed, i, SECRET));
    await getClip(getRequest(clipUrl(round.token, 0)));
    expect(global.fetch).toHaveBeenCalledTimes(round.clips);
  });

  test('refuses what is not a sentence of a dealt round', async () => {
    languages.set('fra', { language: 'fra', voiceId: VOICE, enabled: true });
    const round = voiceRound();
    expect((await getClip(getRequest(clipUrl(round.token, round.clips)))).status).toBe(404);
    expect((await getClip(getRequest(clipUrl(round.token, -1)))).status).toBe(404);
    expect((await getClip(getRequest(clipUrl('g1.forged', 0)))).status).toBe(400);
  });

  test('a language switched off plays nothing, and a missing key is a 503', async () => {
    const round = voiceRound();
    const off = await getClip(getRequest(clipUrl(round.token, 0)));
    expect(off.status).toBe(404);
    expect((await off.json()).code).toBe('no_voice');
    languages.set('fra', { language: 'fra', voiceId: VOICE, enabled: true });
    const keyless = await getClip(getRequest(clipUrl(round.token, 0)));
    expect(keyless.status).toBe(503);
    expect((await keyless.json()).code).toBe('no_key');
  });
});

describe('the admin routes', () => {
  test('refuse anyone who is not an admin', async () => {
    mockRequireAdmin.mockRejectedValue(new AdminDenied('not_admin'));
    expect((await getVoices(getRequest('http://localhost/api/geo/admin/voices'))).status).toBe(403);
    expect((await postVoice(jsonRequest({ language: 'fra', voiceId: VOICE, enabled: true }))).status).toBe(403);
    expect((await getSample(getRequest(`http://localhost/api/geo/admin/voices/sample?language=fra&voiceId=${VOICE}`))).status).toBe(403);
    expect(languages.size).toBe(0);
  });

  test('list every language, save a voice, and play a sample', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin' });
    const listed = await (await getVoices(getRequest('http://localhost/api/geo/admin/voices'))).json();
    expect(listed.keySet).toBe(false);
    expect(listed.voices).toEqual([]);
    expect(listed.languages).toHaveLength(LANGUAGES.length);
    expect(listed.languages.find((row) => row.code === 'fra')).toMatchObject({ v3: true, voiceId: '', enabled: false, clips: 0 });

    expect((await postVoice(jsonRequest({ language: 'fra', voiceId: 'nope nope', enabled: true }))).status).toBe(400);
    const saved = await postVoice(jsonRequest({ language: 'fra', voiceId: VOICE, enabled: true }));
    expect(await saved.json()).toEqual({ ok: true, voiceId: VOICE, enabled: true });

    process.env.ELEVENLABS_API_KEY = 'test-key';
    global.fetch = jest.fn(async (url) => (String(url).endsWith('/voices') ? { ok: true, json: async () => ({ voices: [] }) } : okAudio('sample')));
    expect((await getSample(getRequest('http://localhost/api/geo/admin/voices/sample?language=fra&voiceId=bad'))).status).toBe(400);
    const sample = await getSample(getRequest(`http://localhost/api/geo/admin/voices/sample?language=fra&voiceId=${VOICE}`));
    expect(sample.status).toBe(200);
    expect(Buffer.from(await sample.arrayBuffer()).toString()).toBe('ID3 sample');

    const after = await (await getVoices(getRequest('http://localhost/api/geo/admin/voices'))).json();
    expect(after.keySet).toBe(true);
    expect(after.languages.find((row) => row.code === 'fra')).toMatchObject({ voiceId: VOICE, enabled: true, clips: 1 });
  });
});
