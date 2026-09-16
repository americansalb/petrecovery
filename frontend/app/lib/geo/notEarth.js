/**
 * Not Earth: the rare round that is not on this planet.
 *
 * About one round in two hundred of casual play drops you somewhere no
 * car has ever driven. Every round carries a "Not Earth" button. Press
 * it on one of these and you get full marks and a badge; press it on an
 * ordinary round and you have thrown that round away. That is the whole
 * game inside the game, and it is why the Atacama and Iceland rounds
 * suddenly matter.
 *
 * The pictures are real. They are NASA panoramas taken by Apollo
 * astronauts and by the Mars rovers, in the public domain, served from
 * our own /public. Nothing here is generated, and nothing here is a
 * painting of a place that does not exist (founder direction,
 * 2026-09-16: real NASA panoramas, not AI made-up ones).
 *
 * Pure data and pure functions. Safe on the client, which needs the
 * picture to show it and the credit to print under the reveal.
 */

import { createRng, roundSeed } from './random';

/** Roughly one round in two hundred. */
export const NOT_EARTH_CHANCE = 0.005;

/**
 * The modes that can serve one.
 *
 * Listed rather than excluded, so a mode added later has to be added
 * here on purpose. Ranked, the daily and the cup are all shared boards
 * played for a rating, and a 1-in-200 surprise is not something to put
 * in a rated set: two players on the "same" five places would be asked
 * different questions in the same seat.
 */
export const NOT_EARTH_MODES = Object.freeze(['balanced', 'continent', 'country', 'streak']);

/**
 * The worlds, as the badge and the reveal name them.
 *
 * `code` is what goes in the GeoBadge row's countryCode column. XM and
 * XL are in the ISO 3166-1 user-assigned range (XA to XZ), which is
 * exactly what it is for: no real country will ever claim them, so a
 * Mars badge can sit in the same table as a France badge without a
 * migration on the database the pet site shares.
 */
export const BODIES = Object.freeze({
  mars: Object.freeze({ id: 'mars', code: 'XM', name: 'Mars', sentence: 'Mars', flag: '🔴' }),
  // `name` heads a badge, `sentence` sits inside one: "That was the
  // Moon", not "That was The Moon".
  moon: Object.freeze({ id: 'moon', code: 'XL', name: 'The Moon', sentence: 'the Moon', flag: '🌕' }),
});

/**
 * The panoramas. Each one was checked against the NASA image library on
 * 2026-09-16 and the file in /public is the copy that was downloaded
 * then, so a round never waits on a third party mid-game.
 *
 * The files are numbered rather than named, and they sit in
 * /geo/scenery rather than anywhere that says Mars. The browser has to
 * fetch the picture to show it, so whatever the file is called is in
 * the network tab of every player who opens one, and a filename reading
 * moon-tranquility-base.jpg would answer the round before the picture
 * had finished decoding.
 *
 * `note` is one plain sentence for the reveal. `credit` is NASA's own
 * credit line, printed as given.
 *
 * `start` is where the round opens, as a fraction across the panorama.
 * Several of these are mosaics with the rover's own deck left unimaged,
 * which comes out as a black wedge, and one of them would otherwise
 * fill a third of the first screen a player sees. The numbers are
 * measured rather than guessed: the centre of the widest screenful with
 * the least missing data in it. On the Apollo pictures the black is the
 * lunar sky and is left alone.
 */
