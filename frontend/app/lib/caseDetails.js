/**
 * The lost-pet report's questions, in one place: what the report asks, the
 * answers it allows, and the sentence each answer puts on the flyer, the
 * pet's page and the share images. The plan is docs/REPORT_QUESTIONNAIRE.md.
 *
 * `Case.details` holds the answers as JSON in the shape normalizeDetails()
 * returns. Everything that reads or writes it comes through here: the
 * wizard (app/report/new), the details hub after posting, the create and
 * edit APIs, the public case API, and the renderers
 * (cascade/render/flyers/normalize.js).
 *
 * Pure: no React, no Prisma, so the wizard (client) and the renderers
 * (server) load the same file.
 */

export const DETAILS_VERSION = 1;

const SPECIES = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'];
export function speciesKey(species) {
  const s = String(species || '').toUpperCase();
  return SPECIES.includes(s) ? s : 'OTHER';
}

/* ------------------------------------------------------------ behaviour */

export const TEMPERAMENT_OPTIONS = {
  DOG: [
    { value: 'FRIENDLY', label: 'Friendly', sublabel: 'Goes up to people' },
    { value: 'SHY', label: 'Shy', sublabel: 'Keeps their distance' },
    { value: 'SCARED', label: 'Scared', sublabel: 'Will run or hide' },
    { value: 'DEFENSIVE', label: 'May snap', sublabel: 'Growls or snaps if cornered' },
    { value: 'UNKNOWN', label: 'Not sure' },
  ],
  CAT: [
    { value: 'FRIENDLY', label: 'Friendly', sublabel: 'Lets strangers pet them' },
    { value: 'SHY', label: 'Shy', sublabel: 'Hides from strangers' },
    { value: 'SCARED', label: 'Terrified outside', sublabel: 'Will bolt' },
    { value: 'DEFENSIVE', label: 'May scratch or bite', sublabel: 'If grabbed' },
    { value: 'UNKNOWN', label: 'Not sure' },
  ],
  BIRD: [
    { value: 'FRIENDLY', label: 'Tame', sublabel: 'Steps onto a hand' },
    { value: 'SCARED', label: 'Flies from strangers' },
    { value: 'UNKNOWN', label: 'Not sure' },
  ],
  RABBIT: [
    { value: 'FRIENDLY', label: 'Calm', sublabel: 'Can be picked up' },
    { value: 'SCARED', label: 'Skittish', sublabel: 'Will run' },
    { value: 'DEFENSIVE', label: 'May bite or kick', sublabel: 'When held' },
    { value: 'UNKNOWN', label: 'Not sure' },
  ],
  OTHER: [
    { value: 'FRIENDLY', label: 'Calm', sublabel: 'Can be picked up' },
    { value: 'SCARED', label: 'Skittish', sublabel: 'Will run or hide' },
    { value: 'DEFENSIVE', label: 'May bite', sublabel: 'When held' },
    { value: 'UNKNOWN', label: 'Not sure' },
  ],
};
const TEMPERAMENT_IDS = ['FRIENDLY', 'SHY', 'SCARED', 'DEFENSIVE', 'UNKNOWN'];

/** The "If you see {name}" line, by species and temperament. */
const APPROACH = {
  DOG: {
    SCARED: "Don't chase, call out or stare. {name} will run. Sit or crouch sideways, toss food if you have some, and call us right away with the exact spot.",
    SHY: "Don't chase. Crouch down, speak softly and let {name} come to you. If {name} backs away, stop and call us with the exact spot.",
    FRIENDLY: '{name} is friendly. Say the name, hold out a treat, and take hold of the collar or harness. Then call or text us.',
    DEFENSIVE: "Please don't try to grab {name}, who may snap when frightened. Keep your distance, keep {name} in sight, and call us right away.",
    UNKNOWN: "Don't chase. A frightened dog runs farther. Note the exact spot and time and call us right away.",
  },
  CAT: {
    SCARED: "Don't chase or shout. {name} is hiding, probably within a few houses. Note the exact spot, keep your distance and call us. A cornered cat bolts.",
    SHY: "Don't chase or shout. {name} is hiding, probably within a few houses. Note the exact spot, keep your distance and call us. A cornered cat bolts.",
    FRIENDLY: '{name} is friendly. Crouch, speak softly and let {name} come to you. A carrier or a towel helps. Then call us.',
    DEFENSIVE: "Please don't pick {name} up; scared cats scratch. Keep {name} in sight from a distance and call us.",
    UNKNOWN: "Don't chase. Note the exact spot, keep your distance and call us right away.",
  },
  BIRD: {
    ANY: "Please don't try to grab {name}. Note where {name} perched and call us right away. A familiar voice is what brings {name} down.",
  },
  RABBIT: {
    ANY: "Please don't chase. Note the exact spot, keep your distance and call us right away.",
  },
  OTHER: {
    ANY: "Please don't chase. Note the exact spot, keep your distance and call us right away.",
  },
};

