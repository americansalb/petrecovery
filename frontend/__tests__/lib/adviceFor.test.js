/**
 * Advice on a search screen is the advice engine's, word for word
 * (app/lib/adviceFor.js). The founder's rule of 2026-11-11: nothing is
 * written fresh for a screen. These tests hold the picker to that: every
 * line it returns is text that is in app/lib/petAdvice.js, and the cut
 * into a lead-in and the rest loses nothing.
 */

import { adviceFor, sectionFor, splitAdvice, firstSentence } from '@/app/lib/adviceFor';
import { PetRecoveryAdvice } from '@/app/lib/petAdvice';

const HOUR = 3600000;
const NOW = new Date('2026-11-11T22:00:00Z').getTime();
const ago = (hours) => new Date(NOW - hours * HOUR).toISOString();

/** Every string anywhere in the engine. */
const ENGINE = [];
(function walk(node) {
  if (typeof node === 'string') ENGINE.push(node);
  else if (node && typeof node === 'object') Object.values(node).forEach(walk);
})(PetRecoveryAdvice);
const inEngine = (text) => ENGINE.some((line) => line.includes(text));

describe('sectionFor', () => {
  test('a dog, by how the report says it got out', () => {
    expect(sectionFor({ petSpecies: 'DOG', escapeScenario: 'door_dashed', lastSeenAt: ago(1) }, NOW)).toEqual({ species: 'dog', scenario: 'door_left_open', period: 'less_than_day' });
    expect(sectionFor({ petSpecies: 'DOG', escapeScenario: 'jumped_fence', lastSeenAt: ago(100) }, NOW)).toEqual({ species: 'dog', scenario: 'jumped_fence', period: 'three_to_seven_days' });
    expect(sectionFor({ petSpecies: 'DOG', escapeScenario: 'spooked', lastSeenAt: ago(2) }, NOW)).toMatchObject({ scenario: 'got_spooked', period: 'less_than_day' });
  });

  test('the ways out the engine has no section for use its section for a dog nobody saw leave', () => {
    for (const how of ['off_leash', 'away_from_home', 'taken', 'unknown', undefined]) {
      expect(sectionFor({ petSpecies: 'DOG', escapeScenario: how, lastSeenAt: ago(1) }, NOW)).toEqual({ species: 'dog', scenario: 'unknown', period: 'just_now' });
    }
  });

  test('a dog gone for days gets the advice written for that long, however it got out', () => {
    // An open door and "nobody saw" have only a first day written. On day five they were shown first-hours
    // advice (found on a live search five days old, 2026-11-13). The engine's later days for a dog are
    // written once, under the fence scenario, and are about the time gone, not about fences.
    expect(sectionFor({ petSpecies: 'DOG', escapeScenario: 'door_dashed', lastSeenAt: ago(120) }, NOW)).toEqual({ species: 'dog', scenario: 'jumped_fence', period: 'three_to_seven_days', general: true });
    expect(sectionFor({ petSpecies: 'DOG', lastSeenAt: ago(30) }, NOW)).toMatchObject({ period: 'one_to_three_days', general: true });
    expect(sectionFor({ petSpecies: 'DOG', escapeScenario: 'spooked', lastSeenAt: ago(24 * 10) }, NOW)).toMatchObject({ period: 'one_to_two_weeks', general: true });
    expect(sectionFor({ petSpecies: 'DOG', escapeScenario: 'jumped_fence', lastSeenAt: ago(24 * 30) }, NOW)).toEqual({ species: 'dog', scenario: 'jumped_fence', period: 'more_than_two_weeks' });
    // The first day is still the scenario's own.
    expect(sectionFor({ petSpecies: 'DOG', lastSeenAt: ago(20) }, NOW)).toEqual({ species: 'dog', scenario: 'unknown', period: 'just_now' });
    // The line above the advice does not say a fence was jumped.
    const advice = adviceFor({ petSpecies: 'DOG', lastSeenAt: ago(120) }, NOW);
    expect(advice.source).toBe('ReunitePets advice: a dog, days 3 to 7');
    expect(advice.steps[0].full).toMatch(/^VISIT EVERY SHELTER IN PERSON/);
  });

  test('where nothing is written for this long, the nearest earlier section is used and the line does not name a time', () => {
    const cat = { petSpecies: 'CAT', lastSeenAt: ago(24 * 9) };
    expect(sectionFor(cat, NOW)).toEqual({ species: 'cat', scenario: 'indoor_cat_escaped', period: 'one_to_three_days', stale: true });
    expect(adviceFor(cat, NOW).source).toBe('ReunitePets advice: an indoor cat that got out');
    expect(adviceFor({ petSpecies: 'CAT', lastSeenAt: ago(30) }, NOW).source).toBe('ReunitePets advice: an indoor cat that got out, days 1 to 3');
  });

  test('a cat is indoor unless the report says it goes out', () => {
    expect(sectionFor({ petSpecies: 'CAT', lastSeenAt: ago(30) }, NOW)).toEqual({ species: 'cat', scenario: 'indoor_cat_escaped', period: 'one_to_three_days' });
    expect(sectionFor({ petSpecies: 'CAT', petDescription: 'Grey tabby. Outdoor access.', lastSeenAt: ago(2) }, NOW)).toEqual({ species: 'cat', scenario: 'outdoor_cat_missing', period: 'just_now' });
  });

  test('a bird has its one section, and an animal the engine does not cover has none', () => {
    expect(sectionFor({ petSpecies: 'BIRD', lastSeenAt: ago(1) }, NOW)).toEqual({ species: 'bird', scenario: 'flew_away', period: 'immediate' });
    expect(sectionFor({ petSpecies: 'RABBIT', lastSeenAt: ago(1) }, NOW)).toBeNull();
    expect(sectionFor(null, NOW)).toBeNull();
  });
});

