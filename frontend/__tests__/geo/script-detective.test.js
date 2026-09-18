import { createDetectiveRound, evaluateDetectiveGuess } from '@/app/lib/geo/server/scriptDetective';
import { createScriptRound } from '@/app/lib/geo/server/scriptGame';
import { openToken } from '@/app/lib/geo/server/tokens';
import { LADDERS } from '@/app/lib/geo/script';
import { languageByCode } from '@/app/lib/geo/languages';
import { resolveRegions } from '@/app/lib/geo/server/regions';

const secret = 'detective-test-secret-not-production';
const env = { GEO_TOKEN_SECRET: secret };
const now = 1700000000000;
const make = (ladder = 'world', index = 0) => createDetectiveRound({ config: { ladder, rounds: 5, seed: 'detective-tests' }, roundIndex: index, now, env });
const payload = (round) => openToken(round.token, { secret, now });
const score = (round, guess) => evaluateDetectiveGuess({ token: round.token, guess, now, env });

test.each(Object.keys(LADDERS))('%s has four unique sealed, deterministic choices, including the answer', (ladder) => {
  for (let index = 0; index < 5; index++) {
    const round = make(ladder, index);
    const sealed = payload(round);
    expect(round.choices).toHaveLength(4);
    expect(new Set(round.choices.map((entry) => entry.name)).size).toBe(4);
    expect(sealed.choices.filter((entry) => entry.code === sealed.c)).toHaveLength(1);
    expect(round.choices).toEqual(make(ladder, index).choices);
    expect(round.text).toBe(make(ladder, index).text);
    expect(Object.keys(round).sort()).toEqual(['choices', 'ladder', 'roundIndex', 'script', 'text', 'token']);
    expect(round.choices.every((entry) => Object.keys(entry).sort().join() === 'id,name')).toBe(true);
  }
});

test('language alone scores 4000, an optional exact map pin adds 1000, neither scores zero', () => {
  const round = make();
  const data = payload(round);
  const choice = data.choices.find((entry) => entry.code === data.c).id;
  const wrong = data.choices.find((entry) => entry.code !== data.c).id;
  const [lng, lat] = resolveRegions(languageByCode(data.c))[0].rings[0][0];
  expect(score(round, { choice })).toMatchObject({ score: 4000, mapPoints: 0, languagePoints: 4000, choice: { correct: true } });
  expect(score(round, { choice, pin: { lat, lng } })).toMatchObject({ score: 5000, mapPoints: 1000 });
  expect(score(round, { choice: wrong, pin: { lat, lng } })).toMatchObject({ score: 1000, languagePoints: 0, choice: { correct: false } });
  expect(score(round, null)).toMatchObject({ score: 0, choice: null, guess: null });
  expect(score(round, { choice }).answer.markers.length).toBeGreaterThan(0);
});

test('invalid selections, out-of-range pins and old tokens cannot be used as detective guesses', () => {
  const round = make();
  for (const guess of [{ choice: '5' }, { choice: 1 }, { pin: { lat: 91, lng: 0 } }, { pin: { lat: 0, lng: 181 } }, { pin: { lat: '0', lng: 0 } }]) {
    expect(() => score(round, guess)).toThrow();
  }
  const legacy = createScriptRound({ config: { seed: 'legacy' }, env, now });
  expect(() => score(legacy, { choice: '1' })).toThrow('Start a new Script round');
  expect(() => evaluateDetectiveGuess({ token: round.token, now: now + 13 * 60 * 60 * 1000, env })).toThrow('expired');
  expect(() => score({ token: round.token.slice(0, -8) }, {})).toThrow();
});
