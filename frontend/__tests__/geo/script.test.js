/**
 * The script game (docs/GEO.md, "Script").
 *
 * Three of these tests are the reason the data files are shaped the way
 * they are, and they are worth more than the rest put together:
 *
 * - every region coordinate is checked against the same Natural Earth
 *   polygons that name a geography round, so a typo cannot land Marathi
 *   in Pakistan;
 * - every sample sentence is checked against the Unicode ranges of the
 *   script it claims, so a sentence pasted into the wrong row fails the
 *   build instead of shipping a round with the wrong answer;
 * - no sample may contain a place name, a language name or a digit,
 *   because a sentence that names a city answers itself and turns the
 *   game into a quiz with the answers printed on it.
 *
 * The rest cover the scoring: that a pin is measured against regions
 * rather than borders, and that the ladder sets the scale.
 */

const { LANGUAGES, SCRIPTS, SHARED_CHARS, inScript, languagesInScript, scriptsInCorpus } = require('@/app/lib/geo/languages');
const { SAMPLES, samplesFor } = require('@/app/lib/geo/server/samples');
const { countryAt } = require('@/app/lib/geo/server/countries');
const {
  LADDERS,
  LADDER_ORDER,
  distanceToLanguage,
  ladderSizeKm,
  languagesAt,
  languagesForLadder,
  normalizeScriptConfig,
  scoreScriptGuess,
  scriptConfigToQuery,
} = require('@/app/lib/geo/script');
const { createScriptRound, drawLanguages, evaluateScriptGuess, ScriptGameError } = require('@/app/lib/geo/server/scriptGame');
const { openToken } = require('@/app/lib/geo/server/tokens');

const SECRET = 'a-long-enough-test-secret';
const env = { NEXTAUTH_SECRET: SECRET };
const find = (code) => LANGUAGES.find((language) => language.code === code);

