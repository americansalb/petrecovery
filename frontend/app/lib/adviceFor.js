/**
 * The advice for one pet, from the advice engine (app/lib/petAdvice.js),
 * word for word.
 *
 * The founder's rule (2026-11-11): advice wording on a search screen comes
 * from the advice engine and the live searcher's brief, and nothing is
 * written fresh for a screen. So this file writes no advice. It picks the
 * engine's section for the pet (the species, how it got out, how long it
 * has been gone), says which section that is, and cuts each item into the
 * engine's own lead-in and the rest, so a screen can show the lead-in
 * large without rewording anything.
 *
 * It reads the engine's tree itself instead of calling getAdvice, because
 * getAdvice only knows the time keys `less_than_day` and the one it is
 * given: the sections for a dog nobody saw leave (`just_now`), an outdoor
 * cat and a bird are written but can never be reached through it.
 */
import { PetRecoveryAdvice, getAdvice } from './petAdvice';

/** How the report form says a pet got out (app/lib/caseDetails.js), as the engine's dog scenario. */
const DOG_SCENARIO = { door_dashed: 'door_left_open', jumped_fence: 'jumped_fence', spooked: 'got_spooked' };

const CASE_WORDS = {
  'dog.jumped_fence': 'a dog that jumped a fence',
  'dog.door_left_open': 'a dog that ran out an open door',
  'dog.got_spooked': 'a dog that was spooked',
  'dog.unknown': 'a dog nobody saw leave',
  'cat.indoor_cat_escaped': 'an indoor cat that got out',
  'cat.outdoor_cat_missing': 'an outdoor cat that has not come home',
  'bird.flew_away': 'a bird that flew away',
};

const PERIOD_WORDS = {
  just_now: 'first hours',
  immediate: 'first hours',
  less_than_day: 'first day',
  hours_ago: 'some hours on',
  yesterday: 'the day after',
  one_to_three_days: 'days 1 to 3',
  days_ago: 'some days on',
  three_to_seven_days: 'days 3 to 7',
  one_to_two_weeks: 'the second week',
  more_than_two_weeks: 'after two weeks',
};

/** The engine's period keys to try, best first, for how long the pet has been gone. */
function periodOrder(hours) {
  if (hours < 24) return ['less_than_day', 'just_now', 'immediate', 'hours_ago'];
  if (hours < 72) return ['one_to_three_days', 'yesterday', 'days_ago', 'less_than_day', 'hours_ago', 'just_now'];
  if (hours < 168) return ['three_to_seven_days', 'days_ago', 'one_to_three_days', 'yesterday', 'less_than_day', 'just_now'];
  if (hours < 336) return ['one_to_two_weeks', 'three_to_seven_days', 'days_ago', 'one_to_three_days', 'less_than_day', 'just_now'];
  return ['more_than_two_weeks', 'one_to_two_weeks', 'three_to_seven_days', 'days_ago', 'one_to_three_days', 'less_than_day', 'just_now'];
}

/**
 * One item of the engine as its own lead-in and the rest. The engine
 * writes most items as "LEAD-IN - the reasoning", and the others as a
 * first sentence and more; a one-sentence item is all lead-in. Nothing is
 * reworded: lead + rest is the item.
 */
export function splitAdvice(item) {
  const full = String(item || '').trim();
  const dash = full.indexOf(' - ');
  if (dash > 0 && dash < 110) {
    // A dash inside brackets belongs to the aside: the lead-in ends where that bracket opens.
    const before = full.slice(0, dash);
    const open = before.lastIndexOf('(');
    if (open > 1 && open > before.lastIndexOf(')') && full[open - 1] === ' ') {
      return { lead: full.slice(0, open - 1), rest: full.slice(open), full };
    }
    return { lead: before, rest: full.slice(dash + 3), full };
  }
  const stop = full.search(/[.!?]\s/);
  if (stop > 0 && stop < full.length - 2) return { lead: full.slice(0, stop + 1), rest: full.slice(stop + 2), full };
  return { lead: full, rest: '', full };
}

/** The first sentence of an engine item, unchanged, for a screen with room for one line. */
export function firstSentence(item) {
  const full = String(item || '').trim();
  const stop = full.search(/[.!?]\s/);
  return stop > 0 ? full.slice(0, stop + 1) : full;
}

/**
 * Which engine section fits a pet. `pet`: { petSpecies, escapeScenario,
 * petDescription, lastSeenAt }. Returns { species, scenario, period } or
 * null when the engine has no section for this animal.
 */
export function sectionFor(pet, now = Date.now()) {
  const species = String(pet?.petSpecies || '').toLowerCase();
  const tree = PetRecoveryAdvice[species]?.scenarios;
  if (!tree) return null;
  let scenario;
  if (species === 'dog') scenario = DOG_SCENARIO[pet?.escapeScenario] || 'unknown';
  else if (species === 'cat') scenario = /outdoor access/i.test(pet?.petDescription || '') ? 'outdoor_cat_missing' : 'indoor_cat_escaped';
  else scenario = Object.keys(tree)[0];
  const periods = tree[scenario];
  if (!periods) return null;
  const lost = pet?.lastSeenAt ? new Date(pet.lastSeenAt).getTime() : now;
  const hours = Math.max(0, (now - lost) / 3600000);
  const period = periodOrder(hours).find((key) => periods[key]) || Object.keys(periods)[0];
  return period ? { species, scenario, period } : null;
}

/**
 * The advice for a pet: { source, steps, more, mistakes, reassurance }.
 * `steps` are the engine's priority actions for the section, in its
 * order; `more` is its checklist; `mistakes` is its list of mistakes for
 * every pet, then for this species. Each is { lead, rest, full }.
 * `source` says where the words come from, for the line above them.
 */
export function adviceFor(pet, now = Date.now()) {
  const section = sectionFor(pet, now);
  const mistakesOf = (key) => PetRecoveryAdvice.critical_mistakes_to_avoid?.[key] || [];
  const speciesMistakes = section?.species === 'dog' ? mistakesOf('dogs') : section?.species === 'cat' ? mistakesOf('cats') : [];
  const mistakes = [...mistakesOf('all_pets'), ...speciesMistakes].map(splitAdvice);
  if (!section) {
    const fallback = getAdvice(String(pet?.petSpecies || 'pet'), 'unknown', 'less_than_day');
    return { source: 'ReunitePets advice', section: null, steps: (fallback.priority || []).map(splitAdvice), more: [], mistakes, reassurance: fallback.reassurance || '' };
  }
  const body = PetRecoveryAdvice[section.species].scenarios[section.scenario][section.period];
  const more = body.immediate_checklist || body.search_pattern || body.critical_info || body.patterns || body.search_zones || [];
  const words = CASE_WORDS[`${section.species}.${section.scenario}`];
  return {
    source: words ? `ReunitePets advice: ${words}, ${PERIOD_WORDS[section.period] || 'first day'}` : 'ReunitePets advice',
    section,
    steps: (body.priority_actions || []).map(splitAdvice),
    more: more.map(splitAdvice),
    mistakes,
    reassurance: body.reassurance || '',
  };
}