export const FEAR_OPTIONS = [
  { value: 'MEN', label: 'Men' },
  { value: 'CHILDREN', label: 'Children' },
  { value: 'DOGS', label: 'Other dogs' },
  { value: 'CATS', label: 'Cats' },
  { value: 'NOISE', label: 'Loud noises' },
  { value: 'CARS', label: 'Cars' },
  { value: 'NONE', label: 'Nothing in particular' },
];
const FEAR_WORDS = { MEN: 'men', CHILDREN: 'children', DOGS: 'other dogs', CATS: 'cats', NOISE: 'loud noises', CARS: 'cars' };

/* --------------------------------------------------------------- health */

export const HEALTH_OPTIONS = [
  { value: 'NONE', label: 'No, healthy' },
  { value: 'MEDICATION', label: 'Takes medication', urgency: 'URGENT' },
  { value: 'DIABETIC', label: 'Diabetic', urgency: 'URGENT' },
  { value: 'SEIZURES', label: 'Has seizures', urgency: 'URGENT' },
  { value: 'HEART', label: 'Heart condition', urgency: 'HIGH' },
  { value: 'BLIND', label: 'Blind or nearly', urgency: 'HIGH' },
  { value: 'DEAF', label: 'Deaf', urgency: 'HIGH' },
  { value: 'SENIOR', label: 'Old and frail', urgency: 'HIGH' },
  { value: 'INJURED', label: 'Injured or just had surgery', urgency: 'URGENT' },
  { value: 'ANXIOUS', label: 'Anxiety, panics easily' },
  { value: 'PREGNANT', label: 'Pregnant or nursing', urgency: 'URGENT' },
  { value: 'OTHER', label: 'Something else' },
];
const HEALTH_IDS = HEALTH_OPTIONS.map((o) => o.value);
const MEDICATION_IDS = ['MEDICATION', 'DIABETIC', 'SEIZURES'];
const HEALTH_WORDS = {
  HEART: 'Heart condition.',
  BLIND: 'Blind, may walk into traffic.',
  DEAF: "Deaf, won't come when called.",
  SENIOR: 'Old and frail.',
  INJURED: 'Injured.',
  PREGNANT: 'Pregnant or nursing.',
};

/* -------------------------------------------------------- identification */

export const COLLAR_OPTIONS = [
  { value: 'NONE', label: 'No collar' },
  { value: 'COLLAR', label: 'A collar' },
  { value: 'HARNESS', label: 'A harness' },
  { value: 'BOTH', label: 'Collar and harness' },
];
export const COLLAR_COLORS = ['red', 'blue', 'black', 'pink', 'purple', 'green', 'brown', 'yellow', 'orange', 'white or grey', 'patterned'];
export const TAG_OPTIONS = [
  { value: 'PHONE', label: 'A tag with our phone number' },
  { value: 'NAME', label: 'A tag with the name only' },
  { value: 'NONE', label: 'No tag' },
];
export const YES_NO_UNKNOWN = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'UNKNOWN', label: 'Not sure' },
];
const YNU_IDS = ['YES', 'NO', 'UNKNOWN'];
export const SEX_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'UNKNOWN', label: 'Not sure' },
];
export function ageOptions(species) {
  const sp = speciesKey(species);
  const young = sp === 'DOG' ? 'Puppy' : sp === 'CAT' ? 'Kitten' : 'Young';
  return [
    { value: 'YOUNG', label: young, sublabel: 'Under a year' },
    { value: 'ADULT', label: 'Adult' },
    { value: 'SENIOR', label: 'Senior', sublabel: '8 and up' },
  ];
}

