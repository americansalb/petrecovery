/**
 * The Not Earth round (app/lib/geo/notEarth.js).
 *
 * About one casual round in two hundred is a real NASA panorama shot on
 * Mars or the Moon, and every round carries a button to call it. What is
 * pinned here:
 *
 *   - the pictures exist, on disk, with the shape the viewer assumes
 *   - a rated board never serves one, because two players on the "same"
 *     five places would not have been asked the same question
 *   - the round hands the browser the picture and nothing else: the
 *     title, the mission and the credit are the answer
 *   - calling it right pays full marks and the badge for that world;
 *     calling it on an ordinary round throws that round away, which is
 *     the cost that makes the button a decision
 */

const fs = require('fs');
const path = require('path');

const {
  BODIES,
  NOT_EARTH_CHANCE,
  NOT_EARTH_MODES,
  NOT_EARTH_PLACES,
  bodyByCode,
  notEarthAllowed,
  notEarthFor,
  notEarthPlace,
  playablePlace,
  revealPlace,
} = require('@/app/lib/geo/notEarth');
const { createRound, evaluateGuess } = require('@/app/lib/geo/server/game');
const { openToken } = require('@/app/lib/geo/server/tokens');
const { MODE_ORDER } = require('@/app/lib/geo/modes');
const { getCountries } = require('@/app/lib/geo/server/countries');
const { MAX_ROUND_SCORE } = require('@/app/lib/geo/distance');

const ENV = { NEXTAUTH_SECRET: 'jest-secret-long-enough' };
const PUBLIC = path.join(__dirname, '..', '..', 'public');

// Seeds whose first draw for round 0 falls under the chance, found by
// running the generator rather than assumed. The test below checks that
// they still do, so a change to the draw fails loudly here instead of
// quietly turning the feature off.
const HIT_SEED = 'ne757';
const HIT_SEED_2 = 'ne719';
const MISS_SEED = 'earth1';

const casual = (extra = {}) => ({ provider: 'apple', mode: 'balanced', rounds: 5, ...extra });

