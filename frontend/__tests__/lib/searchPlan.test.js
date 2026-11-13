/**
 * The plan follows the animal, and the search has tasks of its own.
 *
 * Founder, 2026-11-13: "A real search and rescue team would find this
 * superficial and comical ... You are not trying hard enough to put
 * yourselves in the shoes of the complex S&R team". A team does not run
 * the same search for every subject.
 */
import fs from 'fs';
import path from 'path';
import { planFor, taskOf, dueCheck, TASK_KINDS, KEPT_KINDS, CHECK_EVERY_HOURS } from '@/app/lib/searchPlan';

const read = (file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
const NOW = new Date('2026-11-13T18:00:00Z').getTime();
const ago = (hours) => new Date(NOW - hours * 3600000).toISOString();

describe('which tactics come first for which animal', () => {
  test('a scared, shy or snappy dog: flyers and calls, then a feeding station, a camera and a trap, with few people on foot', () => {
    for (const temperament of ['SCARED', 'SHY', 'DEFENSIVE']) {
      const plan = planFor({ species: 'DOG', temperament, name: 'Max' });
      expect(plan.animal).toBe('DOG_WARY');
      expect(plan.order.slice(0, 5)).toEqual(['FLYERS', 'CALLS', 'STATION', 'CAMERA', 'TRAP']);
      expect(plan.about).toMatch(/runs from strangers, so sightings, a feeding station and a trap do more than people on foot\./);
      expect(plan.footNote).toBe('Keep the people out looking few. They do not call Max or walk toward Max.');
    }
    expect(planFor({ species: 'DOG', temperament: 'SCARED', name: 'Max' }).about).toMatch(/^Max is scared\./);
    expect(planFor({ species: 'DOG', temperament: 'DEFENSIVE', name: 'Max' }).about).toMatch(/^Max is likely to snap\./);
  });

  test('a dog nobody has described is treated as one that may run from strangers, and the plan says so', () => {
    const plan = planFor({ species: 'DOG', temperament: 'UNKNOWN', name: 'Max' });
    expect(plan.animal).toBe('DOG_WARY');
    expect(plan.about).toMatch(/^Nobody has said how Max is with strangers, so the search treats Max as a dog that may run from them\./);
  });

  test('a friendly dog: flyers, door to door and calls come first, and helpers may say the name', () => {
    const plan = planFor({ species: 'DOG', temperament: 'FRIENDLY', name: 'Max' });
    expect(plan.animal).toBe('DOG_FRIENDLY');
    expect(plan.order.slice(0, 3)).toEqual(['FLYERS', 'DOORS', 'CALLS']);
    expect(plan.footNote).toMatch(/can say Max's name in a calm voice/);
  });

  test('a cat: the nearest yards, sheds and garages before anything further off', () => {
    const plan = planFor({ species: 'CAT', temperament: 'SCARED', name: 'Milo' });
    expect(plan.animal).toBe('CAT');
    expect(plan.order[0]).toBe('DOORS');
    expect(plan.about).toMatch(/hides close by and stays silent/);
  });

  test('every plan lists only tasks the site knows, each once, and promises nothing', () => {
    for (const pet of [{ species: 'DOG', temperament: 'SCARED' }, { species: 'DOG', temperament: 'FRIENDLY' }, { species: 'CAT' }, { species: 'BIRD' }, {}]) {
      const plan = planFor({ ...pet, name: 'Max' });
      expect(new Set(plan.order).size).toBe(plan.order.length);
      for (const kind of plan.order) expect(TASK_KINDS).toContain(kind);
      expect(`${plan.about} ${plan.footNote}`).not.toMatch(/will find|guarantee|always works|proven|safe\b/i);
    }
  });

  test('each task has a name and one sentence of what it is, with the pet named', () => {
    expect(taskOf('STATION', 'Max')).toEqual({ kind: 'STATION', title: 'Feeding station', what: 'Food and water left in one quiet spot near a sighting, put out again once a day at the same time.' });
    expect(taskOf('TRAP', 'Max').what).toMatch(/once Max has come to it more than once/);
    expect(taskOf('FLYERS', 'Max').what).toMatch(/saying not to chase/);
    expect(taskOf('NOPE', 'Max').kind).toBe('OTHER');
  });
});

describe('a station, a camera and a trap are looked at again', () => {
  test('due a look when never looked at, or longer ago than its kind goes', () => {
    expect(KEPT_KINDS).toEqual(['STATION', 'CAMERA', 'TRAP']);
    expect(CHECK_EVERY_HOURS.TRAP).toBeLessThan(CHECK_EVERY_HOURS.STATION);
    const trap = (more) => ({ kind: 'TRAP', status: 'OPEN', createdAt: ago(10), checkedAt: null, ...more });
    expect(dueCheck(trap(), NOW)).toBe(true);
    expect(dueCheck(trap({ checkedAt: ago(1) }), NOW)).toBe(false);
    expect(dueCheck(trap({ checkedAt: ago(5) }), NOW)).toBe(true);
    expect(dueCheck({ kind: 'STATION', status: 'OPEN', createdAt: ago(10), checkedAt: null }, NOW)).toBe(false);
    expect(dueCheck({ kind: 'FLYERS', status: 'OPEN', createdAt: ago(100), checkedAt: null }, NOW)).toBe(false);
    expect(dueCheck(trap({ status: 'DONE' }), NOW)).toBe(false);
  });
});

describe('who reads and who writes', () => {
  const route = read('app/api/mission/[missionId]/plan/route.js');
  const tasks = read('app/lib/searchTasks.js');

  test('where a station or a trap is goes only to the people running the search and a force looking for the pet', () => {
    expect(route).toMatch(/if \(!searcher \|\| !searcher\.seesNames\) return NextResponse\.json\(\{ error: 'The tasks of a search are for the people running it\.', code: 'NOT_ALLOWED' \}, \{ status: 403 \}\);/);
    expect(read('app/mission-control/desktop/Board.js')).toMatch(/const withTasks = names \? /);
  });

  test('only whoever runs the search sets tasks up, and not after it has ended', () => {
    expect(route).toMatch(/if \(!searcher\.leads\) return NextResponse\.json\(\{ error: 'Only the person running this search sets up its tasks\.', code: 'NOT_ALLOWED' \}, \{ status: 403 \}\);/);
    expect(route).toMatch(/if \(!isCaseOpen\(pet\.status\)\) return NextResponse\.json\(\{ error: 'This search has ended\.', code: 'CLOSED' \}, \{ status: 409 \}\);/);
    expect(route.match(/withRateLimitAsync\(/g)).toHaveLength(2);
  });

  test('a task belongs to its own search, no account id leaves the server, and the list is capped', () => {
    expect(tasks).toMatch(/findFirst\(\{ where: \{ id: String\(id\), caseId, status: 'OPEN' \} \}\)/);
    expect(tasks).toMatch(/export const MAX_OPEN_TASKS = 30;/);
    const shape = tasks.slice(tasks.indexOf('export function taskForScreen'), tasks.indexOf('/** The tasks of a search'));
    expect(shape).not.toMatch(/createdById/);
    expect(tasks).toMatch(/if \(action === 'checked' && !KEPT_KINDS\.includes\(before\.kind\)\) return \{ error: 'NOT_KEPT' \};/);
  });

  test('the desk asks through the screen\'s one sender, never by itself', () => {
    expect(read('app/mission-control/desktop/Tasks.js')).not.toMatch(/\bfetch\(/);
    expect(read('app/mission-control/hooks/useSearch.js')).toMatch(/const readPlan = useCallback\(async \(\) => \{\s+const res = await send\(/);
  });
});