const MARKS = {
  DOG: [
    ['white_chest', 'White chest'],
    ['white_paws', 'White paws or socks'],
    ['white_tail_tip', 'White tip on the tail'],
    ['one_ear_up', 'One ear up'],
    ['floppy_ears', 'Floppy ears'],
    ['cropped_ears', 'Cropped ears'],
    ['docked_tail', 'Docked tail'],
    ['curly_tail', 'Curly tail'],
    ['scar', 'A scar'],
    ['limp', 'Limps'],
    ['missing_teeth', 'Missing teeth'],
    ['grey_muzzle', 'Grey muzzle'],
    ['overweight', 'Overweight'],
    ['thin', 'Very thin'],
    ['clothes', 'Wearing clothes'],
  ],
  CAT: [
    ['white_chest', 'White chest'],
    ['white_paws', 'White paws'],
    ['tipped_ear', 'Tipped or notched ear'],
    ['bob_tail', 'Bob tail'],
    ['extra_toes', 'Extra toes'],
    ['fluffy_tail', 'Fluffy tail'],
    ['scar', 'A scar'],
    ['limp', 'Limps'],
    ['missing_teeth', 'Missing teeth'],
    ['one_eye', 'One eye'],
    ['odd_eyes', 'Two eye colours'],
  ],
  BIRD: [
    ['leg_band', 'A band on a leg'],
    ['clipped_wings', 'Clipped wings'],
    ['missing_feathers', 'Missing feathers'],
  ],
  RABBIT: [
    ['lop_ears', 'Lop ears'],
    ['one_ear_up', 'One ear up'],
    ['white_paws', 'White paws'],
    ['scar', 'A scar'],
    ['limp', 'Limps'],
  ],
  OTHER: [
    ['white_chest', 'White chest'],
    ['white_paws', 'White paws'],
    ['scar', 'A scar'],
    ['limp', 'Limps'],
    ['missing_teeth', 'Missing teeth'],
  ],
};
const MARK_LABELS = Object.fromEntries(Object.values(MARKS).flat());
const MARK_IDS = Object.keys(MARK_LABELS);
export function markOptions(species) {
  return MARKS[speciesKey(species)].map(([value, label]) => ({ value, label }));
}

/* --------------------------------------------------- the day it happened */

export const HOW_OUT_OPTIONS = [
  { value: 'door_dashed', label: 'Dashed out a door' },
  { value: 'jumped_fence', label: 'Jumped a fence' },
  { value: 'off_leash', label: 'Slipped a collar or leash' },
  { value: 'spooked', label: 'Spooked by fireworks or thunder' },
  { value: 'away_from_home', label: 'Away from home', sublabel: 'From a car, the vet, boarding, a trip' },
  { value: 'taken', label: 'Someone may have taken them' },
  { value: 'unknown', label: 'Not sure' },
];
const HOW_OUT_IDS = HOW_OUT_OPTIONS.map((o) => o.value);

export const LURE_OPTIONS = [
  { value: 'NAME', label: 'Their name' },
  { value: 'TREATS', label: 'Treats or a shaken food bag' },
  { value: 'TOY', label: 'A squeaky toy' },
  { value: 'WHISTLE', label: 'A whistle or clicker' },
  { value: 'CAR', label: 'A car door opening' },
  { value: 'US_ONLY', label: 'Only us, not strangers' },
];
const LURE_WORDS = { NAME: 'their name', TREATS: 'treats or a shaken food bag', TOY: 'a squeaky toy', WHISTLE: 'a whistle or clicker', CAR: 'a car door opening' };

export const PLACE_OPTIONS = [
  { value: 'FRIEND', label: "A friend's or family home" },
  { value: 'OLD_HOME', label: 'Their old home' },
  { value: 'PARK', label: 'A park or walking route' },
  { value: 'VET', label: 'Our vet or groomer' },
  { value: 'SHOP', label: 'A school or shop they love' },
  { value: 'NONE', label: 'Nowhere I can think of' },
];
const PLACE_WORDS = { FRIEND: "a friend's house", OLD_HOME: 'their old home', PARK: 'the park or their walking route', VET: 'the vet or groomer', SHOP: 'a school or shop they love' };

const ids = (opts) => opts.map((o) => o.value);

/* ------------------------------------------------------------- the shape */

/**
 * The stored shape, from anything a client sent. Unknown keys and values
 * are dropped, text is trimmed and capped, lists are deduplicated, and
 * "none" answers clear the rest of their list.
 */
