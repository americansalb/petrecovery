/**
 * The report's questionnaire (app/lib/caseDetails.js, docs/REPORT_QUESTIONNAIRE.md):
 * the answers it keeps, the sentences they produce, and the checklist's progress.
 */

import {
  normalizeDetails,
  isEmptyDetails,
  publicDetails,
  approachLine,
  healthLine,
  needsMedication,
  healthUrgency,
  lookForBits,
  factsBits,
  lureLine,
  placesLine,
  finderGuide,
  petFieldsFromDetails,
  detailsProgress,
  DETAIL_SCREENS,
  TEMPERAMENT_OPTIONS,
  markOptions,
  scamAcknowledgement,
} from '@/app/lib/caseDetails';
import { signDetailsToken, verifyDetailsToken } from '@/app/lib/detailsToken';

describe('normalizeDetails', () => {
  test('keeps only known answers, trims and caps text, and lets "none" clear a list', () => {
    const d = normalizeDetails({
      temperament: 'SCARED',
      approachNote: '  Call   my  mother ' + 'x'.repeat(200),
      fears: ['MEN', 'MEN', 'GHOSTS', 'DOGS'],
      health: ['DIABETIC', 'NONE'],
      collar: 'COLLAR',
      collarColor: 'red',
      tag: 'PHONE',
      leash: 'yes',
      microchip: 'YES',
      microchipNumber: ' 985141000123456 ',
      marks: ['white_chest', 'wings'],
      howOut: 'spooked',
      lure: ['TREATS'],
      places: ['PARK', 'NONE'],
      notes: 42,
      bogus: true,
    });
    expect(d.v).toBe(1);
    expect(d.temperament).toBe('SCARED');
    expect(d.approachNote).toHaveLength(160);
    expect(d.approachNote.startsWith('Call my mother')).toBe(true);
    expect(d.fears).toEqual(['MEN', 'DOGS']);
    expect(d.health).toEqual(['NONE']);
    expect(d.leash).toBe(false);
    expect(d.microchipNumber).toBe('985141000123456');
    expect(d.marks).toEqual(['white_chest']);
    expect(d.places).toEqual(['NONE']);
    expect(d.notes).toBeNull();
    expect(d.bogus).toBeUndefined();
    expect(normalizeDetails(null).temperament).toBeNull();
    expect(normalizeDetails('nope').health).toEqual([]);
  });

  test('empty means nothing answered; the chip number never goes public', () => {
    expect(isEmptyDetails({})).toBe(true);
    expect(isEmptyDetails({ leash: false, fears: [] })).toBe(true);
    expect(isEmptyDetails({ microchip: 'NO' })).toBe(false);
    const pub = publicDetails({ microchip: 'YES', microchipNumber: '985141000123456', sex: 'MALE' });
    expect(pub.microchipNumber).toBeUndefined();
    expect(pub.microchip).toBe('YES');
    expect(publicDetails(null)).toBeNull();
  });
});

