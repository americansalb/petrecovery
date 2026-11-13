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
import { planFor, taskOf, gearFor, dueCheck, TASK_KINDS, KEPT_KINDS, SHARED_KINDS, CHECK_EVERY_HOURS } from '@/app/lib/searchPlan';
import { kitFrom } from '@/app/lib/searchKit';

const read = (file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
const NOW = new Date('2026-11-13T18:00:00Z').getTime();
const ago = (hours) => new Date(NOW - hours * 3600000).toISOString();

describe('which tactics come first for which animal', () => {
  test('a scared, shy or snappy dog: flyers, posts and calls, then a feeding station, a camera and a trap, with few people on foot', () => {
    for (const temperament of ['SCARED', 'SHY', 'DEFENSIVE']) {
      const plan = planFor({ species: 'DOG', temperament, name: 'Max' });
      expect(plan.animal).toBe('DOG_WARY');
      // Posts ask for sightings as flyers do, so they sit beside them (added 2026-11-13 with the kit's pictures and words).
      expect(plan.order.slice(0, 6)).toEqual(['FLYERS', 'POSTS', 'CALLS', 'STATION', 'CAMERA', 'TRAP']);
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

  test('a friendly dog: flyers, posts, door to door and calls come first, and helpers may say the name', () => {
    const plan = planFor({ species: 'DOG', temperament: 'FRIENDLY', name: 'Max' });
    expect(plan.animal).toBe('DOG_FRIENDLY');
    expect(plan.order.slice(0, 4)).toEqual(['FLYERS', 'POSTS', 'DOORS', 'CALLS']);
    expect(plan.about).toBe('A friendly dog is often taken in by someone nearby. Flyers, posts in local groups, door to door and calls to shelters are how those people are found.');
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
    expect(taskOf('STATION', 'Max')).toEqual({ kind: 'STATION', title: 'Feeding station', what: 'Food and water left in one quiet spot near a sighting, put out again once a day at the same time.', where: 'Where it is', shared: false });
    expect(taskOf('TRAP', 'Max').what).toMatch(/once Max has come to it more than once/);
    expect(taskOf('FLYERS', 'Max').what).toMatch(/saying not to chase/);
    expect(taskOf('NOPE', 'Max').kind).toBe('OTHER');
  });
});

/**
 * Founder, 2026-11-13, on a Tasks tab that offered "Door to door" with one box that said "Where it is":
 * "Door to door people need to give the flyer, no? Why are we acting as though all these assets cannot
 * assist in the mission control".
 */
describe('a task comes with what the site already made for the pet', () => {
  const kit = kitFrom({
    assets: [
      { kind: 'FLYER_LETTER', status: 'ready', url: 'https://cdn.example/letter.pdf' },
      { kind: 'FLYER_HALF', status: 'ready', url: 'https://cdn.example/half.pdf' },
      { kind: 'FLYER_POSTER', status: 'ready', url: 'https://cdn.example/poster.pdf' },
      { kind: 'SOCIAL_SQUARE', status: 'ready', url: 'https://cdn.example/square.jpg' },
      { kind: 'SOCIAL_STORY', status: 'pending', url: null },
      { kind: 'QR', status: 'ready', url: 'https://cdn.example/qr.png' },
    ],
    steps: [
      { key: 'ai_copy', result: { captions: { facebook: 'LOST DOG: Have you seen Max?', nextdoor: 'Neighbors: have you seen Max?' } } },
      { key: 'shelters', result: { shelters: [{ name: 'Austin Animal Center', phone: '(512) 978-0500', distanceMi: 2.1 }, { name: 'No Phone Rescue', phone: null }] } },
      { key: 'share_targets', result: { targets: [{ kind: 'nextdoor', name: 'Post to your Nextdoor neighborhood', url: 'https://nextdoor.com/' }, { kind: 'bad', name: 'Not a web address', url: 'javascript:alert(1)' }] } },
    ],
  });

  test('door to door has the half sheets to hand out, and flyers have the poster and the tear-off flyer', () => {
    expect(gearFor('DOORS', kit)).toEqual([{ type: 'print', label: 'Print half sheets to hand out, two to a page', href: 'https://cdn.example/half.pdf' }]);
    expect(gearFor('FLYERS', kit)).toEqual([
      { type: 'print', label: 'Print the poster, 11 by 17', href: 'https://cdn.example/poster.pdf' },
      { type: 'print', label: 'Print the flyer with tear-off tabs', href: 'https://cdn.example/letter.pdf' },
    ]);
  });

  test('posts have the picture, the words and the local groups; calls have the shelters by phone and the directory', () => {
    expect(gearFor('POSTS', kit)).toEqual([
      { type: 'picture', label: 'Square picture for a post', href: 'https://cdn.example/square.jpg' },
      { type: 'copy', label: 'Copy the words for the post', text: 'LOST DOG: Have you seen Max?' },
      { type: 'link', label: 'Post to your Nextdoor neighborhood', href: 'https://nextdoor.com/' },
    ]);
    expect(gearFor('CALLS', kit)).toEqual([
      { type: 'call', label: 'Call Austin Animal Center', href: 'tel:5129780500', detail: '2.1 mi' },
      { type: 'link', label: 'Find shelters in the directory', href: '/shelters' },
    ]);
  });

  test('a file that is not ready, a link that is not a web address and a shelter with no phone are left out', () => {
    expect(kit.files).toEqual({ FLYER_LETTER: 'https://cdn.example/letter.pdf', FLYER_HALF: 'https://cdn.example/half.pdf', FLYER_POSTER: 'https://cdn.example/poster.pdf', SOCIAL_SQUARE: 'https://cdn.example/square.jpg' });
    expect(kit.groups).toEqual([{ name: 'Post to your Nextdoor neighborhood', url: 'https://nextdoor.com/' }]);
    expect(gearFor('CALLS', kit).filter((g) => g.type === 'call')).toHaveLength(1);
  });

  test('a pet with no kit still has its tasks, with nothing made up', () => {
    expect(gearFor('DOORS', null)).toEqual([]);
    expect(gearFor('FLYERS', kitFrom({}))).toEqual([]);
    expect(gearFor('CALLS', null)).toEqual([{ type: 'link', label: 'Find shelters in the directory', href: '/shelters' }]);
    expect(gearFor('TRAP', kit)).toEqual([]);
  });

  test('the place is asked in the task\'s own words, and a round of calls has none', () => {
    expect(taskOf('DOORS', 'Max')).toMatchObject({ where: 'Which streets', shared: true });
    expect(taskOf('DOORS', 'Max').what).toMatch(/^The nearest neighbors handed a flyer and asked to check their own yards/);
    expect(taskOf('FLYERS', 'Max').where).toBe('Which corners or streets');
    expect(taskOf('CALLS', 'Max').where).toBe('');
    expect(taskOf('TRAP', 'Max')).toMatchObject({ where: 'Where it is', shared: false });
    const tab = read('app/mission-control/desktop/Tasks.js');
    expect(tab).toMatch(/\{kind\.where && <input aria-label=\{kind\.where\}/);
    expect(tab).not.toMatch(/placeholder="Where it is"/);
    // The button that saves had ink on ink: its words could not be seen.
    expect(tab).toMatch(/<button type="button" className=\{SOLID\} disabled=\{busy\} onClick=\{add\}>/);
    expect(tab).toMatch(/const SOLID = `\$\{BUTTON\} border-\[var\(--mc-ink\)\] bg-\[var\(--mc-ink\)\] text-\[var\(--mc-ground\)\]`;/);
  });

  test('the people helping are shown flyers, posts and door to door with the same files, and never a station, a camera or a trap', () => {
    expect(SHARED_KINDS).toEqual(['FLYERS', 'POSTS', 'DOORS']);
    for (const kind of KEPT_KINDS) expect(SHARED_KINDS).not.toContain(kind);
    const tasks = read('app/lib/searchTasks.js');
    expect(tasks).toMatch(/where: \{ caseId, status: 'OPEN', kind: \{ in: SHARED_KINDS \} \}/);
    // Their place and what to print: no id, no name, and never the note.
    expect(tasks).toMatch(/select: \{ kind: true, place: true \}/);
    expect(read('app/api/mission/[missionId]/board/route.js')).toMatch(/ways: await sharedTasks\(pet\.id, pet\.petName \|\| 'the pet'\)\.catch\(\(\) => \[\]\),/);
    const helper = read('app/mission-control/steps/Helper.js');
    expect(helper).toMatch(/\{!desk && !ask && <Ways ways=\{ways\} owner=\{owner\} className="mt-3" \/>\}/);
    expect(helper).toMatch(/<Gear items=\{way\.gear\} className="mt-2" \/>/);
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