export function normalizeDetails(input) {
  const d = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const one = (v, allowed) => (typeof v === 'string' && allowed.includes(v) ? v : null);
  const many = (v, allowed, none) => {
    const list = Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && allowed.includes(x)))] : [];
    return none && list.includes(none) ? [none] : list;
  };
  const text = (v, max) => {
    const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
    return t ? t.slice(0, max) : null;
  };
  const bool = (v) => v === true;
  return {
    v: DETAILS_VERSION,
    temperament: one(d.temperament, TEMPERAMENT_IDS),
    approachNote: text(d.approachNote, 160),
    fears: many(d.fears, ids(FEAR_OPTIONS), 'NONE'),
    health: many(d.health, HEALTH_IDS, 'NONE'),
    healthNote: text(d.healthNote, 120),
    collar: one(d.collar, ids(COLLAR_OPTIONS)),
    collarColor: one(d.collarColor, COLLAR_COLORS),
    tag: one(d.tag, ids(TAG_OPTIONS)),
    leash: bool(d.leash),
    microchip: one(d.microchip, YNU_IDS),
    microchipCurrent: one(d.microchipCurrent, YNU_IDS),
    microchipNumber: text(d.microchipNumber, 24),
    sex: one(d.sex, ids(SEX_OPTIONS)),
    fixed: one(d.fixed, YNU_IDS),
    ageBand: one(d.ageBand, ['YOUNG', 'ADULT', 'SENIOR']),
    marks: many(d.marks, MARK_IDS),
    marksNote: text(d.marksNote, 160),
    howOut: one(d.howOut, HOW_OUT_IDS),
    withOtherPet: bool(d.withOtherPet),
    lure: many(d.lure, ids(LURE_OPTIONS)),
    lureNote: text(d.lureNote, 80),
    places: many(d.places, ids(PLACE_OPTIONS), 'NONE'),
    placesNote: text(d.placesNote, 160),
    notes: text(d.notes, 300),
  };
}

/** True when nothing was answered. */
export function isEmptyDetails(details) {
  const d = normalizeDetails(details);
  return Object.entries(d).every(([k, v]) => k === 'v' || v === null || v === false || (Array.isArray(v) && v.length === 0));
}

/** The shape with the one private field removed: the chip number is for the registry, not the public. */
export function publicDetails(details) {
  if (!details) return null;
  const { microchipNumber, ...rest } = normalizeDetails(details);
  return rest;
}

/* ------------------------------------------------------------ sentences */

const fill = (s, name) => s.replaceAll('{name}', name);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const list = (words) => (words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);
const endStop = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);

/** "{name} is afraid of men and other dogs." or ''. */
export function fearsLine(details, { name = 'this pet' } = {}) {
  const d = normalizeDetails(details);
  const words = d.fears.filter((f) => FEAR_WORDS[f]).map((f) => FEAR_WORDS[f]);
  return words.length ? `${name} is afraid of ${list(words)}.` : '';
}

/**
 * The "If you see {name}" line: the owner's own words when they wrote
 * some, else the line for the species and temperament, plus the fears.
 */
export function approachLine(details, { name = 'this pet', species } = {}) {
  const d = normalizeDetails(details);
  const sp = speciesKey(species);
  let line;
  if (d.approachNote) {
    line = endStop(cap(d.approachNote));
  } else {
    const table = APPROACH[sp];
    line = fill(table[d.temperament || 'UNKNOWN'] || table.ANY || APPROACH.OTHER.ANY, name);
  }
  const fears = fearsLine(d, { name });
  if (fears) line = `${line} ${fears}`;
  if (d.health.includes('ANXIOUS') && !d.approachNote) line = `${line} ${name} panics easily, so keep calm and quiet.`;
  return line;
}

export function needsMedication(details) {
  const d = normalizeDetails(details);
  return d.health.some((h) => MEDICATION_IDS.includes(h));
}

/** 'URGENT', 'HIGH' or null: how the health answers change the case's priority. */
export function healthUrgency(details) {
  const d = normalizeDetails(details);
  const levels = d.health.map((h) => HEALTH_OPTIONS.find((o) => o.value === h)?.urgency).filter(Boolean);
  if (levels.includes('URGENT')) return 'URGENT';
  if (levels.includes('HIGH')) return 'HIGH';
  return null;
}