describe('the sentences', () => {
  test('the "If you see" line follows the species and the temperament, and the owner can overrule it', () => {
    expect(approachLine({ temperament: 'SCARED' }, { name: 'Max', species: 'DOG' })).toMatch(/^Don't chase, call out or stare\. Max will run\./);
    expect(approachLine({ temperament: 'FRIENDLY' }, { name: 'Max', species: 'DOG' })).toMatch(/^Max is friendly\./);
    expect(approachLine({ temperament: 'SHY' }, { name: 'Milo', species: 'CAT' })).toMatch(/hiding, probably within a few houses/);
    expect(approachLine({}, { name: 'Max', species: 'DOG' })).toBe("Don't chase. A frightened dog runs farther. Note the exact spot and time and call us right away.");
    expect(approachLine({ temperament: 'FRIENDLY' }, { name: 'Kiwi', species: 'BIRD' })).toMatch(/A familiar voice/);
    expect(approachLine({ approachNote: 'he answers to "biscuit"' }, { name: 'Max', species: 'DOG' })).toBe('He answers to "biscuit".');
    expect(approachLine({ temperament: 'SHY', fears: ['MEN', 'DOGS', 'NOISE'] }, { name: 'Max', species: 'DOG' })).toMatch(/Max is afraid of men, other dogs and loud noises\.$/);
    expect(approachLine({ temperament: 'SHY', health: ['ANXIOUS'] }, { name: 'Max', species: 'DOG' })).toMatch(/Max panics easily, so keep calm and quiet\.$/);
    for (const species of Object.keys(TEMPERAMENT_OPTIONS)) {
      for (const o of TEMPERAMENT_OPTIONS[species]) {
        expect(approachLine({ temperament: o.value }, { name: 'Pet', species }).length).toBeGreaterThan(20);
      }
    }
  });

  test('health: medication is urgent and says what and how often', () => {
    expect(healthLine({ health: ['NONE'] }, { name: 'Max' })).toBe('');
    expect(healthLine({ health: ['MEDICATION'] }, { name: 'Max' })).toBe('Needs daily medication. Please call the moment you see Max.');
    expect(healthLine({ health: ['DIABETIC'], healthNote: 'insulin twice a day' }, { name: 'Max' })).toBe('Needs insulin twice a day. Please call the moment you see Max.');
    expect(healthLine({ health: ['SEIZURES', 'DEAF'] }, { name: 'Max' })).toBe("Needs seizure medication. Please call the moment you see Max. Deaf, won't come when called.");
    expect(healthLine({ health: ['OTHER'], healthNote: 'three legs' }, { name: 'Max' })).toBe('Three legs.');
    expect(needsMedication({ health: ['DIABETIC'] })).toBe(true);
    expect(needsMedication({ health: ['BLIND'] })).toBe(false);
    expect(healthUrgency({ health: ['SEIZURES', 'BLIND'] })).toBe('URGENT');
    expect(healthUrgency({ health: ['BLIND'] })).toBe('HIGH');
    expect(healthUrgency({ health: ['ANXIOUS'] })).toBeNull();
    expect(healthUrgency({})).toBeNull();
  });

  test('what to look for: the collar, the leash, the markings', () => {
    expect(lookForBits({ collar: 'COLLAR', collarColor: 'red', tag: 'PHONE', leash: true, marks: ['white_chest', 'one_ear_up'], marksNote: 'scar over the left eye' })).toEqual([
      'Red collar, a tag with our number.',
      'Dragging a leash.',
      'White chest, one ear up. Scar over the left eye.',
    ]);
    expect(lookForBits({ collar: 'NONE' })).toEqual(['No collar.']);
    expect(lookForBits({ collar: 'BOTH', tag: 'NONE' })).toEqual(['Collar and a harness, no tag.']);
    expect(lookForBits({ collar: 'HARNESS', collarColor: 'blue' })).toEqual(['Blue harness.']);
    expect(lookForBits({})).toEqual([]);
  });

  test('facts, what they come to, and where they might go', () => {
    expect(factsBits({ sex: 'MALE', fixed: 'NO', ageBand: 'SENIOR' }, { species: 'DOG' })).toEqual(['Male, not neutered', 'Senior']);
    expect(factsBits({ sex: 'FEMALE', fixed: 'YES', ageBand: 'YOUNG' }, { species: 'CAT' })).toEqual(['Female, spayed', 'Kitten']);
    expect(factsBits({ sex: 'UNKNOWN', ageBand: 'ADULT' }, { species: 'DOG' })).toEqual([]);
    expect(lureLine({ lure: ['NAME', 'TREATS'], lureNote: 'sit, come' })).toBe('Comes to their name and treats or a shaken food bag. Words: sit, come.');
    expect(lureLine({ lure: ['US_ONLY'] })).toBe('Only comes to us, not to strangers.');
    expect(lureLine({})).toBe('');
    expect(placesLine({ places: ['FRIEND', 'PARK'], placesNote: '12 Oak St' })).toBe("May head for a friend's house or the park or their walking route. 12 Oak St.");
    expect(placesLine({ places: ['NONE'] })).toBe('');
  });

  test('the finder guide carries every line the page shows, and the pet row gets its own columns', () => {
    const g = finderGuide({ temperament: 'SCARED', health: ['DIABETIC'], collar: 'COLLAR', collarColor: 'red', microchip: 'YES', howOut: 'spooked', withOtherPet: true, notes: 'Limps on ice.' }, { name: 'Max', species: 'DOG' });
    expect(g.approach).toMatch(/^Don't chase/);
    expect(g.approachKnown).toBe(true);
    expect(g.needsMedication).toBe(true);
    expect(g.health).toMatch(/^Needs insulin\./);
    expect(g.lookFor).toBe('Red collar.');
    expect(g.microchipped).toBe(true);
    expect(g.howOut).toBe('Spooked by fireworks or thunder');
    expect(g.withOtherPet).toBe(true);
    expect(g.notes).toBe('Limps on ice.');
    expect(finderGuide({}, { name: 'Max', species: 'DOG' }).approachKnown).toBe(false);
    expect(petFieldsFromDetails({ collar: 'COLLAR', collarColor: 'red', leash: true, microchipNumber: '98514', marks: ['limp'] })).toEqual({
      collarInfo: 'Red collar.',
      microchipId: '98514',
      distinctiveMarks: 'Limps.',
    });
    expect(petFieldsFromDetails({})).toEqual({ collarInfo: null, microchipId: null, distinctiveMarks: null });
  });
});

describe('the checklist', () => {
  test('counts what was answered, breed included, and lists the rest', () => {
    expect(DETAIL_SCREENS.map((s) => s.id)).toEqual(['collar', 'microchip', 'facts', 'marks', 'howOut', 'lure', 'fears', 'places', 'notes']);
    const none = detailsProgress({});
    expect(none).toEqual({ answered: 0, total: 9, missing: DETAIL_SCREENS.map((s) => s.id) });
    const some = detailsProgress({ collar: 'NONE', fears: ['NONE'], places: ['NONE'], notes: 'x' }, { breed: 'Beagle' });
    expect(some.answered).toBe(5);
    expect(some.missing).toEqual(['microchip', 'marks', 'howOut', 'lure']);
    expect(detailsProgress({}, { breed: 'Unknown' }).answered).toBe(0);
    expect(markOptions('CAT').some((o) => o.value === 'tipped_ear')).toBe(true);
    expect(markOptions('DOG').some((o) => o.value === 'tipped_ear')).toBe(false);
    expect(scamAcknowledgement('Max')).toMatch(/before Max is back in my hands/);
  });
});

describe('the details token', () => {
  const OLD = process.env.NEXTAUTH_SECRET;
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = 'test-secret';
  });
  afterAll(() => {
    process.env.NEXTAUTH_SECRET = OLD;
  });

  test('is good for one case for a day, and for nothing else', () => {
    const t = signDetailsToken('case-max', { now: 1000 });
    expect(verifyDetailsToken(t, 'case-max', { now: 2000 })).toBe(true);
    expect(verifyDetailsToken(t, 'case-other', { now: 2000 })).toBe(false);
    expect(verifyDetailsToken(t, 'case-max', { now: 1000 + 25 * 60 * 60 * 1000 })).toBe(false);
    expect(verifyDetailsToken(`${t}x`, 'case-max', { now: 2000 })).toBe(false);
    expect(verifyDetailsToken('', 'case-max')).toBe(false);
    expect(verifyDetailsToken(null, 'case-max')).toBe(false);
  });

  test('without a secret there is no token and nothing verifies', () => {
    process.env.NEXTAUTH_SECRET = '';
    expect(signDetailsToken('case-max')).toBeNull();
    expect(verifyDetailsToken('1.abc', 'case-max')).toBe(false);
    process.env.NEXTAUTH_SECRET = 'test-secret';
  });
});
