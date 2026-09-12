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
const {
  LADDERS,
  LADDER_ORDER,
  languagesForLadder,
  normalizeScriptConfig,
  scriptConfigToQuery,
} = require('@/app/lib/geo/script');
const {
  COUNTRIES,
  UNITS,
  adminUnit,
  countryShape,
  distanceToLanguage,
  ladderSizeKm,
  languagesAt,
  resolveRegions,
  scoreScriptGuess,
} = require('@/app/lib/geo/server/regions');
const { createScriptRound, drawLanguages, evaluateScriptGuess, ScriptGameError } = require('@/app/lib/geo/server/scriptGame');
const { openToken } = require('@/app/lib/geo/server/tokens');

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
        const scored = scoreScriptGuess({ guess: { lat, lng }, language: find(code), ladder: 'india' });
        if (scored.points !== 5000) wrong.push(`${city}: ${code} scored ${scored.points}`);
      }
    }
    expect(wrong).toEqual([]);
    // And the wrong state is the wrong answer, inside the same country.
    expect(languagesAt({ lat: 17.33, lng: 76.83 }).map((l) => l.code)).toEqual(['kan']);
    expect(languagesAt({ lat: 27.33, lng: 86.08 }).map((l) => l.code)).toEqual(['npi']);
    // Chennai is 600 km from Maharashtra, which inside the South Asia
    // ladder is most of the round gone.
    const marathiInChennai = scoreScriptGuess({ guess: { lat: 13.08, lng: 80.27 }, language: find('mar'), ladder: 'india' });
    expect(marathiInChennai.points).toBeLessThan(1800);
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
    // The corpus is 76 languages and the map is now every one of them.
    // These are the checks that would catch a wrong code: each city is
    // somewhere the language is unarguably spoken, and a wrong unit or
    // a wrong country would miss it.
    const cities = {
      Reykjavik: [64.15, -21.94, 'isl'],
      Lisbon: [38.72, -9.14, 'por'],
      'Sao Paulo': [-23.55, -46.63, 'por'],
      Luanda: [-8.84, 13.23, 'por'],
      Madrid: [40.42, -3.7, 'spa'],
      'Mexico City': [19.43, -99.13, 'spa'],
      'Buenos Aires': [-34.6, -58.38, 'spa'],
      Bogota: [4.71, -74.07, 'spa'],
      Paris: [48.86, 2.35, 'fra'],
      Montreal: [45.5, -73.57, 'fra'],
      Dakar: [14.72, -17.47, 'fra'],
      Geneva: [46.2, 6.14, 'fra'],
      Amsterdam: [52.37, 4.9, 'nld'],
      Zurich: [47.38, 8.54, 'deu'],
      Berlin: [52.52, 13.4, 'deu'],
      Vienna: [48.21, 16.37, 'deu'],
      Rome: [41.9, 12.5, 'ita'],
      Lugano: [46.0, 8.95, 'ita'],
      Cardiff: [51.48, -3.18, 'cym'],
      Stockholm: [59.33, 18.07, 'swe'],
      Oslo: [59.91, 10.75, 'nob'],
      Copenhagen: [55.68, 12.57, 'dan'],
      Helsinki: [60.17, 24.94, 'fin'],
      Tallinn: [59.44, 24.75, 'est'],
      Vilnius: [54.69, 25.28, 'lit'],
      Warsaw: [52.23, 21.01, 'pol'],
      Prague: [50.08, 14.44, 'ces'],
      Budapest: [47.5, 19.04, 'hun'],
      Bucharest: [44.43, 26.1, 'ron'],
      Chisinau: [47.01, 28.86, 'ron'],
      Sofia: [42.7, 23.32, 'bul'],
      Zagreb: [45.81, 15.98, 'hrv'],
      Belgrade: [44.79, 20.45, 'srp'],
      Tirana: [41.33, 19.82, 'sqi'],
      Pristina: [42.66, 21.17, 'sqi'],
      Athens: [37.98, 23.73, 'ell'],
      Istanbul: [41.01, 28.98, 'tur'],
      Kyiv: [50.45, 30.52, 'ukr'],
      Moscow: [55.76, 37.62, 'rus'],
      Minsk: [53.9, 27.57, 'rus'],
      Tbilisi: [41.72, 44.78, 'kat'],
      Yerevan: [40.18, 44.51, 'hye'],
      Baku: [40.41, 49.87, 'azj'],
      Tabriz: [38.08, 46.29, 'azj'],
      'Tel Aviv': [32.08, 34.78, 'heb'],
      Cairo: [30.04, 31.24, 'arb'],
      Casablanca: [33.57, -7.59, 'arb'],
      Riyadh: [24.71, 46.68, 'arb'],
      Tehran: [35.69, 51.39, 'pes'],
      Herat: [34.35, 62.2, 'pes'],
      Dushanbe: [38.56, 68.79, 'pes'],
      Kandahar: [31.62, 65.72, 'pbu'],
      Peshawar: [34.02, 71.58, 'pbu'],
      Erbil: [36.19, 44.01, 'ckb'],
      Diyarbakir: [37.91, 40.24, 'ckb'],
      Tashkent: [41.3, 69.24, 'uzn'],
      Almaty: [43.24, 76.89, 'kaz'],
      Ulaanbaatar: [47.89, 106.91, 'mon'],
      Hohhot: [40.84, 111.75, 'mon'],
      Urumqi: [43.83, 87.62, 'uig'],
      Beijing: [39.9, 116.41, 'cmn'],
      Chengdu: [30.57, 104.07, 'cmn'],
      Tokyo: [35.68, 139.69, 'jpn'],
      Seoul: [37.57, 126.98, 'kor'],
      Pyongyang: [39.04, 125.76, 'kor'],
      Bangkok: [13.75, 100.5, 'tha'],
      Vientiane: [17.97, 102.6, 'lao'],
      'Phnom Penh': [11.56, 104.92, 'khm'],
      Yangon: [16.87, 96.2, 'mya'],
      Hanoi: [21.03, 105.85, 'vie'],
      Jakarta: [-6.21, 106.85, 'ind'],
      'Kuala Lumpur': [3.14, 101.69, 'zsm'],
      Manila: [14.6, 120.98, 'tgl'],
      Nairobi: [-1.29, 36.82, 'swh'],
      'Dar es Salaam': [-6.79, 39.21, 'swh'],
      Kano: [12.0, 8.52, 'hau'],
      Zinder: [13.8, 8.99, 'hau'],
      Lagos: [6.52, 3.38, 'yor'],
      Mogadishu: [2.05, 45.32, 'som'],
      'Addis Ababa': [9.03, 38.74, 'amh'],
      Asmara: [15.34, 38.93, 'tir'],
      'Cape Town': [-33.92, 18.42, 'afr'],
      Windhoek: [-22.56, 17.08, 'afr'],
      Durban: [-29.86, 31.02, 'zul'],
      Barcelona: [41.39, 2.17, 'cat'],
      Palma: [39.57, 2.65, 'cat'],
      Bilbao: [43.26, -2.93, 'eus'],
    };
    const wrong = [];
    for (const [city, [lat, lng, code]] of Object.entries(cities)) {
      const here = languagesAt({ lat, lng }).map((language) => language.code);
      if (!here.includes(code)) wrong.push(`${city}: ${code} not spoken here, only ${here.join(',') || 'nothing'}`);
      const scored = scoreScriptGuess({ guess: { lat, lng }, language: find(code), ladder: 'world' });
      if (scored.points !== 5000) wrong.push(`${city}: ${code} scored ${scored.points}`);
    }
    expect(wrong).toEqual([]);

    // And the corpus does not claim what it does not have. Cantonese
    // and Cebuano are not in it, so Guangzhou and Cebu speak nothing
    // the game knows, and neither is quietly handed to a neighbour.
    expect(languagesAt({ lat: 23.13, lng: 113.26 }).map((l) => l.code)).toEqual([]);
    expect(languagesAt({ lat: 10.32, lng: 123.89 }).map((l) => l.code)).toEqual([]);
  });

  test('the same ground can speak more than one, and often does', () => {
    const at = (lat, lng) => languagesAt({ lat, lng }).map((language) => language.code).sort();
    expect(at(50.85, 4.35)).toEqual(['fra', 'nld']); // Brussels
    expect(at(43.86, 18.41)).toEqual(['hrv', 'srp']); // Sarajevo
    expect(at(41.39, 2.17)).toEqual(['cat', 'spa']); // Barcelona
    expect(at(43.26, -2.93)).toEqual(['eus', 'spa']); // Bilbao
    expect(at(36.19, 44.01)).toEqual(['arb', 'ckb']); // Erbil
    expect(at(38.08, 46.29)).toEqual(['azj', 'pes']); // Tabriz
    expect(at(34.53, 69.17).sort()).toEqual(['pbu', 'pes']); // Kabul
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
    const varanasi = scoreScriptGuess({ guess: { lat: 25.32, lng: 82.97 }, language: bhojpuri, ladder: 'india' });
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
    // Every region, so the map can draw them all: Tamil Nadu, the two
    // Tamil pieces of Puducherry, and the Sri Lankan north and east. A
    // border is not the edge of a language.
    expect(result.answer.regions.length).toBe(3);
    expect([...new Set(result.answer.regions.map((r) => r.cca2))].sort()).toEqual(['IN', 'LK']);
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