/** "Needs insulin twice a day. Please call the moment you see Max. Deaf, won't come when called." or ''. */
export function healthLine(details, { name = 'this pet' } = {}) {
  const d = normalizeDetails(details);
  const parts = [];
  if (needsMedication(d)) {
    const what = d.healthNote
      ? d.healthNote
      : d.health.includes('DIABETIC')
        ? 'insulin'
        : d.health.includes('SEIZURES')
          ? 'seizure medication'
          : 'daily medication';
    parts.push(`Needs ${what.replace(/\.$/, '')}. Please call the moment you see ${name}.`);
  }
  for (const h of d.health) if (HEALTH_WORDS[h]) parts.push(HEALTH_WORDS[h]);
  if (d.health.includes('OTHER') && d.healthNote && !needsMedication(d)) parts.push(endStop(cap(d.healthNote)));
  return parts.join(' ');
}

/** "Red collar, a tag with our number." and "Dragging a leash." as separate sentences. */
export function collarBits(details) {
  const d = normalizeDetails(details);
  const out = [];
  if (d.collar === 'NONE') out.push('No collar.');
  else if (d.collar) {
    const color = d.collarColor ? `${d.collarColor} ` : '';
    const worn = d.collar === 'COLLAR' ? 'collar' : d.collar === 'HARNESS' ? 'harness' : 'collar and a harness';
    const tag = d.tag === 'PHONE' ? ', a tag with our number' : d.tag === 'NAME' ? ', a name tag' : d.tag === 'NONE' ? ', no tag' : '';
    out.push(cap(`${color}${worn}${tag}.`));
  }
  if (d.leash) out.push('Dragging a leash.');
  return out;
}

/** "White chest, one ear up, limps. Scar over the left eye." or ''. */
export function marksLine(details) {
  const d = normalizeDetails(details);
  const words = d.marks.map((m) => MARK_LABELS[m]).filter(Boolean).map((w) => w.toLowerCase());
  const parts = [];
  if (words.length) parts.push(cap(`${words.join(', ')}.`));
  if (d.marksNote) parts.push(endStop(cap(d.marksNote)));
  return parts.join(' ');
}

/** What to look for, as sentences: the collar, the leash, the markings. */
export function lookForBits(details) {
  const m = marksLine(details);
  return [...collarBits(details), ...(m ? [m] : [])];
}

/** ["Male, neutered", "Senior"]: short facts for a facts line. */
export function factsBits(details, { species } = {}) {
  const d = normalizeDetails(details);
  const sp = speciesKey(species);
  const out = [];
  if (d.sex === 'MALE' || d.sex === 'FEMALE') {
    const fixedWord = d.sex === 'MALE' ? 'neutered' : 'spayed';
    const fixed = d.fixed === 'YES' ? `, ${fixedWord}` : d.fixed === 'NO' ? `, not ${fixedWord}` : '';
    out.push(`${d.sex === 'MALE' ? 'Male' : 'Female'}${fixed}`);
  }
  if (d.ageBand === 'YOUNG') out.push(sp === 'DOG' ? 'Puppy' : sp === 'CAT' ? 'Kitten' : 'Under a year old');
  else if (d.ageBand === 'SENIOR') out.push('Senior');
  return out;
}

/** "Comes to their name and a shaken treat bag. Words: sit, come." or ''. */
export function lureLine(details) {
  const d = normalizeDetails(details);
  const words = d.lure.filter((l) => LURE_WORDS[l]).map((l) => LURE_WORDS[l]);
  const parts = [];
  if (words.length) parts.push(`Comes to ${list(words)}.`);
  else if (d.lure.includes('US_ONLY')) parts.push('Only comes to us, not to strangers.');
  if (words.length && d.lure.includes('US_ONLY')) parts.push('Only for us, not for strangers.');
  if (d.lureNote) parts.push(`Words: ${d.lureNote.replace(/\.$/, '')}.`);
  return parts.join(' ');
}