export const NOT_EARTH_PLACES = Object.freeze([
  {
    id: 'mars-jezero-mastcam-z',
    body: 'mars',
    title: 'Jezero Crater, Mars',
    src: '/geo/scenery/01.jpg',
    start: 0.59,
    width: 1920,
    height: 509,
    mission: 'Perseverance, Mastcam-Z',
    taken: '21 February 2021',
    note: 'The first 360-degree panorama Perseverance sent home, stitched on Earth from 142 frames taken on its third Martian day.',
    credit: 'NASA/JPL-Caltech/MSSS/ASU',
    nasaId: 'PIA24264',
  },
  {
    id: 'mars-jezero-delta',
    body: 'mars',
    title: "Jezero Crater's river delta, Mars",
    src: '/geo/scenery/02.jpg',
    start: 0.75,
    width: 1920,
    height: 538,
    mission: 'Perseverance, Mastcam-Z',
    taken: '14 September 2022',
    note: 'A 2.5-billion-pixel mosaic of 1,118 frames, looking at rock a river laid down billions of years ago.',
    credit: 'NASA/JPL-Caltech/ASU/MSSS',
    nasaId: 'PIA24921',
  },
  {
    id: 'mars-naukluft-plateau',
    body: 'mars',
    title: 'Naukluft Plateau, Gale Crater, Mars',
    src: '/geo/scenery/03.jpg',
    start: 0.67,
    width: 1920,
    height: 441,
    mission: 'Curiosity, Mastcam',
    taken: '4 April 2016',
    note: 'A mid-afternoon full circle from the sandstone plateau Curiosity spent a month crossing.',
    credit: 'NASA/JPL-Caltech/MSSS',
    nasaId: 'PIA20332',
  },
  {
    id: 'mars-gale-crater',
    body: 'mars',
    title: 'Gale Crater, Mars',
    src: '/geo/scenery/04.jpg',
    start: 0.55,
    width: 3653,
    height: 755,
    mission: 'Curiosity, Mast Camera',
    taken: '9 August 2012',
    note: "Curiosity's first colour look around its landing site, three days after it arrived.",
    credit: 'NASA/JPL-Caltech/MSSS',
    nasaId: 'PIA16029',
  },
  {
    id: 'mars-marathon-valley',
    body: 'mars',
    title: 'Marathon Valley, Endeavour Crater, Mars',
    src: '/geo/scenery/05.jpg',
    start: 0.46,
    width: 1920,
    height: 656,
    mission: 'Opportunity, Pancam',
    taken: 'April to May 2016',
    note: 'The valley opens onto the floor of a crater 22 km across. Opportunity had been driving for 4,375 Martian days by then.',
    credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
    nasaId: 'PIA20749',
  },
  {
    id: 'mars-mcmurdo-low-ridge',
    body: 'mars',
    title: 'Low Ridge, Gusev Crater, Mars',
    src: '/geo/scenery/06.jpg',
    start: 0.25,
    width: 1919,
    height: 543,
    mission: 'Spirit, Pancam',
    taken: 'April to October 2006',
    note: 'The McMurdo panorama, shot over six months while Spirit sat out the Martian winter on a slope that kept its solar panels in the sun.',
    credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
    nasaId: 'PIA16440',
  },
  {
    id: 'moon-tranquility-base',
    body: 'moon',
    title: 'Tranquility Base, the Moon',
    src: '/geo/scenery/07.jpg',
    start: 0.5,
    width: 1920,
    height: 547,
    mission: 'Apollo 11',
    taken: '20 July 1969',
    note: 'Neil Armstrong shot the frames for this from beside the lander, looking at a crater he had picked out on the way down.',
    credit: 'NASA',
    nasaId: 'jsc2008e040725',
  },
  {
    id: 'moon-hadley-rille',
    body: 'moon',
    title: 'Hadley Rille, the Moon',
    src: '/geo/scenery/08.jpg',
    start: 0.31,
    width: 1920,
    height: 665,
    mission: 'Apollo 15',
    taken: '31 July 1971',
    note: 'David Scott at the rover on the edge of a canyon cut by lava, photographed by James Irwin on the first moonwalk of the mission.',
    credit: 'NASA',
    nasaId: 'jsc2011e118359',
  },
  {
    id: 'moon-mount-hadley',
    body: 'moon',
    title: 'Mount Hadley, the Moon',
    src: '/geo/scenery/09.jpg',
    start: 0.35,
    width: 1920,
    height: 747,
    mission: 'Apollo 15',
    taken: '2 August 1971',
    note: 'Station 8 on the third moonwalk, under a mountain that stands 4.5 km above the plain.',
    credit: 'NASA',
    nasaId: 'jsc2011e118360',
  },
  {
    id: 'moon-descartes-rover',
    body: 'moon',
    title: 'Descartes Highlands, the Moon',
    src: '/geo/scenery/10.jpg',
    start: 0.7,
    width: 1920,
    height: 648,
    mission: 'Apollo 16',
    taken: '21 April 1972',
    note: 'John Young at the rover, about to unload the experiment package, on the first moonwalk of the mission.',
    credit: 'NASA',
    nasaId: 'jsc2011e118363',
  },
]);

const BY_ID = new Map(NOT_EARTH_PLACES.map((place) => [place.id, place]));
const BY_CODE = new Map(Object.values(BODIES).map((body) => [body.code, body]));

export function notEarthPlace(id) {
  return BY_ID.get(String(id || '')) || null;
}

/** The world a badge code names, for the profile page. Null for a country. */
export function bodyByCode(code) {
  return BY_CODE.get(String(code || '').toUpperCase()) || null;
}

export function bodyOf(place) {
  return BODIES[place?.body] || null;
}

/** May this mode serve a Not Earth round at all? */
export function notEarthAllowed(config) {
  return NOT_EARTH_MODES.includes(config?.mode);
}

/**
 * The Not Earth place for a round, or null for an ordinary one.
 *
 * Seeded games draw from the seed, so a challenge link surprises
 * everyone who opens it in the same place. Unseeded games draw fresh.
 */
export function notEarthFor({ config, roundIndex = 0, rng = null } = {}) {
  if (!notEarthAllowed(config)) return null;
  const seed = config?.seed ? `${roundSeed(config.seed, roundIndex)}:not-earth` : undefined;
  const draw = rng || createRng(seed);
  if (draw() >= NOT_EARTH_CHANCE) return null;
  return NOT_EARTH_PLACES[Math.floor(draw() * NOT_EARTH_PLACES.length)] || NOT_EARTH_PLACES[0];
}

/**
 * What the browser is given when the round starts: the picture and
 * nothing else. Not even the id, which reads `moon-hadley-rille`. The
 * title, the mission and the credit are the answer, so they wait for
 * the reveal; the server keeps the id in the sealed token.
 */
export function playablePlace(place) {
  if (!place) return null;
  return { src: place.src, width: place.width, height: place.height, start: place.start ?? 0.5 };
}

/** What the reveal prints once the round is scored. */
export function revealPlace(place) {
  if (!place) return null;
  const body = bodyOf(place);
  return {
    id: place.id,
    src: place.src,
    width: place.width,
    height: place.height,
    title: place.title,
    body: body?.name || '',
    bodyInSentence: body?.sentence || body?.name || '',
    flag: body?.flag || '',
    mission: place.mission,
    taken: place.taken,
    note: place.note,
    credit: place.credit,
    nasaId: place.nasaId,
    nasaUrl: `https://images.nasa.gov/details/${place.nasaId}`,
  };
}
