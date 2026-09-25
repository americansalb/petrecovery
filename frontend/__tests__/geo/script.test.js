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
 * rather than borders, and that every game is one pool on one scale.
 */

const { LANGUAGES, SCRIPTS, SHARED_CHARS, inScript, scriptsInCorpus } = require('@/app/lib/geo/languages');
const { SAMPLES, samplesFor } = require('@/app/lib/geo/server/samples');
const { markersFor } = require('@/app/lib/geo/server/markers');
const { normalizeScriptConfig, scriptConfigToQuery } = require('@/app/lib/geo/script');
const {
  COUNTRIES,
  UNITS,
  adminUnit,
  countryShape,
  distanceToLanguage,
  languagesAt,
  resolveRegions,
  scoreScriptGuess,
  scriptScaleKm,
} = require('@/app/lib/geo/server/regions');
const { createScriptRound, drawLanguages, evaluateScriptGuess, ScriptGameError } = require('@/app/lib/geo/server/scriptGame');
const { openToken, sealToken } = require('@/app/lib/geo/server/tokens');

const SECRET = 'a-long-enough-test-secret';
const env = { NEXTAUTH_SECRET: SECRET };
const find = (code) => LANGUAGES.find((language) => language.code === code);

describe('the corpus', () => {
  test('every region is a real place, and every code resolves to a shape', () => {
    // A typo in a unit code is the one way this data can be wrong
    // without looking wrong: 'IN-TM' would simply throw on the round
    // that drew Tamil. So every code every language names is resolved
    // here, and the shape it resolves to has to be a shape.
    const wrong = [];
    for (const language of LANGUAGES) {
      for (const region of language.regions) {
        if (!region.units?.length && !region.countries?.length) {
          wrong.push(`${language.name}/${region.name}: names no place`);
          continue;
        }
        for (const id of region.units || []) {
          const unit = adminUnit(id);
          if (!unit) wrong.push(`${language.name}/${region.name}: no unit ${id}`);
          else if (unit.cca2 !== id.slice(0, 2)) wrong.push(`${id}: country ${unit.cca2}`);
        }
        for (const code of region.countries || []) {
          if (!countryShape(code)) wrong.push(`${language.name}/${region.name}: no country ${code}`);
        }
      }
      for (const resolved of resolveRegions(language)) {
        const points = resolved.rings.reduce((n, ring) => n + ring.length, 0);
        if (points < 4) wrong.push(`${language.name}/${resolved.name}: ${points} points`);
        if (resolved.box.maxLat <= resolved.box.minLat) wrong.push(`${language.name}/${resolved.name}: empty box`);
      }
    }
    expect(wrong).toEqual([]);
    // The data file carries what the corpus names and nothing else:
    // Natural Earth's other four thousand subdivisions are not shipped.
    expect(Object.keys(UNITS).length).toBeGreaterThan(200);
    expect(Object.keys(COUNTRIES).length).toBeGreaterThan(100);
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
        // Whole words, not substrings. A plain `includes` said Shona
        // names Akan because ndakanwa has a-k-a-n in the middle of it,
        // and that Lingala names Mali because of malili. The rule is
        // about a sentence naming a place, and a name is a word.
        const words = new Set(
          text
            .toLowerCase()
            .split(/[^\p{Letter}\p{Mark}]+/u)
            .filter(Boolean)
        );
        for (const term of banned) {
          const named = term.includes(' ') ? text.toLowerCase().includes(term) : words.has(term);
          if (named) offences.push(`${language.name}: "${term}" in "${text}"`);
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

describe('one pool', () => {
  // Founder decision, 2026-09-23: players do not choose a set of
  // languages, and nothing tells them what could come up. There were
  // seven sets; every game now draws from every language, on one scale.
  test('a link that still names a set plays the one pool', () => {
    expect(normalizeScriptConfig({ ladder: 'india', rounds: 5, seed: 's' })).toEqual({ rounds: 5, timer: 0, seed: 's' });
    const old = drawLanguages({ ladder: 'deva', rounds: 10, seed: 'old-link' }, SECRET).map((l) => l.code);
    const plain = drawLanguages({ rounds: 10, seed: 'old-link' }, SECRET).map((l) => l.code);
    expect(old).toEqual(plain);
  });

  test('one scale for every game, and a token from a smaller set is scored on it', () => {
    // The South Asia set used a box one subcontinent wide, so the same
    // miss cost more there. With one pool there is one box: the one
    // every answer lives in.
    const scale = scriptScaleKm();
    expect(scale).toBeGreaterThan(10000);
    const tamil = find('tam');
    const punjab = { lat: 30.9, lng: 75.5 };
    expect(scoreScriptGuess({ guess: punjab, language: tamil }).sizeKm).toBe(scale);
    // A round sealed before the sets went names its set in the token.
    const old = sealToken({ c: 'tam', l: 'india', i: 0, seed: 'old-token' }, { secret: SECRET });
    const result = evaluateScriptGuess({ token: old, guess: punjab, env });
    expect(result.sizeKm).toBe(scale);
    expect(result.score).toBe(scoreScriptGuess({ guess: punjab, language: tamil }).points);
    // Pinning the right subcontinent for Tamil is worth something; the
    // right state is worth all of it.
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(2500);
  });
});

describe('scoring a pin', () => {
  test('anywhere inside the heartland is full marks, because a language is an area', () => {
    const tamil = find('tam');
    for (const point of [{ lat: 11.1, lng: 78.6 }, { lat: 12.9, lng: 79.1 }, { lat: 9.9, lng: 78.1 }]) {
      const result = scoreScriptGuess({ guess: point, language: tamil });
      expect(result.inRegion).toBe(true);
      expect(result.points).toBe(5000);
      expect(result.distanceKm).toBe(0);
    }
  });

  test('a language with two heartlands is scored against the nearer one', () => {
    // Punjabi is spoken on both sides of a border, and a pin on either
    // side is right. A country dropdown cannot express that.
    const punjabi = find('pan');
    const indian = scoreScriptGuess({ guess: { lat: 30.9, lng: 75.6 }, language: punjabi });
    const pakistani = scoreScriptGuess({ guess: { lat: 31.4, lng: 73.1 }, language: punjabi });
    expect(indian.points).toBe(5000);
    expect(pakistani.points).toBe(5000);
    expect(indian.region.name).not.toBe(pakistani.region.name);
  });

  test('distance is measured to the edge of a region, not its centre', () => {
    const tamil = find('tam');
    const edge = distanceToLanguage({ lat: 11.1, lng: 78.6 }, tamil);
    expect(edge.distanceKm).toBe(0);
    // Bengaluru is a short drive from the Tamil Nadu border and a long
    // way from the middle of it. The number a player is shown is the
    // one they would recognise.
    const near = distanceToLanguage({ lat: 12.97, lng: 77.59 }, tamil);
    expect(near.distanceKm).toBeGreaterThan(5);
    expect(near.distanceKm).toBeLessThan(60);
    // And the line drawn on the reveal ends on the border itself.
    expect(near.at.lat).toBeGreaterThan(12);
    expect(near.at.lng).toBeGreaterThan(77);
    const far = distanceToLanguage({ lat: 55.7, lng: 37.6 }, tamil);
    expect(far.distanceKm).toBeGreaterThan(4000);
  });

  test('a pin in a state is a pin in the language, everywhere in the state', () => {
    // The point of admin-1 regions. Every one of these is a real city
    // in a real state, and the old discs got several of them wrong:
    // the Marathi circle covered Kalaburagi in Karnataka, and the
    // Maithili one covered the hills of eastern Nepal.
    const cities = {
      Chennai: [13.08, 80.27, ['tam']],
      Madurai: [9.92, 78.12, ['tam']],
      Jaffna: [9.66, 80.02, ['tam']],
      Colombo: [6.93, 79.86, ['sin']],
      Mumbai: [19.08, 72.88, ['mar']],
      Bengaluru: [12.97, 77.59, ['kan']],
      Kochi: [9.93, 76.27, ['mal']],
      Bhubaneswar: [20.27, 85.84, ['ory']],
      Guwahati: [26.14, 91.74, ['asm']],
      Amritsar: [31.63, 74.87, ['pan']],
      Lahore: [31.55, 74.34, ['pan']],
      Dhaka: [23.81, 90.41, ['ben']],
      Kolkata: [22.57, 88.36, ['ben']],
      Kathmandu: [27.7, 85.32, ['npi']],
      Ahmedabad: [23.02, 72.57, ['guj']],
      Karachi: [24.86, 67.01, ['snd']],
      Bhopal: [23.26, 77.41, ['hin']],
    };
    const wrong = [];
    for (const [city, [lat, lng, expected]] of Object.entries(cities)) {
      const here = languagesAt({ lat, lng }).map((language) => language.code);
      for (const code of expected) {
        if (!here.includes(code)) wrong.push(`${city}: ${code} not spoken here, only ${here.join(',') || 'nothing'}`);
        const scored = scoreScriptGuess({ guess: { lat, lng }, language: find(code) });
        if (scored.points !== 5000) wrong.push(`${city}: ${code} scored ${scored.points}`);
      }
    }
    expect(wrong).toEqual([]);
    // And the wrong state is the wrong answer, inside the same country.
    expect(languagesAt({ lat: 17.33, lng: 76.83 }).map((l) => l.code)).toEqual(['kan']);
    expect(languagesAt({ lat: 27.33, lng: 86.08 }).map((l) => l.code)).toEqual(['npi']);
    // Chennai is 600 km from Maharashtra: the right part of the world,
    // the wrong state, and a third of the round gone.
    const marathiInChennai = scoreScriptGuess({ guess: { lat: 13.08, lng: 80.27 }, language: find('mar') });
    expect(marathiInChennai.points).toBeLessThan(4000);
    expect(marathiInChennai.distanceKm).toBeGreaterThan(400);
  });

  test('an enclave belongs to the language spoken in it, not to the state around it', () => {
    // Puducherry is one union territory in four pieces in three states.
    // Assigning the whole unit to Tamil, which is what the first cut of
    // this did, scored a pin in Malayalam-speaking Mahe as full marks
    // for Tamil. Each piece belongs to the language spoken there.
    const at = (lat, lng) => languagesAt({ lat, lng }).map((language) => language.code).sort();
    expect(at(11.93, 79.78)).toContain('tam'); // Puducherry town
    expect(at(10.92, 79.83)).toContain('tam'); // Karaikal
    expect(at(12.053, 75.288)).toEqual(['mal']); // Mahe, which Kerala's own polygon does not cover
    expect(at(16.727, 82.242)).toEqual(['tel']); // Yanam, which sits inside Andhra Pradesh
  });

  test('a city speaks the language it speaks, everywhere in the world', () => {
    // The list this test used to carry is now
    // __tests__/geo/region-places.test.js, which covers every language
    // in the corpus rather than the fifty-odd that happened to be here,
    // and fails the suite if a new language arrives without a place. It
    // found a wrong province code, a Kurdish region drawn over the
    // wrong alphabet, and thirty-three regions that were rectangles.
    //
    // What stays here is the reason the list exists: a language is an
    // area, and anywhere inside it is full marks.
    const kochi = { lat: 9.93, lng: 76.27 };
    expect(languagesAt(kochi).map((l) => l.code)).toContain('mal');
    expect(scoreScriptGuess({ guess: kochi, language: find('mal') }).points).toBe(5000);
    const kasaragod = { lat: 12.5, lng: 74.99 };
    expect(scoreScriptGuess({ guess: kasaragod, language: find('mal') }).points).toBe(5000);
  });

  test('the same ground can speak more than one, and often does', () => {
    const at = (lat, lng) => languagesAt({ lat, lng }).map((language) => language.code).sort();
    expect(at(50.85, 4.35)).toEqual(['fra', 'nld']); // Brussels
    expect(at(43.86, 18.41)).toEqual(['bos', 'hrv', 'srp']); // Sarajevo
    expect(at(41.39, 2.17)).toEqual(['cat', 'spa']); // Barcelona
    expect(at(43.26, -2.93)).toEqual(['eus', 'spa']); // Bilbao
    expect(at(36.19, 44.01)).toEqual(['arb', 'ckb']); // Erbil
    expect(at(38.08, 46.29)).toEqual(['azj', 'pes']); // Tabriz
    // Kabul is Pashto and Dari, not Pashto and Persian: Dari is the
    // Afghan standard of the same language and has its own row, so the
    // ground is not given to Iran.
    expect(at(34.53, 69.17).sort()).toEqual(['pbu', 'prs']); // Kabul
  });

  test('languages overlap, because the ground does', () => {
    // A state is not a language and a language is not a state. Every
    // one of these places speaks more than one of the corpus, and a
    // model that made regions exclusive would have to pick a winner.
    const both = (lat, lng) => languagesAt({ lat, lng }).map((language) => language.code).sort();
    expect(both(27.04, 88.26)).toEqual(['ben', 'npi']); // Darjeeling
    expect(both(25.32, 82.97)).toEqual(['bho', 'hin', 'urd']); // Varanasi
    expect(both(26.17, 85.9)).toEqual(['hin', 'mai']); // Darbhanga
    expect(both(17.38, 78.49)).toEqual(['tel', 'urd']); // Hyderabad
    expect(both(24.86, 67.01)).toEqual(['snd', 'urd']); // Karachi
  });

  test('a language that is part of a state is drawn as part of a state', () => {
    // Bhojpuri is neither Bihar nor Uttar Pradesh. It is the country
    // either side of the Ganges around Bhojpur, and Patna, a hundred
    // kilometres east, is Magahi rather than Bhojpuri.
    const bhojpuri = find('bho');
    const varanasi = scoreScriptGuess({ guess: { lat: 25.32, lng: 82.97 }, language: bhojpuri });
    expect(varanasi.points).toBe(5000);
    expect(languagesAt({ lat: 25.61, lng: 85.14 }).map((l) => l.code)).not.toContain('bho');
    // The clip keeps the state's own outline, so the region is a piece
    // of Bihar rather than a rectangle drawn over it.
    const western = resolveRegions(bhojpuri).find((region) => region.name === 'western Bihar');
    expect(western.box.maxLng).toBeLessThanOrEqual(84.91);
    expect(western.rings[0].length).toBeGreaterThan(20);
    // And it crosses into Nepal, where the language does.
    expect(resolveRegions(bhojpuri).some((region) => region.cca2 === 'NP')).toBe(true);
  });

  test('the result says what else is spoken where the pin landed', () => {
    // The teaching half: "you put Tamil in Marathi country" is worth
    // more to a player than a number of kilometres.
    const tamil = find('tam');
    const result = scoreScriptGuess({ guess: { lat: 19.2, lng: 75.5 }, language: tamil });
    expect(result.alsoSpokenHere.map((l) => l.code)).toContain('mar');
    expect(result.alsoSpokenHere.every((l) => l.code !== 'tam')).toBe(true);
    expect(languagesAt({ lat: 19.2, lng: 75.5 }).map((l) => l.code)).toContain('mar');
  });

  test('a pin nowhere near scores nothing, and a missing pin is not a crash', () => {
    const icelandic = find('isl');
    const result = scoreScriptGuess({ guess: { lat: -33.9, lng: 151.2 }, language: icelandic });
    expect(result.points).toBeLessThan(50);
    expect(scoreScriptGuess({ guess: null, language: icelandic })).toBeNull();
    expect(scoreScriptGuess({ guess: { lat: 0, lng: 0 }, language: null })).toBeNull();
  });
});

describe('the draw', () => {
  test('a seed replays the same game, and a game does not repeat itself', () => {
    const config = { rounds: 5, seed: 'sc-1' };
    const first = drawLanguages(config).map((l) => l.code);
    const again = drawLanguages({ ...config }).map((l) => l.code);
    expect(again).toEqual(first);
    expect(new Set(first).size).toBe(5);
    expect(drawLanguages({ ...config, seed: 'sc-2' }).map((l) => l.code)).not.toEqual(first);
  });

  test('the server\'s secret decides the draw, so the browser cannot compute the game', () => {
    // The seed is in the address bar, and the language rows, the
    // speaker counts and the generator are code. They used to ship to
    // the browser; they stay on the server now, but a list is a small
    // thing to leak, and without the secret in the mix the whole answer
    // sequence would be computable before the first sentence was read.
    const config = { rounds: 5, seed: 'sc-secret' };
    const unsalted = drawLanguages(config).map((l) => l.code);
    const salted = drawLanguages(config, SECRET).map((l) => l.code);
    const other = drawLanguages(config, 'a-different-long-secret').map((l) => l.code);
    expect(salted).not.toEqual(unsalted);
    expect(salted).not.toEqual(other);
    // and it is still a replay: same seed, same secret, same game
    expect(drawLanguages({ ...config }, SECRET).map((l) => l.code)).toEqual(salted);
  });

  test('the draw is from every language, not from any one part of the world', () => {
    const scripts = new Set();
    const codes = new Set(LANGUAGES.map((l) => l.code));
    for (let i = 0; i < 30; i++) {
      for (const language of drawLanguages({ rounds: 10, seed: `sc-wide-${i}` }, SECRET)) {
        expect(codes.has(language.code)).toBe(true);
        scripts.add(language.script);
      }
    }
    // Three hundred rounds reach most of the writing systems there are.
    expect(scripts.size).toBeGreaterThan(20);
  });
});

describe('a round', () => {
  test('is text from the corpus with the answer sealed', () => {
    const config = { rounds: 5, seed: 'r-1' };
    const round = createScriptRound({ config, roundIndex: 2, env });
    expect(round.roundIndex).toBe(2);
    expect(round.text.length).toBeGreaterThan(8);
    // scriptName is deliberately absent: see the leak test below.
    expect(round.scriptName).toBeUndefined();

    const answer = openToken(round.token, { secret: SECRET });
    const language = find(answer.c);
    expect(language).toBeTruthy();
    // The round is drawn from the game the seed describes, the text is
    // made of that language's sentences and nothing else, and the script
    // the client renders in is the one the language actually uses.
    expect(language.code).toBe(drawLanguages(config, SECRET)[2].code);
    // Longest first: a sentence can contain a shorter one.
    let rest = round.text;
    for (const sentence of [...samplesFor(language.code)].sort((a, b) => b.length - a.length)) rest = rest.replace(sentence, '');
    expect(rest.trim()).toBe('');
    expect(round.script).toBe(language.script);
  });

  test('is enough text to read a language from, never four words', () => {
    // "Dit was baie mooi." was a whole round (founder, 2026-09-25). A round
    // is that language's sentences now, until there are ninety characters,
    // or thirty in Han and Japanese, and at most four sentences.
    const dense = new Set(['hans', 'jpan']);
    let short = 0;
    for (let i = 0; i < 40; i++) {
      const config = { rounds: 10, seed: `passage-${i}` };
      for (let r = 0; r < 10; r++) {
        const round = createScriptRound({ config, roundIndex: r, env });
        const language = find(openToken(round.token, { secret: SECRET }).c);
        const pool = samplesFor(language.code);
        const used = pool.filter((sentence) => round.text.includes(sentence)).sort((a, b) => b.length - a.length);
        let rest = round.text;
        for (const sentence of used) rest = rest.replace(sentence, '');
        expect(rest.trim()).toBe('');
        const length = [...round.text].length;
        const floor = dense.has(language.script) ? 30 : 90;
        // Short only when the pool ran out or four sentences were not enough.
        if (length < floor && used.length < Math.min(4, pool.length)) short += 1;
      }
    }
    expect(short).toBe(0);
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
      const config = { rounds: 3, seed: `leak-${i}` };
      const round = createScriptRound({ config, roundIndex: 0, env });
      const answer = find(openToken(round.token, { secret: SECRET }).c);
      // The sentence IS the round, and a three-letter code like "por"
      // occurs inside Portuguese prose, so every check looks outside it.
      // The script id is deliberately sent (the browser cannot choose a
      // font without it) and a code can be a substring of one: "tam" is
      // inside "taml". It is checked for what it is instead.
      // The sealed token comes out too, and not for tidiness: it is
      // random base64, so sooner or later three of its characters spell
      // a language code. `nqo` turned up inside a real token and failed
      // this test on a change that had nothing to do with it. The token
      // is checked for what it is, below: unreadable without the
      // secret. Scanning it for plaintext is scanning noise.
      const withoutText = JSON.stringify({ ...round, text: '', script: '', token: '' });
      expect(Object.keys(SCRIPTS)).toContain(round.script);
      expect(round.script).toBe(answer.script);

      for (const giveaway of [answer.name, answer.endonym, answer.family, answer.branch, SCRIPTS[answer.script].name, answer.code]) {
        expect(withoutText).not.toContain(giveaway);
      }
      // Same rule for the markers, and it bites harder: a marker is a
      // string chosen because it identifies one language and no other,
      // so a round carrying them would hand over the whole pool.
      expect(round.markers).toBeUndefined();
      for (const marker of markersFor(answer.code)) expect(withoutText).not.toContain(marker.text);
      // The sealed token must not be readable without the secret.
      expect(() => openToken(round.token, { secret: 'a-different-long-secret' })).toThrow();
    }
  });

  test('the same seed and index give the same round every time', () => {
    const config = { rounds: 5, seed: 'r-2' };
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
    // Walk the draw until the language we want comes up, so the test
    // scores a real token rather than a hand-built one. Ten rounds a game
    // and a long walk, because a small language is drawn about one round
    // in a thousand now the pool is past two hundred and fifty.
    for (let i = 0; i < 3000; i++) {
      const config = { rounds: 10, seed: `hunt-${i}` };
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
    // Every region, so the map can draw them all: Tamil Nadu, the two
    // Tamil pieces of Puducherry, the Sri Lankan north and east, and
    // Singapore, where Tamil is an official language. A border is not the
    // edge of a language.
    expect(result.answer.regions.length).toBe(4);
    expect([...new Set(result.answer.regions.map((r) => r.cca2))].sort()).toEqual(['IN', 'LK', 'SG']);
    expect(result.answer.regions.every((region) => region.rings?.length)).toBe(true);
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
    // A set of languages is no longer part of a game, so an old link's
    // is dropped with the rest of what the game does not support.
    const query = scriptConfigToQuery({ ladder: 'deva', rounds: 10, timer: 60, seed: 'abc' });
    expect(query).toBe('rounds=10&timer=60&seed=abc');
    const config = normalizeScriptConfig(Object.fromEntries(new URLSearchParams(query)));
    expect(config).toEqual({ rounds: 10, timer: 60, seed: 'abc' });
    // Nonsense from a hand-edited link becomes the defaults.
    expect(normalizeScriptConfig({ rounds: 7, timer: 45 })).toMatchObject({ rounds: 5, timer: 0 });
  });
});

describe('what gave it away', () => {
  test('the reveal carries the features in the sentence that was shown, and nothing from other sentences', () => {
    for (let i = 0; i < 20; i++) {
      const config = { rounds: 3, seed: `tells-${i}` };
      const round = createScriptRound({ config, roundIndex: 0, env });
      const { result } = { result: evaluateScriptGuess({ token: round.token, guess: { lat: 0, lng: 0 }, env }) };
      // Every marker sent back is really in the sentence the player
      // read. A note about a letter that was not on screen teaches the
      // wrong round.
      expect(result.answer.markers.length).toBeGreaterThan(0);
      for (const marker of result.answer.markers) {
        expect(round.text).toContain(marker.text);
        expect(marker.note.length).toBeGreaterThan(20);
      }
      const all = markersFor(result.answer.code);
      const absent = all.filter((marker) => !round.text.includes(marker.text));
      for (const marker of absent) expect(result.answer.markers).not.toContain(marker);
    }
  });

  test('the reveal says nothing about what else is in the game', () => {
    // It used to add "In this pool, Odia is written for Odia and nothing
    // else", and to name the set being played. Both told a player what
    // could come up.
    const round = createScriptRound({ config: { rounds: 1, seed: 'alpha-1' }, roundIndex: 0, env });
    const result = evaluateScriptGuess({ token: round.token, guess: null, env });
    expect(result.answer.onlyOneInScript).toBeUndefined();
    expect(result.ladder).toBeUndefined();
    expect(round.ladder).toBeUndefined();
  });
});