describe('the panoramas', () => {
  test('every one is a file we ship, at the size the viewer is told', () => {
    expect(NOT_EARTH_PLACES.length).toBeGreaterThanOrEqual(8);
    for (const place of NOT_EARTH_PLACES) {
      expect(place.src).toMatch(/^\/geo\/scenery\/\d\d\.jpg$/);
      const file = path.join(PUBLIC, place.src.replace(/^\//, ''));
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(20000);
      // Wider than tall, because the viewer fills the height and drags
      // sideways: a portrait picture would be scaled past recognition.
      expect(place.width).toBeGreaterThan(place.height * 2);
      expect(place.height).toBeGreaterThan(200);
      // Where the round opens, as a fraction across the panorama.
      expect(place.start).toBeGreaterThanOrEqual(0);
      expect(place.start).toBeLessThanOrEqual(1);
    }
  });

  test('each one names a real world, a real mission and a credit', () => {
    for (const place of NOT_EARTH_PLACES) {
      expect(BODIES[place.body]).toBeTruthy();
      expect(place.mission.length).toBeGreaterThan(3);
      expect(place.taken.length).toBeGreaterThan(3);
      expect(place.note.length).toBeGreaterThan(30);
      expect(place.credit).toMatch(/NASA/);
      expect(place.nasaId.length).toBeGreaterThan(5);
    }
  });

  test('ids are unique, and both worlds are represented', () => {
    const ids = NOT_EARTH_PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const bodies = new Set(NOT_EARTH_PLACES.map((p) => p.body));
    expect(bodies).toEqual(new Set(['mars', 'moon']));
  });

  test('the badge codes are in the user-assigned ISO range and clash with no country', () => {
    // A Mars badge is a GeoBadge row like any other, so its code has to
    // be one no country will ever be given. XA to XZ is set aside for
    // exactly this, and it is what lets a Not Earth badge live in the
    // table the pet site's database already has.
    const codes = Object.values(BODIES).map((b) => b.code);
    for (const code of codes) expect(code).toMatch(/^X[A-Z]$/);
    const taken = new Set(getCountries().map((c) => c.cca2));
    for (const code of codes) expect(taken.has(code)).toBe(false);
    expect(bodyByCode('XM')).toEqual(BODIES.mars);
    expect(bodyByCode('xl')).toEqual(BODIES.moon);
    expect(bodyByCode('FR')).toBeNull();
  });
});

describe('when one comes up', () => {
  test('about one round in two hundred', () => {
    expect(NOT_EARTH_CHANCE).toBeCloseTo(0.005, 6);
    let hits = 0;
    const total = 40000;
    for (let i = 0; i < total; i++) {
      if (notEarthFor({ config: casual({ seed: `run-${i}` }), roundIndex: 0 })) hits++;
    }
    // Sampling noise on 40,000 draws at p=0.005 is about 14 either way.
    expect(hits / total).toBeGreaterThan(0.002);
    expect(hits / total).toBeLessThan(0.009);
  });

  test('never on a rated board', () => {
    // Ranked, the daily and the cup are one set of places shared by
    // everyone playing them. A surprise that lands for one player and
    // not the next is not a shared set.
    expect(NOT_EARTH_MODES).toEqual(['balanced', 'streak']);
    for (const mode of ['ranked', 'daily', 'cup']) {
      expect(notEarthAllowed({ mode })).toBe(false);
      // Even on a seed that would otherwise hit.
      expect(notEarthFor({ config: { mode, seed: HIT_SEED }, roundIndex: 0 })).toBeNull();
    }
    // And every mode the game has is one or the other, on purpose.
    for (const mode of MODE_ORDER) expect(typeof notEarthAllowed({ mode })).toBe('boolean');
    expect(MODE_ORDER.filter((m) => notEarthAllowed({ m: m, mode: m }))).toEqual(NOT_EARTH_MODES);
  });

  test('a seed draws the same place every time, so a shared link surprises everyone alike', () => {
    const first = notEarthFor({ config: casual({ seed: HIT_SEED }), roundIndex: 0 });
    expect(first).toBeTruthy();
    expect(notEarthFor({ config: casual({ seed: HIT_SEED }), roundIndex: 0 })).toEqual(first);
    // A different seed that also hits draws a different place.
    const second = notEarthFor({ config: casual({ seed: HIT_SEED_2 }), roundIndex: 0 });
    expect(second).toBeTruthy();
    expect(second.id).not.toBe(first.id);
    // And an ordinary seed draws nothing at all.
    expect(notEarthFor({ config: casual({ seed: MISS_SEED }), roundIndex: 0 })).toBeNull();
  });

  test('the same seed on a later round is a fresh draw', () => {
    const hits = [0, 1, 2, 3, 4].map((i) => Boolean(notEarthFor({ config: casual({ seed: HIT_SEED }), roundIndex: i })));
    expect(hits[0]).toBe(true);
    expect(hits.slice(1).every((h) => h === false)).toBe(true);
  });
});

describe('the round the browser is given', () => {
  test('carries the picture and none of the answer', async () => {
    const round = await createRound({ config: casual({ seed: HIT_SEED }), roundIndex: 0, env: ENV });
    // 'photo' on the wire, not 'not-earth': see game.js.
    expect(round.provider).toBe('photo');
    expect(round.candidates).toBeUndefined();
    expect(round.place).toEqual({ src: '/geo/scenery/02.jpg', width: 1920, height: 538, start: 0.75 });
    // Nothing in the response names the world, the mission or the
    // credit, and neither does the file the browser then fetches:
    // reading the network tab must not be a way to win.
    // Ciphertext can contain arbitrary three-letter sequences (CI hit "jpl").
    // Check the readable payload, not random bytes in the authenticated token.
    const { token, ...publicRound } = round;
    expect(token).toMatch(/^g1\.[A-Za-z0-9_-]+$/);
    const wire = JSON.stringify(publicRound);
    expect(wire).not.toMatch(/mars|moon|jezero|apollo|perseverance|nasa|jpl|not-earth/i);
  });

  test('an ordinary seed gets an ordinary round', async () => {
    const round = await createRound({ config: casual({ seed: MISS_SEED }), roundIndex: 0, env: ENV });
    expect(round.provider).toBe('apple');
    expect(round.place).toBeUndefined();
    expect(round.candidates.length).toBeGreaterThan(0);
  });

  test('the token names the place and the world, and no point on Earth', async () => {
    const round = await createRound({ config: casual({ seed: HIT_SEED }), roundIndex: 0, env: ENV });
    const payload = openToken(round.token, { secret: ENV.NEXTAUTH_SECRET });
    expect(payload.ne).toBe('mars-jezero-delta');
    expect(payload.cc).toBe('XM');
    expect(payload.cn).toBe('Mars');
    expect(payload.size).toBe(0);
  });
});

describe('scoring the call', () => {
  const notEarthToken = async (config = casual({ seed: HIT_SEED })) => {
    const round = await createRound({ config, roundIndex: 0, env: ENV });
    return round.token;
  };
  const earthToken = async (config = casual({ seed: MISS_SEED })) => {
    const round = await createRound({ config, roundIndex: 0, env: ENV });
    return round.candidates[0].token;
  };

  test('called right: full marks, and the reveal tells you where you were', async () => {
    const result = evaluateGuess({ token: await notEarthToken(), guess: { notEarth: true }, env: ENV });
    expect(result.kind).toBe('not-earth');
    expect(result.correct).toBe(true);
    expect(result.score).toBe(MAX_ROUND_SCORE);
    expect(result.place.title).toBe("Jezero Crater's river delta, Mars");
    expect(result.place.body).toBe('Mars');
    expect(result.place.credit).toBe('NASA/JPL-Caltech/ASU/MSSS');
    expect(result.place.nasaUrl).toBe('https://images.nasa.gov/details/PIA24921');
    expect(result.answer.country).toEqual({ code: 'XM', name: 'Mars', flag: '🔴' });
  });

  test('a pin on a Not Earth round scores nothing, and still reveals it', async () => {
    const result = evaluateGuess({ token: await notEarthToken(), guess: { lat: 48.85, lng: 2.35 }, env: ENV });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.distanceKm).toBeNull();
    expect(result.timedOut).toBe(false);
    expect(result.place.title).toBeTruthy();
  });

  test('the answer carries no coordinates, so no map plots it', async () => {
    // The token stores 0,0, which is open water off Ghana. A summary
    // map that drew it would put Mars in the Gulf of Guinea.
    const result = evaluateGuess({ token: await notEarthToken(), guess: { notEarth: true }, env: ENV });
    expect(result.answer.lat).toBeNull();
    expect(result.answer.lng).toBeNull();
  });

  test('the clock running out on one is a miss, not a call', async () => {
    const result = evaluateGuess({ token: await notEarthToken(), guess: null, env: ENV });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.timedOut).toBe(true);
  });

  test('calling it on an ordinary round throws the round away', async () => {
    const result = evaluateGuess({ token: await earthToken(), guess: { notEarth: true }, env: ENV });
    expect(result.kind).toBe('pin');
    expect(result.calledNotEarth).toBe(true);
    expect(result.score).toBe(0);
    expect(result.distanceKm).toBeNull();
    expect(result.guess).toBeNull();
    expect(result.timedOut).toBe(false);
    // The answer is still revealed: the player is told where they were.
    expect(result.answer.lat).toEqual(expect.any(Number));
  });

  test('a wrong call in a streak is the miss that ends the run', async () => {
    const token = await earthToken(casual({ mode: 'streak', seed: MISS_SEED, rounds: 0 }));
    const result = evaluateGuess({ token, guess: { notEarth: true }, env: ENV });
    expect(result.kind).toBe('streak');
    expect(result.correct).toBe(false);
    expect(result.calledNotEarth).toBe(true);
  });

  test('a pin round with no call is scored the way it always was', async () => {
    const token = await earthToken();
    const payload = openToken(token, { secret: ENV.NEXTAUTH_SECRET });
    const result = evaluateGuess({ token, guess: { lat: payload.lat, lng: payload.lng }, env: ENV });
    expect(result.kind).toBe('pin');
    expect(result.calledNotEarth).toBeUndefined();
    expect(result.distanceKm).toBeCloseTo(0, 3);
    expect(result.score).toBe(MAX_ROUND_SCORE);
  });
});