/** "May head for a friend's house or the park. 12 Oak St." or ''. */
export function placesLine(details) {
  const d = normalizeDetails(details);
  const words = d.places.filter((p) => PLACE_WORDS[p]).map((p) => PLACE_WORDS[p]);
  const parts = [];
  if (words.length) parts.push(`May head for ${words.length <= 1 ? words[0] : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`}.`);
  if (d.placesNote) parts.push(endStop(cap(d.placesNote)));
  return parts.join(' ');
}

export function howOutLabel(details) {
  const d = normalizeDetails(details);
  return HOW_OUT_OPTIONS.find((o) => o.value === d.howOut)?.label || '';
}

/**
 * Everything a finder should know, as strings, for the pet's page and the
 * public API. Empty strings where nothing was answered.
 */
export function finderGuide(details, { name = 'this pet', species } = {}) {
  const d = normalizeDetails(details);
  const answeredBehaviour = Boolean(d.temperament || d.approachNote);
  return {
    approach: approachLine(d, { name, species }),
    approachKnown: answeredBehaviour,
    health: healthLine(d, { name }),
    needsMedication: needsMedication(d),
    lookFor: lookForBits(d).join(' '),
    facts: factsBits(d, { species }),
    microchipped: d.microchip === 'YES',
    lure: lureLine(d),
    places: placesLine(d),
    howOut: howOutLabel(d),
    withOtherPet: d.withOtherPet,
    notes: d.notes || '',
  };
}

/** The Pet row's own columns, from the answers, so a saved pet stays in step. */
export function petFieldsFromDetails(details) {
  const d = normalizeDetails(details);
  const collar = collarBits(d).filter((s) => s !== 'Dragging a leash.').join(' ');
  return {
    collarInfo: collar || null,
    microchipId: d.microchipNumber || null,
    distinctiveMarks: marksLine(d) || null,
  };
}

/* ------------------------------------------------------- the checklist */

/** The optional screens, in the order the checklist shows them. */
export const DETAIL_SCREENS = [
  { id: 'collar', label: 'Collar and tags', question: (n) => `What is ${n} wearing?` },
  { id: 'microchip', label: 'Microchip', question: (n) => `Is ${n} microchipped?` },
  { id: 'facts', label: 'Sex, age, breed', question: (n) => `A few facts about ${n}` },
  { id: 'marks', label: 'Markings', question: (n) => `What makes ${n} easy to pick out?` },
  { id: 'howOut', label: 'How they got out', question: (n) => `How did ${n} get out?` },
  { id: 'lure', label: 'What they come to', question: (n) => `What does ${n} come to?` },
  { id: 'fears', label: 'Fears', question: (n) => `Is ${n} afraid of anything?` },
  { id: 'places', label: 'Places they know', question: (n) => `Places ${n} knows nearby` },
  { id: 'notes', label: 'Anything else', question: () => 'Anything else a finder should know?' },
];

/** Whether one checklist screen has an answer. */
export function screenAnswered(id, details, { breed } = {}) {
  const d = normalizeDetails(details);
  switch (id) {
    case 'collar':
      return d.collar !== null;
    case 'microchip':
      return d.microchip !== null;
    case 'facts':
      return Boolean(d.sex || d.fixed || d.ageBand || (breed && breed !== 'Unknown'));
    case 'marks':
      return d.marks.length > 0 || Boolean(d.marksNote);
    case 'howOut':
      return d.howOut !== null;
    case 'lure':
      return d.lure.length > 0 || Boolean(d.lureNote);
    case 'fears':
      return d.fears.length > 0;
    case 'places':
      return d.places.length > 0 || Boolean(d.placesNote);
    case 'notes':
      return Boolean(d.notes);
    default:
      return false;
  }
}

/** { answered, total, missing: [ids] } for the checklist's progress line. */
export function detailsProgress(details, { breed } = {}) {
  const missing = DETAIL_SCREENS.filter((s) => !screenAnswered(s.id, details, { breed })).map((s) => s.id);
  return { answered: DETAIL_SCREENS.length - missing.length, total: DETAIL_SCREENS.length, missing };
}

/* --------------------------------------------------------------- reward */

/** The amounts the reward screen offers. null means "yes, but don't print an amount". */
export const REWARD_AMOUNTS = [100, 250, 500, 1000];

/** The note the owner ticks before offering a reward (stored as rewardScamAcknowledgedAt). */
export function scamAcknowledgement(name = 'my pet') {
  return `I know how reward scams work. I will not pay anyone anything before ${name} is back in my hands. People will claim to have ${name}, send photos (some made with AI), and ask for money, gift cards or a "transport fee". I will report those messages instead of paying.`;
}

/** The warning everyone gets after posting, reward or not. */
export const SCAM_WARNING = [
  'Anyone who asks for money, gift cards or a "transport fee" before your pet is back in your hands is a scammer. Every time.',
  'Photos prove nothing. Scammers reuse your own photos and make new ones with AI. Ask for a video call with the pet, or meet in a public place.',
  'Never pay a reward before the pet is physically with you.',
];
