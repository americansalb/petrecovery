/**
 * The script game's API surface.
 *
 * Found in the deep audit: only the libraries under app/lib/geo were
 * covered, so the two routes that actually serve Script mode had no
 * test at all. What is pinned here is the same contract the panorama
 * game has: the round never carries the answer, the sealed token is the
 * only way to score it, and a server with no token secret refuses
 * rather than sending the answer in the clear.
 */

const SECRET = 'a-long-enough-test-secret-for-script';
const savedSecret = process.env.GEO_TOKEN_SECRET;
process.env.GEO_TOKEN_SECRET = SECRET;

const { POST: postRound } = require('@/app/api/geo/script/round/route');
const { POST: postGuess } = require('@/app/api/geo/script/guess/route');
const { openToken } = require('@/app/lib/geo/server/tokens');
const { LANGUAGES, SCRIPTS } = require('@/app/lib/geo/languages');

afterAll(() => {
  if (savedSecret === undefined) delete process.env.GEO_TOKEN_SECRET;
  else process.env.GEO_TOKEN_SECRET = savedSecret;
});

const request = (body) => ({ json: async () => body, headers: new Map(), url: 'http://localhost/api/geo/script/x' });
const find = (code) => LANGUAGES.find((l) => l.code === code);

describe('POST /api/geo/script/round', () => {
  test('returns a sentence and a sealed token, and never the answer', async () => {
    const res = await postRound(request({ config: { ladder: 'world', rounds: 5, seed: 'route-1' }, roundIndex: 2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.round.roundIndex).toBe(2);
    expect(body.round.text.length).toBeGreaterThan(8);
    expect(Object.keys(SCRIPTS)).toContain(body.round.script);

    const answer = openToken(body.round.token, { secret: SECRET });
    const language = find(answer.c);
    expect(language).toBeTruthy();
    // Everything but the sentence and the script id: the name, the
    // endonym, the family and the script's human name are all the
    // answer, and none of them may travel before the guess.
    const shown = JSON.stringify({ ...body.round, text: '', script: '' });
    for (const giveaway of [language.name, language.endonym, language.family, SCRIPTS[language.script].name, language.code]) {
      expect(shown).not.toContain(giveaway);
    }
  });

  test('the same seed and index give the same round', async () => {
    const config = { ladder: 'india', rounds: 5, seed: 'route-2' };
    const a = await (await postRound(request({ config, roundIndex: 1 }))).json();
    const b = await (await postRound(request({ config, roundIndex: 1 }))).json();
    expect(b.round.text).toBe(a.round.text);
    expect(openToken(b.round.token, { secret: SECRET }).c).toBe(openToken(a.round.token, { secret: SECRET }).c);
  });

  test('a body that is not JSON is a 400, not a stack trace', async () => {
    const res = await postRound({ json: async () => { throw new Error('nope'); }, headers: new Map() });
    expect(res.status).toBe(400);
  });

  test('no token secret is a 503 that says so, not a round with the answer in it', async () => {
    const saved = { geo: process.env.GEO_TOKEN_SECRET, next: process.env.NEXTAUTH_SECRET };
    delete process.env.GEO_TOKEN_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await postRound(request({ config: { seed: 'route-3' }, roundIndex: 0 }));
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe('no_secret');
    } finally {
      spy.mockRestore();
      process.env.GEO_TOKEN_SECRET = saved.geo;
      if (saved.next !== undefined) process.env.NEXTAUTH_SECRET = saved.next;
    }
  });
});

describe('POST /api/geo/script/guess', () => {
  test('scores a pin against the language and reveals where it is spoken', async () => {
    const round = (await (await postRound(request({ config: { ladder: 'world', rounds: 3, seed: 'route-4' }, roundIndex: 0 }))).json()).round;
    const answer = find(openToken(round.token, { secret: SECRET }).c);
    const region = answer.regions[0];

    const scored = await (await postGuess(request({ token: round.token, guess: { lat: region.lat, lng: region.lng } }))).json();
    expect(scored.result.kind).toBe('script');
    expect(scored.result.score).toBe(5000);
    expect(scored.result.answer.code).toBe(answer.code);
    expect(scored.result.answer.regions.length).toBeGreaterThan(0);

    const far = await (await postGuess(request({ token: round.token, guess: { lat: -40, lng: -70 } }))).json();
    expect(far.result.score).toBeLessThan(scored.result.score);

    const none = await (await postGuess(request({ token: round.token, guess: null }))).json();
    expect(none.result.score).toBe(0);
    expect(none.result.guess).toBeNull();
    expect(none.result.answer.code).toBe(answer.code);
  });

  test('a missing or tampered token is refused', async () => {
    expect((await postGuess(request({ guess: { lat: 0, lng: 0 } }))).status).toBe(400);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const bad = await postGuess(request({ token: 'g1.not-a-real-token', guess: { lat: 0, lng: 0 } }));
    spy.mockRestore();
    expect(bad.status).toBe(400);
  });
});