describe('what the browser is told, and when', () => {
  test('playablePlace is the picture only; revealPlace is the story', () => {
    const place = notEarthPlace('moon-tranquility-base');
    expect(Object.keys(playablePlace(place)).sort()).toEqual(['height', 'src', 'start', 'width']);
    const reveal = revealPlace(place);
    expect(reveal.body).toBe('The Moon');
    // "That was the Moon", not "That was The Moon".
    expect(reveal.bodyInSentence).toBe('the Moon');
    expect(revealPlace(notEarthPlace('mars-gale-crater')).bodyInSentence).toBe('Mars');
    expect(reveal.flag).toBe('🌕');
    expect(reveal.mission).toBe('Apollo 11');
    expect(reveal.nasaUrl).toContain('jsc2008e040725');
  });

  test('an unknown id is nothing, not a crash', () => {
    expect(notEarthPlace('mars-somewhere-else')).toBeNull();
    expect(playablePlace(null)).toBeNull();
    expect(revealPlace(null)).toBeNull();
  });
});

describe('the badge', () => {
  const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
  const { resolveProfile, profileSummary } = require('@/app/lib/geo/server/profiles');
  const { awardSoloRound } = require('@/app/lib/geo/server/points');
  const { POINTS } = require('@/app/lib/geo/points');

  const T0 = Date.parse('2026-09-16T12:00:00Z');
  const marsResult = (over = {}) => ({
    kind: 'not-earth',
    mode: 'balanced',
    seed: 'seed-mars',
    roundIndex: 0,
    score: MAX_ROUND_SCORE,
    distanceKm: null,
    correct: true,
    answer: { country: { code: 'XM', name: 'Mars', flag: '🔴' } },
    ...over,
  });
  const player = async (store, name) => (await resolveProfile(store, { name, now: T0 })).profile;

  test('calling it right earns the badge for that world, once', async () => {
    const store = createMemoryRoomStore();
    const ada = await player(store, 'Ada');
    const first = await awardSoloRound(store, { profileId: ada.id, result: marsResult(), now: T0 });
    expect(first.badge).toEqual({ countryCode: 'XM', name: 'Mars', flag: '🔴' });
    expect(first.earned).toBeGreaterThanOrEqual(POINTS.badge);

    // A second Mars round pays the round but not the badge again.
    const again = await awardSoloRound(store, { profileId: ada.id, result: marsResult({ seed: 'seed-mars-2' }), now: T0 + 60000 });
    expect(again.badge).toBeNull();
  });

  test('calling it wrong earns nothing but the round', async () => {
    const store = createMemoryRoomStore();
    const bob = await player(store, 'Bob');
    const missed = await awardSoloRound(store, { profileId: bob.id, result: marsResult({ correct: false, score: 0 }), now: T0 });
    expect(missed.badge).toBeNull();
    expect(await store.countBadges(bob.id)).toBe(0);
  });

  test('the profile names it Mars, not XM', async () => {
    const store = createMemoryRoomStore();
    const cy = await player(store, 'Cy');
    await awardSoloRound(store, { profileId: cy.id, result: marsResult(), now: T0 });
    const view = await profileSummary(store, cy, { now: T0 });
    const badge = view.badges.find((b) => b.countryCode === 'XM');
    expect(badge).toMatchObject({ name: 'Mars', flag: '🔴', notEarth: true });
  });
});