describe('the corpus', () => {
  test('every region lands in the country it claims', () => {
    const wrong = [];
    for (const language of LANGUAGES) {
      for (const region of language.regions) {
        const found = countryAt(region.lat, region.lng);
        if (!found) wrong.push(`${language.name}/${region.name}: no country at ${region.lat},${region.lng}`);
        else if (found.cca2 !== region.cca2) wrong.push(`${language.name}/${region.name}: claims ${region.cca2}, polygons say ${found.cca2}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test('every sample is written in the script its language claims', () => {
    const wrong = [];
    for (const language of LANGUAGES) {
      for (const text of samplesFor(language.code)) {
        for (const ch of [...text]) {
          if (SHARED_CHARS.includes(ch)) continue;
          if (inScript(ch.codePointAt(0), language.script)) continue;
          const point = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
          wrong.push(`${language.name} (${language.script}): U+${point} in "${text.slice(0, 24)}"`);
        }
      }
    }
    expect([...new Set(wrong)]).toEqual([]);
  });

  test('no sample names a place, a language or a number', () => {
    // A sentence containing a city name answers itself. So does a digit,
    // and so does a sentence that names its own language.
    const banned = new Set();
    for (const language of LANGUAGES) {
      banned.add(language.name.toLowerCase());
      banned.add(language.endonym.toLowerCase());
      for (const region of language.regions) {
        for (const word of region.name.split(/\s+/)) {
          if (word.length >= 4 && word[0] === word[0].toUpperCase()) banned.add(word.toLowerCase());
        }
      }
    }
    const offences = [];
    for (const language of LANGUAGES) {
      for (const text of samplesFor(language.code)) {
        if (/[0-9٠-٩۰-۹०-९]/.test(text)) offences.push(`${language.name}: digit in "${text}"`);
        const lower = text.toLowerCase();
        for (const term of banned) {
          if (lower.includes(term)) offences.push(`${language.name}: "${term}" in "${text}"`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  test('every language has usable samples, and the pool is worth playing', () => {
    expect(LANGUAGES.length).toBeGreaterThan(50);
    expect(scriptsInCorpus().length).toBeGreaterThan(20);
    for (const language of LANGUAGES) {
      const rows = samplesFor(language.code);
      expect(rows.length).toBeGreaterThan(0);
      for (const text of rows) expect(text.trim().length).toBeGreaterThan(8);
    }
    // No sample is stranded on a language that is not in the table.
    for (const code of Object.keys(SAMPLES)) expect(find(code)).toBeTruthy();
  });

  test('the scripts a round can ask for are all declared', () => {
    for (const language of LANGUAGES) expect(SCRIPTS[language.script]).toBeTruthy();
  });
});

describe('the ladders', () => {
  test('each offers a real choice, and the shared-script ones share a script', () => {
    for (const id of LADDER_ORDER) {
      const pool = languagesForLadder(id);
      expect(pool.length).toBeGreaterThanOrEqual(2);
      if (SCRIPTS[id]) for (const language of pool) expect(language.script).toBe(id);
    }
    // Devanagari is the ladder the mode was built for: same alphabet,
    // several answers, so reading the script gets you nothing.
    expect(languagesInScript('deva').length).toBeGreaterThanOrEqual(5);
  });

  test('Alphabets asks each writing system exactly once', () => {
    const pool = languagesForLadder('alphabets');
    const scripts = pool.map((language) => language.script);
    expect(new Set(scripts).size).toBe(scripts.length);
    expect(scripts.length).toBe(scriptsInCorpus().length);
  });

  test('an unknown ladder falls back rather than serving an empty game', () => {
    expect(languagesForLadder('nonsense').length).toBe(LANGUAGES.length);
    expect(normalizeScriptConfig({ ladder: 'nonsense' }).ladder).toBe('world');
  });

  test('the ladder sets the scale, which is what makes South Asia hard', () => {
    const world = ladderSizeKm('world');
    const india = ladderSizeKm('india');
    expect(india).toBeLessThan(world / 2);
    // The same miss is worth far less when every answer is already
    // inside the box: pinning "somewhere in India" for Tamil is an
    // answer in the world ladder and a shrug in the India one.
    const tamil = find('tam');
    const punjab = { lat: 30.9, lng: 75.5 };
    const inWorld = scoreScriptGuess({ guess: punjab, language: tamil, ladder: 'world' });
    const inIndia = scoreScriptGuess({ guess: punjab, language: tamil, ladder: 'india' });
    expect(inIndia.points).toBeLessThan(inWorld.points / 4);
  });
});

describe('scoring a pin', () => {
  test('anywhere inside the heartland is full marks, because a language is an area', () => {
    const tamil = find('tam');
    for (const point of [{ lat: 11.1, lng: 78.6 }, { lat: 12.9, lng: 79.1 }, { lat: 9.9, lng: 78.1 }]) {
      const result = scoreScriptGuess({ guess: point, language: tamil, ladder: 'world' });
      expect(result.inRegion).toBe(true);
      expect(result.points).toBe(5000);
      expect(result.distanceKm).toBe(0);
    }
  });

  test('a language with two heartlands is scored against the nearer one', () => {
    // Punjabi is spoken on both sides of a border, and a pin on either
    // side is right. A country dropdown cannot express that.
    const punjabi = find('pan');
    const indian = scoreScriptGuess({ guess: { lat: 30.9, lng: 75.6 }, language: punjabi, ladder: 'world' });
    const pakistani = scoreScriptGuess({ guess: { lat: 31.4, lng: 73.1 }, language: punjabi, ladder: 'world' });
    expect(indian.points).toBe(5000);
    expect(pakistani.points).toBe(5000);
    expect(indian.region.name).not.toBe(pakistani.region.name);
  });

  test('distance is measured to the edge of a region, not its centre', () => {
    const tamil = find('tam');
    const edge = distanceToLanguage({ lat: 11.1, lng: 78.6 }, tamil);
    expect(edge.distanceKm).toBe(0);
    expect(edge.toCentreKm).toBeLessThan(1);
    const far = distanceToLanguage({ lat: 55.7, lng: 37.6 }, tamil);
    expect(far.distanceKm).toBeGreaterThan(4000);
  });

  test('the result says what else is spoken where the pin landed', () => {
    // The teaching half: "you put Tamil in Marathi country" is worth
    // more to a player than a number of kilometres.
    const tamil = find('tam');
    const result = scoreScriptGuess({ guess: { lat: 19.2, lng: 75.5 }, language: tamil, ladder: 'india' });
    expect(result.alsoSpokenHere.map((l) => l.code)).toContain('mar');
    expect(result.alsoSpokenHere.every((l) => l.code !== 'tam')).toBe(true);
    expect(languagesAt({ lat: 19.2, lng: 75.5 }).map((l) => l.code)).toContain('mar');
  });

  test('a pin nowhere near scores nothing, and a missing pin is not a crash', () => {
    const icelandic = find('isl');
    const result = scoreScriptGuess({ guess: { lat: -33.9, lng: 151.2 }, language: icelandic, ladder: 'world' });
    expect(result.points).toBeLessThan(50);
    expect(scoreScriptGuess({ guess: null, language: icelandic })).toBeNull();
    expect(scoreScriptGuess({ guess: { lat: 0, lng: 0 }, language: null })).toBeNull();
  });
});

describe('the draw', () => {
  test('a seed replays the same game, and a game does not repeat itself', () => {
    const config = { ladder: 'world', rounds: 5, seed: 'sc-1' };
    const first = drawLanguages(config).map((l) => l.code);
    const again = drawLanguages({ ...config }).map((l) => l.code);
    expect(again).toEqual(first);
    expect(new Set(first).size).toBe(5);
    expect(drawLanguages({ ...config, seed: 'sc-2' }).map((l) => l.code)).not.toEqual(first);
  });

  test('the server\'s secret decides the draw, so the browser cannot compute the game', () => {
    // Everything else the draw reads is in the page bundle: the ladder,
    // the language rows, the speaker counts and the generator all ship
    // to a 'use client' component, and the seed is in the address bar.
    // Without the secret in the mix the whole answer sequence was
    // computable before the first sentence was read.
    const config = { ladder: 'world', rounds: 5, seed: 'sc-secret' };
    const unsalted = drawLanguages(config).map((l) => l.code);
    const salted = drawLanguages(config, SECRET).map((l) => l.code);
    const other = drawLanguages(config, 'a-different-long-secret').map((l) => l.code);
    expect(salted).not.toEqual(unsalted);
    expect(salted).not.toEqual(other);
    // and it is still a replay: same seed, same secret, same game
    expect(drawLanguages({ ...config }, SECRET).map((l) => l.code)).toEqual(salted);
  });

  test('a ladder smaller than the round count refills instead of refusing', () => {
    const pool = languagesForLadder('cyrl');
    const drawn = drawLanguages({ ladder: 'cyrl', rounds: 10, seed: 'sc-3' });
    expect(drawn.length).toBe(10);
    expect(drawn.length).toBeGreaterThan(pool.length);
    for (const language of drawn) expect(language.script).toBe('cyrl');
  });

  test('the draw stays inside the ladder', () => {
    const drawn = drawLanguages({ ladder: 'india', rounds: 10, seed: 'sc-4' });
    const allowed = new Set(languagesForLadder('india').map((l) => l.code));
    for (const language of drawn) expect(allowed.has(language.code)).toBe(true);
  });
});

describe('a round', () => {
  test('is a sentence from the corpus with the answer sealed', () => {
    const config = { ladder: 'world', rounds: 5, seed: 'r-1' };
    const round = createScriptRound({ config, roundIndex: 2, env });
    expect(round.roundIndex).toBe(2);
    expect(round.text.length).toBeGreaterThan(8);
    // scriptName is deliberately absent: see the leak test below.
    expect(round.scriptName).toBeUndefined();

    const answer = openToken(round.token, { secret: SECRET });
    const language = find(answer.c);
    expect(language).toBeTruthy();
    // The round is drawn from the game the seed describes, the sentence
    // is one of that language's, and the script the client renders in is
    // the one the language actually uses.
    expect(language.code).toBe(drawLanguages(config, SECRET)[2].code);
    expect(samplesFor(language.code)).toContain(round.text);
    expect(round.script).toBe(language.script);
  });

  test('gives away nothing about the answer beyond what is on screen', () => {
    // Found in the deep audit. The round used to carry scriptName, the
    // script's human name, and for a script only one language uses -
    // Odia, Tamil, Georgian, Thai and nine others - that name IS the
    // answer, sent before the guess. Nothing on the client read it.
    //
    // The script ID stays, because the browser cannot choose a font
    // without it, and the script is visible on screen regardless.
    for (let i = 0; i < 12; i++) {
      const config = { ladder: 'world', rounds: 3, seed: `leak-${i}` };
      const round = createScriptRound({ config, roundIndex: 0, env });
      const answer = find(openToken(round.token, { secret: SECRET }).c);
      // The sentence IS the round, and a three-letter code like "por"
      // occurs inside Portuguese prose, so every check looks outside it.
      // The script id is deliberately sent (the browser cannot choose a
      // font without it) and a code can be a substring of one: "tam" is
      // inside "taml". It is checked for what it is instead.
      const withoutText = JSON.stringify({ ...round, text: '', script: '' });
      expect(Object.keys(SCRIPTS)).toContain(round.script);
      expect(round.script).toBe(answer.script);

      for (const giveaway of [answer.name, answer.endonym, answer.family, answer.branch, SCRIPTS[answer.script].name, answer.code]) {
        expect(withoutText).not.toContain(giveaway);
      }
      // The sealed token must not be readable without the secret.
      expect(() => openToken(round.token, { secret: 'a-different-long-secret' })).toThrow();
    }
  });

  test('the same seed and index give the same round every time', () => {
    const config = { ladder: 'india', rounds: 5, seed: 'r-2' };
    const a = createScriptRound({ config, roundIndex: 1, env });
    const b = createScriptRound({ config, roundIndex: 1, env });
    expect(b.text).toBe(a.text);
    expect(openToken(b.token, { secret: SECRET }).c).toBe(openToken(a.token, { secret: SECRET }).c);
  });

  test('refuses to start without a token secret rather than sending the answer in the clear', () => {
    expect(() => createScriptRound({ config: { seed: 'r-3' }, roundIndex: 0, env: {} })).toThrow(ScriptGameError);
  });
});

describe('scoring a round', () => {
  const roundFor = (code) => {
    // Walk the world ladder until the language we want comes up, so the
    // test scores a real token rather than a hand-built one.
    for (let i = 0; i < 400; i++) {
      const config = { ladder: 'world', rounds: 3, seed: `hunt-${i}` };
      const drawn = drawLanguages(config, SECRET);
      const index = drawn.findIndex((language) => language.code === code);
      if (index >= 0) return createScriptRound({ config, roundIndex: index, env });
    }
    throw new Error(`never drew ${code}`);
  };

  test('reveals the language and every region it is spoken in', () => {
    const round = roundFor('tam');
    const result = evaluateScriptGuess({ token: round.token, guess: { lat: 11.1, lng: 78.6 }, env });
    expect(result.kind).toBe('script');
    expect(result.score).toBe(5000);
    expect(result.inRegion).toBe(true);
    expect(result.answer).toMatchObject({ code: 'tam', name: 'Tamil', script: 'taml', family: 'Dravidian' });
    expect(result.answer.endonym).toBeTruthy();
    // Both heartlands, so the map can draw them: a border is not the
    // edge of a language.
    expect(result.answer.regions.length).toBe(2);
    expect(result.answer.regions.map((r) => r.cca2).sort()).toEqual(['IN', 'LK']);
  });

  test('a pin in the wrong part of the same country loses most of the round', () => {
    const round = roundFor('tam');
    const right = evaluateScriptGuess({ token: round.token, guess: { lat: 11.1, lng: 78.6 }, env });
    const wrong = evaluateScriptGuess({ token: round.token, guess: { lat: 30.9, lng: 75.5 }, env });
    expect(wrong.score).toBeLessThan(right.score / 2);
    expect(wrong.distanceKm).toBeGreaterThan(1500);
  });

  test('a missing pin scores zero and still reveals', () => {
    const round = roundFor('isl');
    const result = evaluateScriptGuess({ token: round.token, guess: null, env });
    expect(result.score).toBe(0);
    expect(result.distanceKm).toBeNull();
    expect(result.guess).toBeNull();
    expect(result.answer.code).toBe('isl');
  });

  test('a garbled pin is treated as no pin, not as a pin at zero, zero', () => {
    const round = roundFor('isl');
    const result = evaluateScriptGuess({ token: round.token, guess: { lat: 'north', lng: null }, env });
    expect(result.score).toBe(0);
    expect(result.guess).toBeNull();
  });
});

describe('the link', () => {
  test('carries the whole game, and drops what the game does not support', () => {
    const query = scriptConfigToQuery({ ladder: 'deva', rounds: 10, timer: 60, seed: 'abc' });
    expect(query).toBe('ladder=deva&rounds=10&timer=60&seed=abc');
    const config = normalizeScriptConfig(Object.fromEntries(new URLSearchParams(query)));
    expect(config).toEqual({ ladder: 'deva', rounds: 10, timer: 60, seed: 'abc' });
    // Nonsense from a hand-edited link becomes the defaults.
    expect(normalizeScriptConfig({ rounds: 7, timer: 45 })).toMatchObject({ rounds: 5, timer: 0 });
  });

  test('every ladder in the order exists and describes itself', () => {
    for (const id of LADDER_ORDER) {
      expect(LADDERS[id]).toBeTruthy();
      expect(LADDERS[id].label).toBeTruthy();
      expect(LADDERS[id].description.length).toBeGreaterThan(20);
    }
    expect(LADDER_ORDER.length).toBe(Object.keys(LADDERS).length);
  });
});