describe('adviceFor', () => {
  const cases = [
    { petSpecies: 'DOG', escapeScenario: 'door_dashed', lastSeenAt: ago(1) },
    { petSpecies: 'DOG', escapeScenario: 'jumped_fence', lastSeenAt: ago(100) },
    { petSpecies: 'DOG', escapeScenario: 'spooked', lastSeenAt: ago(3) },
    { petSpecies: 'DOG', escapeScenario: 'unknown', lastSeenAt: ago(3) },
    { petSpecies: 'CAT', lastSeenAt: ago(3) },
    { petSpecies: 'CAT', lastSeenAt: ago(40) },
    { petSpecies: 'CAT', petDescription: 'Outdoor access', lastSeenAt: ago(3) },
    { petSpecies: 'BIRD', lastSeenAt: ago(1) },
    { petSpecies: 'RABBIT', lastSeenAt: ago(1) },
  ];

  test('every line is in the engine, word for word', () => {
    for (const pet of cases) {
      const advice = adviceFor(pet, NOW);
      expect(advice.steps.length).toBeGreaterThan(0);
      for (const item of [...advice.steps, ...advice.more, ...advice.mistakes]) {
        // A rabbit gets getAdvice's own fallback list, which is in the engine's file but not its tree.
        if (pet.petSpecies !== 'RABBIT' || advice.mistakes.includes(item)) expect(inEngine(item.full)).toBe(true);
        expect(item.rest ? `${item.lead} ${item.rest}`.replace(' - ', ' ') : item.lead).toBeTruthy();
        expect(item.full.startsWith(item.lead)).toBe(true);
        expect(item.full.endsWith(item.rest)).toBe(true);
      }
    }
  });

  test('an open door: the four first steps, in the engine\'s order, and where they come from', () => {
    const advice = adviceFor(cases[0], NOW);
    expect(advice.source).toBe('ReunitePets advice: a dog that ran out an open door, first day');
    expect(advice.steps.map((s) => s.lead)).toEqual([
      'CHECK YOUR ENTIRE HOUSE FIRST',
      'IMMEDIATELY walk your EXACT daily walk route',
      "Check houses where they've received attention, treats, or have dog friends.",
      'Leave your front door WIDE OPEN with something heavy propping it',
    ]);
    expect(advice.steps[0].rest.startsWith("This sounds crazy but many 'door dashing' dogs are actually still inside")).toBe(true);
    expect(advice.more.length).toBeGreaterThan(0);
  });

  test('day four after a fence: dawn and dusk', () => {
    const advice = adviceFor(cases[1], NOW);
    expect(advice.source).toBe('ReunitePets advice: a dog that jumped a fence, days 3 to 7');
    expect(advice.more.some((m) => m.lead === 'SEARCH AT DAWN (5-7am) AND DUSK (7-9pm)')).toBe(true);
  });

  test('the sections getAdvice cannot reach are read from the tree', () => {
    expect(adviceFor(cases[3], NOW).steps[0].lead).toBe('CHECK PROPERTY THOROUGHLY');
    expect(adviceFor(cases[6], NOW).steps[0].lead).toBe('CHECK TERRITORY BOUNDARIES');
    expect(adviceFor(cases[7], NOW).steps[0].lead).toBe('STAY WHERE THEY FLEW FROM');
    expect(adviceFor(cases[7], NOW).source).toBe('ReunitePets advice: a bird that flew away, first hours');
  });

  test('the mistakes are the engine\'s list for every pet, then for the species', () => {
    const dog = adviceFor(cases[0], NOW).mistakes.map((m) => m.full);
    expect(dog[0]).toBe("Don't chase - even friendly pets run when chased");
    expect(dog).toContain("Don't give up at night - many pets move at night");
    expect(dog).toContain("Don't yell angrily - they'll hide");
    const cat = adviceFor(cases[4], NOW).mistakes.map((m) => m.full);
    expect(cat).not.toContain("Don't yell angrily - they'll hide");
  });

  test('an animal the engine does not cover gets its general list, with no made-up section name', () => {
    const advice = adviceFor(cases[8], NOW);
    expect(advice.source).toBe('ReunitePets advice');
    expect(advice.section).toBeNull();
    expect(advice.steps.length).toBeGreaterThan(0);
  });
});

describe('splitAdvice and firstSentence', () => {
  test('cuts at the engine\'s own dash, or after its first sentence, and loses nothing', () => {
    expect(splitAdvice("Don't chase - even friendly pets run when chased")).toEqual({
      lead: "Don't chase",
      rest: 'even friendly pets run when chased',
      full: "Don't chase - even friendly pets run when chased",
    });
    expect(splitAdvice('Check the garage. Then the shed.')).toEqual({ lead: 'Check the garage.', rest: 'Then the shed.', full: 'Check the garage. Then the shed.' });
    expect(splitAdvice('Look for exit points')).toEqual({ lead: 'Look for exit points', rest: '', full: 'Look for exit points' });
    expect(splitAdvice('')).toEqual({ lead: '', rest: '', full: '' });
  });

  test('a dash far into a sentence is not a lead-in', () => {
    const long = `${'word '.repeat(30)}- tail. More.`;
    expect(splitAdvice(long).lead.endsWith('tail.')).toBe(true);
  });

  test('firstSentence is the first sentence, unchanged', () => {
    const item = PetRecoveryAdvice.dog.scenarios.door_left_open.less_than_day.immediate_checklist[0];
    expect(firstSentence(item)).toBe("Call their name in a HAPPY, excited voice - use your 'happy walk time' voice, not your 'you're in trouble' voice.");
    expect(firstSentence('One line')).toBe('One line');
  });
});
