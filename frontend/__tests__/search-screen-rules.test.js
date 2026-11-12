/**
 * The rules the search screen (Mission Control) is built on, checked
 * against its source. Like global-chrome.test.js this is static: no DOM,
 * fast, and it fails in CI the moment someone writes past a rule.
 *
 * No maze (founder, 2026-11-11, on the version with fourteen cards):
 *   eight cards for three people, one yellow button to a card, and a
 *   sighting never interrupts anyone. It changes the line at the top.
 *
 * Three instruments, three jobs (app/hooks/useInstrument.js):
 *   a desk         sees the whole search and steers it. It is never asked
 *                  where it is and is never handed ground to search. Only
 *                  the owner can steer.
 *   a phone        in a browser reads its position once, when asked, and
 *                  never watches it. No GPS walk.
 *   the app        does what the phone does, and records the walk.
 *
 * Three rules on what the product says (founder, 2026-11-11):
 *   1. It never tells a helper to stop or not to search.
 *   2. Nothing on the screen asks a helper to hold back. (The owner's
 *      "ask" was one more thing to answer; it went with the maze.)
 *   3. Advice is the site's own, word for word. The screen writes none.
 *
 * The search is a circle of ground in areas, not a list of streets
 * (founder, 2026-11-12: "pets don't tend to follow infrastructure"). The
 * street's card and the street's lines stay for a search from before it
 * was on areas, and the rules hold both to the same things.
 */

const fs = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname, '..');
const SCREEN = path.join(FRONTEND, 'app', 'mission-control');
const read = (rel) => fs.readFileSync(path.join(FRONTEND, rel), 'utf8');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}
const rel = (file) => path.relative(FRONTEND, file).split(path.sep).join('/');

/** Source with its comments taken out, so a rule written in a comment is not read as a breach of it. */
function code(source) {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Every file in the screen's folder, for rules about words. */
const folderFiles = walk(SCREEN).map(rel);

// The files the screen actually loads: everything reachable from its page by imports inside the folder
// (__tests__/helpers/searchScreenFiles.js). The folder also keeps two hooks for older components elsewhere
// (useFlyerTracking, useScoutTips); the screen does not import them, so the rules about instruments do not read them.
const { reachable } = require('./helpers/searchScreenFiles');
const screenFiles = reachable('app/mission-control/page.js');
const shell = read('app/mission-control/SearchScreen.js');
const helper = read('app/mission-control/steps/Helper.js');
const owner = read('app/mission-control/steps/Owner.js');
const witness = read('app/mission-control/steps/Witness.js');
const STEP_FILES = ['app/mission-control/steps/Helper.js', 'app/mission-control/steps/Owner.js', 'app/mission-control/steps/Witness.js'];
// A desk's own view (the whole search, and the controls to run it): every file in its folder.
const DESK_FILES = fs.readdirSync(path.join(SCREEN, 'desktop')).sort().map((name) => `app/mission-control/desktop/${name}`);
const desk = read('app/mission-control/desktop/Command.js');

// Files outside the screen's folder that put words in front of people on a search: asks, messages, the roster,
// the reasons the pet's page gives for a job, and the routes that answer in words. Held to the same rules on words.
const TALKERS = ['app/lib/searchAsk.js', 'app/lib/searchZones.js', 'app/lib/searchCircle.js', 'app/lib/searchTalk.js', 'app/lib/searchTeam.js', 'app/lib/jobs.js', 'app/api/mission/[missionId]/board/route.js', 'app/api/mission/[missionId]/message/route.js', 'app/api/mission/[missionId]/volunteer/route.js'];

/** The cards a step file exports, each as { name, source }. */
function cardsOf(source) {
  return source
    .split(/\nexport function /)
    .slice(1)
    .map((step) => ({ name: step.slice(0, step.indexOf('(')), source: step }));
}

// The GPS walk's own machinery: only the app runs it.
const RECORDER = ['app/mission-control/hooks/useSearchLeg.js', 'app/mission-control/hooks/useSearchSession.js', 'app/mission-control/components/FieldGps.js'];

describe('no maze: eight cards, and one next step on each', () => {
  test('the screen is eight cards for three people', () => {
    // `Area` is the card of someone's ground. `Street` is the same card for a search from before it was on areas:
    // a search shows one or the other, never both, so it is still eight cards to anyone looking at one.
    expect(cardsOf(helper).map((c) => c.name)).toEqual(['Main', 'Join', 'Area', 'Street', 'Home']);
    expect(code(shell)).toMatch(/\} else if \(mine && ground\) \{\s*step = <Area\b/);
    expect(code(shell)).toMatch(/\} else if \(mine\) \{\s*step = <Street\b/);
    expect(code(shell).match(/<(Area|Street)\b/g)).toHaveLength(2);
    expect(cardsOf(witness).map((c) => c.name)).toEqual(['Seen', 'Sent']);
    expect(cardsOf(owner).map((c) => c.name)).toEqual(['OwnerNow', 'OwnerSighting']);
    // No fourth file of steps appears beside them.
    expect(fs.readdirSync(path.join(SCREEN, 'steps')).sort()).toEqual(['Helper.js', 'Owner.js', 'Witness.js']);
  });

  test('the screen moves between four views and no others', () => {
    const views = new Set([...code(shell).matchAll(/\b(?:go|setView)\('([a-zA-Z]+)'\)/g)].map((m) => m[1]));
    expect([...views].sort()).toEqual(['join', 'main', 'seen', 'sent']);
    expect(shell).toMatch(/useState\('main'\); \/\/ main \| join \| seen \| sent/);
  });

  test('one yellow button to a card', () => {
    // <Primary> is the one yellow button, and it is the next step.
    for (const file of STEP_FILES) {
      for (const card of cardsOf(read(file))) {
        const count = (code(card.source).match(/<Primary\b/g) || []).length;
        expect({ file, card: card.name, ok: count <= 1 }).toEqual({ file, card: card.name, ok: true });
      }
    }
  });

  test('never more than two full-width buttons on a card', () => {
    for (const file of STEP_FILES) {
      for (const card of cardsOf(read(file))) {
        const count = (code(card.source).match(/<(Primary|Second|SeenButton)\b/g) || []).length;
        expect({ file, card: card.name, ok: count <= 2 }).toEqual({ file, card: card.name, ok: true });
      }
    }
  });

  test('a street is theirs when it is given: no step between getting it and walking it', () => {
    expect(code(helper)).not.toMatch(/I am going|Start walking|onStart\b/);
    // The claim is made in the same breath as the choice.
    expect(code(shell)).toMatch(/const result = await search\.act\(unit, item\.id, 'claim'\);/);
    // The one button on the street's card ends it.
    const street = cardsOf(helper).find((c) => c.name === 'Street').source;
    expect(street).toMatch(/<Primary onClick=\{onWalked\}[^>]*>\s*I walked it\s*<\/Primary>/);
  });

  test('a sighting is a place and a time: one form, one button, and no questions after it', () => {
    const seen = cardsOf(witness).find((c) => c.name === 'Seen').source;
    expect(seen).toMatch(/<LocationPicker\b/);
    expect(seen).toMatch(/role="radiogroup"/);
    // Which way the pet went is not asked: a second sighting from the new spot shows it.
    expect(code(witness)).not.toMatch(/direction|which way|toward/i);
    // What is sent is the place, the time, and nothing the witness had to think about.
    const body = code(shell).match(/search\.sendSighting\(\{([\s\S]*?)\}\);/)[1];
    const keys = [...body.matchAll(/^\s*([a-zA-Z]+):/gm)].map((m) => m[1]);
    expect(keys).toEqual(['lat', 'lng', 'address', 'minutesAgo', 'sure']);
    // There is nothing to press after sending but call, send again, or done.
    const sent = cardsOf(witness).find((c) => c.name === 'Sent').source;
    expect([...code(sent).matchAll(/on[A-Z][a-zA-Z]*=\{(on[A-Z][a-zA-Z]*)\}/g)].map((m) => m[1]).sort()).toEqual(['onAgain', 'onDone']);
    // A sighting is not edited after it is sent: the route takes new ones only.
    expect(read('app/api/public/missions/[caseNumber]/sighting/route.js')).not.toMatch(/export async function (PATCH|PUT|DELETE)/);
  });

  test('the same place sent again is the same sighting, and nobody is told twice', () => {
    const lib = read('app/lib/witness.js');
    expect(lib).toMatch(/const SAME_SIGHTING_MS = 10 \* 60 \* 1000;/);
    expect(lib).toMatch(/const SAME_SIGHTING_METERS = \d+;/);
    expect(lib).toMatch(/told: \{ owner: false, bell: 0, pushed: 0 \}, again: true/);
  });

  test('the owner has one button on a sighting: it opens the way there and tells the witness', () => {
    const card = cardsOf(owner).find((c) => c.name === 'OwnerSighting').source;
    expect(card).toMatch(/<Primary href=\{mapsHref\} newTab onClick=\{onGoing\}[^>]*>\s*Directions\s*<\/Primary>/);
    // The witness is told once. Opening directions again only brings the distance up to date.
    expect(code(shell)).toMatch(/const told = hot\.ownerGoingAt \? Promise\.resolve\(\) : search\.answer\(hot\.id, 'going'\);/);
    // Opening directions never puts the phone's location question on the screen: the distance is read only where it is already allowed.
    expect(code(shell)).toMatch(/locate\(\{ ifAllowed: true \}\)\.then\(/);
    expect(read('app/mission-control/hooks/useSearch.js')).toMatch(/allowed = status\?\.state === 'granted';[\s\S]*?if \(!allowed\) return null;/);
    // No switch, no menu, no second question.
    expect(code(owner)).not.toMatch(/type="checkbox"|role="switch"|<select\b/);
  });

  test('a sighting never takes over a helper\'s card: it is the line at the top', () => {
    const chain = shell.slice(shell.indexOf('// ----- The card'), shell.indexOf('const overlays'));
    // The only card a sighting chooses is the owner's.
    const uses = [...code(chain).matchAll(/\bif \(([^)]*\bhot\b[^)]*)\)/g)].map((m) => m[1]);
    expect(uses).toEqual(['isOwner && hot']);
    expect(shell).toMatch(/: situationLine\(picture, now\);/);
    // What leads the owner's screen is the newest sighting while it is news to them; for everyone else, one seen within the hour.
    expect(shell).toMatch(/const hot = isOwner \? ownerSighting\(picture\?\.sightings, now\) : seenLately;/);
  });
});

describe('nothing is left wrong or stuck when a person does the ordinary thing', () => {
  test('where the phone is now is where the pet is only for "Just now": an earlier time takes the phone\'s pin off', () => {
    // Someone at home in the evening, sending what they saw at noon, must not pin the pet to their own house.
    expect(code(shell)).toMatch(/if \(next > 0 && whereFrom === 'phone'\) \{\s*setWhere\(null\);\s*setWhereFrom\(null\);/);
    // The reading can arrive after "Today" was already tapped: the pin is held back then too.
    expect(code(shell)).toMatch(/function chooseWhen\(next\) \{\s*pickedMinutes\.current = next;/);
    expect(code(shell).match(/setWhereFrom\('phone'\)/g)).toHaveLength(2);
    expect(code(shell)).toMatch(/\} else if \(next === 0 && !where && phoneSpot\.current\) \{\s*setWhere\(phoneSpot\.current\);\s*setWhereFrom\('phone'\);/);
    // A place the person typed or put there by hand stands whatever the time.
    expect(code(shell)).toMatch(/function placeByHand\(value\) \{\s*setWhere\(value\);\s*setWhereFrom\(value \? 'hand' : null\);/);
    expect(shell).toMatch(/<Seen\b.*onWhere=\{placeByHand\}.*onMinutes=\{chooseWhen\}/);
  });

  test('a link that opens a card is used once: a reload or a restored tab asks the phone nothing', () => {
    // With no state of its own: Next's router skips an entry that carries its mark, and would go on holding the action.
    expect(code(shell)).toMatch(/rest\.delete\('action'\);\s*window\.history\.replaceState\(null, '', `\$\{window\.location\.pathname\}\?\$\{rest\}`\);/);
    expect(code(shell)).not.toMatch(/replaceState\(window\.history\.state/);
    // The action is taken off the address before anything is opened.
    const effect = code(shell).slice(code(shell).indexOf("const action = params.get('action');"));
    expect(effect.indexOf('window.history.replaceState')).toBeLessThan(effect.indexOf('openSeen()'));
    // Two actions and no others: the sighting form, and the join card for someone who said "on foot" on the pet's page.
    expect([...code(shell).matchAll(/action === '([a-z]+)'/g)].map((m) => m[1]).sort()).toEqual(['sighting', 'walk']);
  });

  test('a dropped signal is words on the card, and no button is left spinning', () => {
    const hook = read('app/mission-control/hooks/useSearch.js');
    // Every write goes through the one request that answers null instead of throwing.
    expect(code(hook)).toMatch(/function send\(url, init\) \{[\s\S]*?return fetch\(url, \{ \.\.\.init, signal: stop\.signal \}\)\s*\.catch\(\(\) => null\)/);
    // A request that stalls is given up on, so it too becomes words on the card.
    expect(code(hook)).toMatch(/const timer = setTimeout\(\(\) => stop\.abort\(\), SEND_TIMEOUT_MS\);/);
    expect(Number(code(hook).match(/const SEND_TIMEOUT_MS = (\d+);/)[1])).toBeLessThanOrEqual(30000);
    expect(code(hook).match(/\bfetch\(/g)).toHaveLength(3); // the one sender, and the two readers
    // Joining, the waiver, a change to the board (a street taken, an ask), a sighting, the owner's answer, the
    // owner's word to everyone helping, a word between one person and the desk, and a card saying what it showed.
    expect(code(hook).match(/await send\(/g)).toHaveLength(8);
    expect(code(hook).match(/if \(!res\) return \{ error: NO_SIGNAL/g)).toHaveLength(8);
    // Everything that changes the board goes through the one function that reads it again afterwards.
    expect(code(hook)).toMatch(/const act = useCallback\(\(unit, id, action\) => change\(\{ unit, id, action \}\), \[change\]\);/);
    expect(code(hook)).toMatch(/const ask = useCallback\(\(person, id, note = ''\) => change\(\{ unit: unitNow\.current, id, action: 'ask', person, note \}\), \[change\]\);/);
    expect(code(hook)).toMatch(/const unask = useCallback\(\(person\) => change\(\{ unit: unitNow\.current, action: 'unask', person \}\), \[change\]\);/);
    expect(code(hook)).toMatch(/const cannot = useCallback\(\(\) => change\(\{ unit: unitNow\.current, action: 'cannot' \}\), \[change\]\);/);
    // Widening the search, and putting every searched area up for another look, go the same way.
    expect(code(hook)).toMatch(/const widen = useCallback\(\(\) => change\(\{ unit: 'area', action: 'widen' \}\), \[change\]\);/);
    expect(code(hook)).toMatch(/const againAll = useCallback\(\(\) => change\(\{ unit: 'area', action: 'againAll' \}\), \[change\]\);/);
    // And each thing a person presses clears its own spinner whatever happens.
    for (const name of ['takeStreet', 'walked', 'stopWalking', 'sendSeen']) {
      const body = code(shell).slice(code(shell).indexOf(`async function ${name}(`));
      const end = body.indexOf('\n  }\n');
      expect({ name, ok: /finally \{\s*setBusy\(null\);\s*\}/.test(body.slice(0, end)) }).toEqual({ name, ok: true });
    }
  });

  test('"Different street" moves down the list and never hands one back', () => {
    expect(code(shell)).toMatch(/if \(exceptId\) passed\.current\.add\(exceptId\);\s*else passed\.current = new Set\(\);/);
    expect(code(shell)).toMatch(/let list = ranked\.filter\(\(i\) => !passed\.current\.has\(i\.id\)\);/);
    // A street nobody has walked comes before a second pass of one that has been: the round restarts rather than skip it.
    // And with everything passed on (every area searched, and each one passed in turn) it restarts too: pressing
    // "Different area" with an empty list sent nothing, and answered "That did not go through" for good.
    expect(code(shell)).toMatch(/if \(!list\.length \|\| \(!list\.some\(unwalked\) && ranked\.some\(unwalked\)\)\) \{\s*passed\.current = new Set\(exceptId \? \[exceptId\] : \[\]\);\s*list = ranked;/);
    // A desk holds a street only if a phone took it: it cannot be handed another.
    expect(shell).toMatch(/<Street\b.*canOther=\{!desk && candidates\.length > 0\}/);
    // The same for an area of ground, where "nobody has searched it" is what comes before a second search.
    expect(shell).toMatch(/<Area\b.*canOther=\{!desk && candidates\.length > 0\}/);
    // Ground that needs a search is what the order itself calls that: never searched, or up for another look.
    expect(code(shell)).toMatch(/const unwalked = \(i\) => \(unit === 'area' \? needsSearch\(i\) : i\.status !== 'SEARCHED'\);/);
    expect(shell).toMatch(/import \{ rankAreas, needsSearch \} from '@\/app\/lib\/searchCircle';/);
  });

  test('"Different area" always has an area to give while there is another one, however many have been passed on', () => {
    // The list logic of takeStreet, run: five searched areas, the person on one, pressing "Different area" over and over.
    const { rankAreas, needsSearch } = require('@/app/lib/searchCircle');
    const searched = (id, at) => ({ id, status: 'SEARCHED', searchCount: 1, searchedAt: at, priority: 6, on: 0, coming: 0, mine: false, full: false });
    const areas = ['middle', 'north', 'east', 'south', 'west'].map((id, i) => searched(id, `2026-11-12T0${i + 1}:00:00Z`));
    let passed = new Set();
    let mine = 'middle';
    const given = [];
    for (let press = 0; press < 12; press += 1) {
      const exceptId = mine;
      passed.add(exceptId);
      const ranked = rankAreas(areas.map((a) => ({ ...a, mine: a.id === mine }))).filter((i) => i.id !== exceptId);
      let list = ranked.filter((i) => !passed.has(i.id));
      if (!list.length || (!list.some(needsSearch) && ranked.some(needsSearch))) {
        passed = new Set([exceptId]);
        list = ranked;
      }
      expect(list.length).toBeGreaterThan(0);
      mine = list[0].id;
      given.push(mine);
    }
    // Every other area comes round before any comes round twice, and it never hands back the one just left.
    expect(given.slice(0, 4).sort()).toEqual(['east', 'north', 'south', 'west']);
    given.forEach((id, i) => expect(id).not.toBe(i === 0 ? 'middle' : given[i - 1]));
  });

  test('after the circle round a sighting, the thanks do not count it among the areas', () => {
    expect(shell).toMatch(/setDoneAtSighting\(unit === 'area' && isSeenCircle\(mineRaw\)\);/);
    const helper = read('app/mission-control/steps/Helper.js');
    expect(helper).toMatch(/\{done\} is searched\. Thank you\.\{doneAtSighting \? '' : ` \$\{counts\.searched\} of the \$\{counts\.total\} areas /);
  });

  test('when the pet was seen is said with its day: a sighting keeps its circle for three days', () => {
    const helper = read('app/mission-control/steps/Helper.js');
    expect(helper).toMatch(/const seenWhen = sighting && mine\.sightingAt \? whenWords\(mine\.sightingAt, picture\.timeZone, now\) : '';/);
    expect(code(helper)).not.toMatch(/Seen at \$\{/);
    const { whenWords } = require('@/app/mission-control/lib/insight');
    const now = new Date('2026-11-12T22:00:00Z').getTime();
    expect(`Seen ${whenWords('2026-11-12T21:40:00Z', 'America/Chicago', now)}.`).toBe('Seen at 3:40 pm.');
    expect(`Seen ${whenWords('2026-11-10T21:40:00Z', 'America/Chicago', now)}.`).toBe('Seen on Tue at 3:40 pm.');
  });

  test('on the desk a sighting\'s circle can be pointed at: it is drawn after the areas it lies in', () => {
    const map = read('app/mission-control/components/SearchMap.js');
    expect(map).toMatch(/const drawn = \[\.\.\.areas\]\.sort\(\(a, b\) => Number\(a\.ring === 3\) - Number\(b\.ring === 3\)\);\s*for \(const area of drawn\) \{/);
  });

  test('when no street can be given, the first card says why and nobody is sent off', () => {
    expect(code(shell)).toMatch(/setView\('main'\);\s*setProblem\(words\);/);
    expect(code(shell)).not.toMatch(/Thank you for coming/);
  });

  test('on a phone the map is looked at, not tapped: it answers to the pointer only on a desk', () => {
    const map = code(read('app/mission-control/components/SearchMap.js'));
    expect(map).not.toMatch(/onPick|offered|bearing/);
    // Four places listen for a pointer, and each is behind `desk`: the map itself, an area, a square, and a street.
    expect(map.match(/\.on\('(click|mouseover|mouseout)'/g)).toHaveLength(4);
    expect(map).toMatch(/if \(desk\) map\.on\('click', \(\) => select\.current\?\.\(null\)\);/);
    const answer = map.slice(map.indexOf('const answer = (shape, item) => {'), map.indexOf('for (const cell of cells)'));
    expect(answer.match(/shape\.on\('(click|mouseover|mouseout)'/g)).toHaveLength(3);
    expect(map.match(/\banswer\(/g)).toHaveLength(3);
    expect(map.match(/if \(desk\) answer\(/g)).toHaveLength(3);
    // Nothing else drawn takes a pointer: every other shape and mark says so.
    const drawn = map.match(/L\.(polyline|polygon|rectangle|circle|marker)\([^\n]*/g);
    expect(drawn.filter((line) => line.startsWith('L.polygon(')).length).toBeGreaterThanOrEqual(2);
    const taking = drawn.filter((line) => !/interactive: (false|desk)/.test(line));
    expect(taking).toHaveLength(1);
    expect(taking[0]).toMatch(/^L\.polyline\(street\.path, \{ color: '#000000', weight: 20, opacity: 0/);
    // And the phone's map is never told it is a desk, or given anything to call.
    const phoneMap = shell.slice(shell.indexOf('const map = ('), shell.indexOf('const mapKey'));
    expect(phoneMap).toMatch(/<SearchMap\b/);
    expect(phoneMap).not.toMatch(/\bdesk\b|onSelect|onHover|selected=|hovered=|zoomControl/);
    expect(shell.match(/<SearchMap\b/g)).toHaveLength(1);
  });

  test('the owner is never told "nobody has answered yet" above a sighting', () => {
    expect(code(shell)).toMatch(/const line = isOwner && !hot && !picture\.sightings\.length && picture\.neighbors\?\.told \?/);
  });
});

describe('three instruments: the GPS walk is the app\'s alone', () => {
  test('the screen is the files its page reaches', () => {
    expect(screenFiles).toEqual(expect.arrayContaining(['app/mission-control/SearchScreen.js', 'app/mission-control/hooks/useSearch.js', 'app/mission-control/components/SearchMap.js', 'app/mission-control/steps/Helper.js', 'app/mission-control/components/FieldGps.js']));
    expect(screenFiles).not.toContain('app/mission-control/hooks/useFlyerTracking.js');
  });

  test('only FieldGps runs the walk recorder', () => {
    const importers = walk(path.join(FRONTEND, 'app'))
      .map(rel)
      .filter((file) => !RECORDER.includes(file))
      .filter((file) => /from ['"][^'"]*(useSearchLeg|useSearchSession)['"]/.test(read(file)));
    expect(importers).toEqual([]);
    expect(read('app/mission-control/components/FieldGps.js')).toMatch(/from '\.\.\/hooks\/useSearchLeg'/);
  });

  test('the screen mounts FieldGps only inside the app', () => {
    expect(shell).toMatch(/const app = instrument === INSTRUMENTS\.FIELD;/);
    const mounts = shell.match(/<FieldGps\b/g) || [];
    expect(mounts).toHaveLength(1);
    expect(shell).toMatch(/\{app && viewer\?\.signedIn && <FieldGps\b/);
    // Nothing else in the screen mounts it.
    const others = screenFiles.filter((file) => file !== 'app/mission-control/SearchScreen.js' && /<FieldGps\b/.test(read(file)));
    expect(others).toEqual([]);
  });

  test('a walk is started only in the app, and a browser never says it records one', () => {
    expect(code(shell)).toMatch(/if \(app && gps && viewer\?\.signedIn\) gps\.start\(\)/);
    expect(code(shell).match(/gps\.start\(/g)).toHaveLength(1);
    // "Your path records as you go" is shown only while the app is recording.
    expect(helper).toMatch(/const recording = instrument === 'field' && gps\?\.recording;/);
    // Twice: on the card of an area, and on the card of a street. Never outside that condition.
    expect(helper.match(/\{recording \? ` \$\{brief\.records\}` : ''\}/g)).toHaveLength(2);
    expect(helper.match(/brief\.records/g)).toHaveLength(2);
    expect(helper.match(/const recording = instrument === 'field' && gps\?\.recording;/g)).toHaveLength(2);
    // The recorded path is drawn only from the app's recorder.
    expect(shell).toMatch(/const track = app && gps\?\.recording && /);
  });
});

describe('three instruments: a browser reads its position once and never watches it', () => {
  const browserFiles = screenFiles.filter((file) => !RECORDER.includes(file));

  test('no file of the screen watches the position', () => {
    const watchers = browserFiles.filter((file) => /watchPosition|useGPS|gpsService|nativeGps/.test(read(file)));
    expect(watchers).toEqual([]);
  });

  test('one reading, in one place, when the person asks for something', () => {
    const readers = browserFiles.filter((file) => /getCurrentPosition/.test(read(file)));
    expect(readers).toEqual(['app/mission-control/hooks/useSearch.js']);
    expect(read('app/mission-control/hooks/useSearch.js').match(/getCurrentPosition/g)).toHaveLength(1);
    // Each of the three things that read it is something the person pressed: a street, a sighting, directions.
    const callers = [...code(shell).matchAll(/\blocate\(/g)].length;
    expect(callers).toBe(4); // a street; a sighting and its one retry; directions
  });

  test('a reading too rough to name a street never sets the pin of a sighting', () => {
    expect(shell).toMatch(/const SIGHTING_ACCURACY_METERS = \d+;/);
    const limit = Number(shell.match(/const SIGHTING_ACCURACY_METERS = (\d+);/)[1]);
    expect(limit).toBeLessThanOrEqual(200);
    // The pin is set from the phone's reading in one place, behind the check.
    expect(code(shell)).toMatch(/if \(here && here\.accuracy <= SIGHTING_ACCURACY_METERS\) \{\s*const point = \{ lat: here\.lat, lng: here\.lng \};\s*const spot = [^;]+;\s*phoneSpot\.current = spot;\s*if \(pickedMinutes\.current === 0\) \{\s*setWhere\(spot\);\s*setWhereFrom\('phone'\);/);
    // Nowhere else is a pin made from a reading.
    expect(code(shell).match(/phoneSpot\.current = (?!null)/g)).toHaveLength(1);
    // The owner's distance is not guessed from a rough reading either.
    expect(code(shell)).toMatch(/if \(!here \|\| !\(here\.accuracy <= SIGHTING_ACCURACY_METERS\)\) return;/);
  });
});

describe('three instruments: a desk is never asked where it is and is never handed a street', () => {
  test('every position read in the screen goes through one function, and a desk gets no reading', () => {
    expect(code(shell)).toMatch(/const locate = useCallback\(\(options\) => \(desk \? Promise\.resolve\(null\) : readPosition\(options\)\), \[desk, readPosition\]\);/);
    // The hook's own reader is named once, to build that function, and never called directly.
    expect(code(shell).match(/search\.locate/g)).toHaveLength(1);
    expect(code(shell)).not.toMatch(/search\.locate\(|readPosition\((?!options\))/);
    for (const file of [...STEP_FILES, ...DESK_FILES]) {
      expect(read(file)).not.toMatch(/\.locate\(|geolocation|getCurrentPosition/);
    }
    // The desk's own view is handed no position and no recorded path, and draws neither.
    expect(desk).not.toMatch(/\bme=|\btrack=|\bme\b,|\btrack\b,/);
    const handed = shell.slice(shell.indexOf('<Command'), shell.indexOf('/>', shell.indexOf('<Command')));
    expect(handed).not.toMatch(/\bme=|\btrack=|\bgps=|\blocate=/);
  });

  test('a desk is a view of its own, and the screen switches to it in one place', () => {
    expect(fs.readdirSync(path.join(SCREEN, 'desktop')).sort()).toEqual(['Board.js', 'Command.js', 'Ground.js', 'Know.js', 'Messages.js', 'Needs.js', 'People.js']);
    expect(code(shell).match(/<Command\b/g)).toHaveLength(1);
    expect(code(shell)).toMatch(/if \(desk\) \{\s*return \(\s*<Command\b/);
    // It is given this person's own card as it is, so a desk and a phone never say different things about a step.
    expect(code(shell)).toMatch(/<Command\b[\s\S]*?step=\{step\}\s*full=\{full\}/);
    for (const file of DESK_FILES) expect(screenFiles).toContain(file);
  });

  test('"I\'ve seen" from a desk is a typed street, not the desk\'s position', () => {
    // The form opens, and a desk goes no further: the phone's reading is asked for only after this line.
    expect(code(shell)).toMatch(/setView\('seen'\);\s*if \(desk\) return;\s*setLocating\(true\);\s*let here = await locate\(\);/);
    // Every way into the form goes through that one function.
    expect(code(shell).match(/setView\('seen'\)/g)).toHaveLength(1);
    expect(code(shell)).not.toMatch(/go\('seen'\)/);
  });

  test('the form does not offer "Use my location" on a desk', () => {
    expect(shell).toMatch(/<Seen\b.*canLocate=\{!desk\}/);
    expect(witness).toMatch(/<LocationPicker value=\{where\} onChange=\{onWhere\} variant="lost" canLocate=\{canLocate\} search=\{typing \|\| !placed\} near=\{near\} \/>/);
    // A typed street is looked for around the search, since a desk has no position of its own to lean on.
    expect(shell).toMatch(/<Seen\b.*near=\{hot \|\| picture\.lastSeen\}/);
    const picker = read('app/components/report/LocationPicker.js');
    // Both of the picker's own location buttons sit behind the switch.
    const buttons = picker.match(/onClick=\{useMyLocation\}/g) || [];
    expect(buttons).toHaveLength(2);
    expect(picker.match(/\{canLocate && \(\s*(<>\s*<p[^>]*>or<\/p>\s*)?<button\s+type="button"\s+onClick=\{useMyLocation\}/g)).toHaveLength(2);
  });

  test('a desk shows the code to scan in place of the button that hands out a street', () => {
    const main = helper.slice(helper.indexOf('export function Main'), helper.indexOf('export function Join'));
    expect(main).toMatch(/const desk = instrument === 'command';/);
    expect(main.match(/onClick=\{onWalk\}/g)).toHaveLength(1);
    // The walk button is in the branch a desk never takes.
    expect(code(main)).toMatch(/\{desk \? \(\s*qr && \([\s\S]*?\)\s*\) : \(\s*hasBoard && \(\s*<Primary onClick=\{onWalk\}/);
  });
});

describe('a desk steers the search, and only for the owner', () => {
  const card = desk.slice(desk.indexOf('function StreetCard'), desk.indexOf('export default function Command'));

  test('each steering button is behind `leads`, which comes from the server', () => {
    const acts = [...card.matchAll(/\{(leads && [^{}]*?)act\('(first|normal|walked|again)'/g)];
    expect(acts.map((m) => m[2])).toEqual(['first', 'normal', 'walked', 'again']);
    expect((card.match(/act\('/g) || []).length).toBe(4);
    // The same four on the card of an area of ground (Ground.js), each behind `leads`.
    const ground = read('app/mission-control/desktop/Ground.js');
    const areaCard = ground.slice(ground.indexOf('export function AreaCard'));
    const areaActs = [...areaCard.matchAll(/\{(leads && [^{}]*?)act\('(first|normal|walked|again)'/g)];
    expect(areaActs.map((m) => m[2])).toEqual(['first', 'normal', 'walked', 'again']);
    expect((areaCard.match(/act\('/g) || []).length).toBe(4);
    expect((ground.match(/act\('/g) || []).length).toBe(4);
    // Asking a person from an area's card, and taking an ask back, are behind it too. So is widening the search.
    expect(areaCard).toMatch(/\{leads && !taken && \(/);
    expect(areaCard).toMatch(/\{leads &&\s*\(area\.asked \|\| \[\]\)\.map\(/);
    expect(areaCard).toMatch(/\{!leads && </);
    expect(ground).toMatch(/\{leads \? \(\s*<button type="button" onClick=\{onWiden\}/);
    expect(desk).toMatch(/const canWiden = ground && leads && circle && !circle\.widened && circle\.wide > circle\.edge;/);
    expect(desk).toMatch(/\{canWiden && \(\s*<button type="button" onClick=\{widen\}/);
    // No steering button anywhere else on the desk.
    for (const file of DESK_FILES.filter((f) => !/(Command|Ground)\.js$/.test(f))) expect(read(file)).not.toMatch(/onSteer|search\.act|\bact\(/);
    // Asking a person from a street's card, and taking an ask back, are behind it too.
    expect(card).toMatch(/\{leads && unit === 'street' && open && !kept && free\.length > 0 && \(/);
    expect(card).toMatch(/\{leads && kept && street\.askedOfHandle && \(/);
    expect(desk).toMatch(/const leads = Boolean\(viewer\?\.leads\);/);
    expect(read('app/lib/searchPicture.js')).toMatch(/leads: Boolean\(searcher\.leads\)/);
    // Everyone else is told whose it is to decide, in place of the buttons.
    expect(card).toMatch(/\{!leads && \(/);
  });

  test('the server refuses it from anyone else, whatever the screen shows', () => {
    const route = code(read('app/api/mission/[missionId]/board/route.js'));
    expect(route).toMatch(/if \(steering && !searcher\.leads\) return NextResponse\.json\(\{ error: WORDS\.NOT_ALLOWED\(\), code: 'NOT_ALLOWED' \}, \{ status: 403 \}\);/);
    // And the function that writes checks again, so no other caller can steer for someone who may not.
    expect(code(read('app/lib/searchBoard.js'))).toMatch(/if \(STEER_ACTIONS\.includes\(action\)\) \{\s*if \(!searcher\.leads\) return \{ error: 'NOT_ALLOWED', title \};/);
    // The same for ground: every steering action, widening and asking a person included.
    const zones = code(read('app/lib/searchZones.js'));
    expect(zones).toMatch(/const steering = ZONE_STEER_ACTIONS\.includes\(action\);\s*if \(steering && !searcher\.leads\) return \{ error: 'NOT_ALLOWED', title: null \};/);
    expect(zones).toMatch(/export const ZONE_STEER_ACTIONS = \['first', 'normal', 'walked', 'again', 'againAll', 'widen'\];/);
    expect(zones.match(/if \(!searcher\?\.leads\) return \{ error: 'NOT_ALLOWED'/g)).toHaveLength(3); // widen, ask, take an ask back
    // Running a search is the owner's alone. No role in a Rescue Force is it: a force with no leader gives the
    // role to any member who asks, and anyone can found one, so nobody had to agree to any of them.
    const who = code(read('app/lib/searcher.js'));
    expect(who).toMatch(/leads: isOwner,/);
    expect(who).not.toMatch(/FORCE_COMMAND_ROLES|leadsForce/);
    expect(who).not.toMatch(/leads: seesNames|leads: true|leads: isOwner \|\|/);
  });

  test('steering goes through the screen\'s one sender, and no button is left spinning', () => {
    expect(code(desk)).toMatch(/async function steer\(target, action\) \{[\s\S]*?const result = await search\.act\(unit, target\.id, action\);[\s\S]*?finally \{\s*setBusy\(null\);\s*\}/);
    for (const file of DESK_FILES) expect(code(read(file))).not.toMatch(/\bfetch\(/);
    // "Ask Jo" on an area's card asks at once, through the same sender, and clears its spinner whatever happens.
    expect(code(desk)).toMatch(/async function askFromCard\(handle, areaId\) \{[\s\S]*?const result = await search\.ask\(handle, areaId, ''\);[\s\S]*?finally \{\s*setBusy\(null\);\s*\}/);
    expect(read('app/mission-control/desktop/Ground.js')).toMatch(/<button key=\{p\.handle\} type="button" onClick=\{\(\) => onAsk\(p\.handle\)\} disabled=\{Boolean\(busy\)\}/);
  });

  test('a street put down from the desk is said as that, never as someone having walked it', () => {
    const insight = read('app/mission-control/lib/insight.js');
    expect(insight).toMatch(/if \(street\.marked\) facts\.push\(`\$\{who\(street\.searchedByName\)\} put it down as walked /);
    expect(insight).toMatch(/i\.marked \? `\$\{i\.searchedByName \|\| 'Someone'\} put \$\{title\} down as walked\.`/);
    // And it is not counted as a person out looking.
    expect(read('app/lib/searchPicture.js')).toMatch(/filter\(\(id\) => !isMark\(id\)\)/);
    // Ground put down as searched from the desk is said the same way, and is no visit of anyone's.
    const ground = read('app/mission-control/lib/ground.js');
    expect(ground).toMatch(/area\.marked \? `, put down by \$\{area\.searchedByName\}` : `, by \$\{area\.searchedByName\}`/);
    expect(ground).toMatch(/area\.marked \? `\$\{who\} put \$\{title\} down as searched\.` : `\$\{who\} searched \$\{title\}\.`/);
    expect(code(read('app/lib/searchZones.js'))).toMatch(/searchedById: `\$\{MARK\}\$\{searcher\.userId\}`/);
  });
});

describe('a desk steering the search is kept current, and nobody else pays for it', () => {
  const hook = code(read('app/mission-control/hooks/useSearch.js'));

  test('only the desk of whoever runs the search reads every few seconds, and only while the search is open', () => {
    expect(hook).toMatch(/const closed = picture \? !picture\.open : false;/);
    expect(hook).toMatch(/const steers = Boolean\(desk && picture\?\.viewer\?\.leads && !closed\);/);
    expect(hook).toMatch(/const interval = closed \? CLOSED_POLL_MS : steers \? STEER_POLL_MS : hot \|\| mySightings\.length \|\| onSearch \? POLL_HOT_MS : POLL_MS;/);
    expect(hook).toMatch(/const boardEvery = closed \? CLOSED_POLL_MS : steers \? STEER_POLL_MS : BOARD_POLL_MS;/);
    // A search that has ended is read rarely by everyone: a desk left on the thank-you screen does not keep asking.
    expect(Number(hook.match(/const CLOSED_POLL_MS = (\d+);/)[1])).toBeGreaterThanOrEqual(120000);
    // Someone on the search reads the small picture at the pace already kept for a fresh sighting, and the board
    // only when the picture says they were asked to walk a street.
    expect(hook).toMatch(/const onSearch = Boolean\(picture\?\.viewer && \(picture\.viewer\.isOwner \|\| volunteer \|\| everMine\.current \|\| picture\.asked \|\| picture\.words\?\.length\)\);/);
    expect(hook).toMatch(/if \(read && 'asked' in read && \(read\.asked \|\| null\) !== askedOnBoard\.current\) loadBoard\(\)\.catch\(\(\) => null\);/);
    expect(Number(hook.match(/const POLL_HOT_MS = (\d+);/)[1])).toBeGreaterThanOrEqual(10000);
    expect(Number(hook.match(/const STEER_POLL_MS = (\d+);/)[1])).toBeGreaterThanOrEqual(5000);
    // Everyone else keeps the slow polls: the reads are limited per address, and a search party can sit behind one.
    expect(Number(hook.match(/const POLL_MS = (\d+);/)[1])).toBeGreaterThanOrEqual(30000);
    expect(Number(hook.match(/const BOARD_POLL_MS = (\d+);/)[1])).toBeGreaterThanOrEqual(30000);
    // The screen says it is a desk in one place, from the instrument.
    expect(code(shell)).toMatch(/const search = useSearch\(missionParam, \{ desk: instrument === INSTRUMENTS\.COMMAND \}\);/);
    // A tab nobody is looking at reads nothing.
    expect(hook).toMatch(/if \(document\.visibilityState !== 'visible' \|\| Date\.now\(\) < pausedUntil\.current\) return;/);
  });

  test('a read that comes back the same sets nothing (that the map is then not redrawn is counted in search-map-redraw.test.js)', () => {
    expect(hook).toMatch(/const text = JSON\.stringify\(data\);\s*if \(text !== lastText\.current\.picture\) \{\s*lastText\.current\.picture = text;\s*setPicture\(data\);/);
    expect(hook).toMatch(/const text = JSON\.stringify\(data\);\s*if \(text !== lastText\.current\.board\) \{\s*lastText\.current\.board = text;\s*setBoard\(data\);/);
    expect(hook.match(/setPicture\(/g)).toHaveLength(1);
    expect(hook.match(/setBoard\(/g)).toHaveLength(1);
    // With no board there is one empty list, not a new one on every render.
    expect(hook).toMatch(/const items = board \? \(board\.unit === 'area' \? board\.areas : board\.unit === 'street' \? board\.streets : board\.cells\) \|\| NO_ITEMS : NO_ITEMS;/);
  });

  test('a read that fails holds the next ones back, and an answer that arrives late is dropped', () => {
    // Too many requests, a server error, and a link that matches no pet each pause the reads for a while.
    expect(hook).toMatch(/if \(res\.status === 404\) \{\s*pausedUntil\.current = Date\.now\(\) \+ GONE_PAUSE_MS;\s*setFailure\('gone'\);/);
    expect(hook).toMatch(/if \(!res\.ok\) pausedUntil\.current = Date\.now\(\) \+ \(res\.status === 429 \? SLOW_DOWN_MS : ERROR_PAUSE_MS\);/);
    expect(hook).toMatch(/if \(!res\.ok\) \{\s*pausedUntil\.current = Date\.now\(\) \+ \(res\.status === 429 \? SLOW_DOWN_MS : ERROR_PAUSE_MS\);\s*return null;\s*\}/);
    expect(Number(hook.match(/const ERROR_PAUSE_MS = (\d+);/)[1])).toBeGreaterThanOrEqual(15000);
    // Reads are numbered as they are sent; one that answers after a later one was shown is out of date.
    expect(hook).toMatch(/sent\.current\.picture \+= 1;\s*const turn = sent\.current\.picture;/);
    expect(hook).toMatch(/if \(turn < shown\.current\.picture\) return data;\s*shown\.current\.picture = turn;/);
    expect(hook).toMatch(/sent\.current\.board \+= 1;\s*const turn = sent\.current\.board;/);
    expect(hook).toMatch(/if \(turn < shown\.current\.board\) return data;\s*shown\.current\.board = turn;/);
  });
});

describe('what a desk says about the search is a count, a time, a distance or a published finding', () => {
  const insight = read('app/mission-control/lib/insight.js');

  test('every sentence under "What the search shows" comes from the one tested file', () => {
    const know = read('app/mission-control/desktop/Know.js');
    expect(know).toMatch(/import \{ coverage, groundLines, missingFor, researchFor, sightingLines \} from '\.\.\/lib\/insight';/);
    // On ground the sentences are the ground's own tested file (lib/ground.js); on streets, the streets' (lib/insight.js).
    expect(know).toMatch(/import \{ groundCoverage, groundLines as areaLines \} from '\.\.\/lib\/ground';/);
    expect(know).toMatch(/const ground = unit === 'area' \? areaLines\(\{ areas: items, circle, name \}\) : groundLines\(\{ items, unit, name \}\);/);
    // The only number about people is how many are on ground right now, which the areas themselves say.
    expect(know).toMatch(/<Stat value=\{g\.people\} label="searching now" \/>/);
    expect(know).toMatch(/<Stat value=\{c\.walking\} label="walking now" \/>/);
    expect(know).not.toMatch(/looking\?\.helpers/);
    expect(know).toMatch(/\{\[\.\.\.seen, \.\.\.ground\]\.map\(\(line\) => \(/);
    expect(know).toMatch(/\{study\.line\}/);
  });

  test('a published finding is shown with its source, and says nothing about this pet', () => {
    const know = read('app/mission-control/desktop/Know.js');
    expect(know).toMatch(/<a href=\{study\.url\} target="_blank" rel="noopener noreferrer"[^>]*>\s*\{study\.source\}\s*<\/a>/);
    for (const url of [...insight.matchAll(/url: '([^']+)'/g)].map((m) => m[1])) expect(url).toMatch(/^https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC\d+\/$/);
    // The rings are the study's distances drawn round where the pet was lost. The button says which distances and
    // where, and a ring on the map carries its distance and nothing else: a share of dogs written on this pet's
    // map would read as a claim about this pet.
    expect(know).toMatch(/`\$\{study\.show\} around where \$\{name\} was lost`/);
    expect(desk).toMatch(/study\.rings\.map\(\(r\) => \(\{ meters: r\.meters, label: r\.label \}\)\)/);
    expect(desk).not.toMatch(/r\.share/);
    expect(insight).not.toMatch(/share: '/);
  });

  test('it never says where the pet is, where it is going, or what anyone should do', () => {
    const said = code(insight).match(/`[^`]*`|'[^'\n]*'/g).join('\n');
    expect(said).not.toMatch(/\b(probably|likely|should|must|is heading|is moving|will be|try |go to)\b/i);
    // The sentences about ground are held to the same.
    const ground = code(read('app/mission-control/lib/ground.js')).match(/`[^`]*`|'[^'\n]*'/g).join('\n');
    expect(ground).not.toMatch(/\b(probably|likely|should|must|is heading|is moving|will be|try |go to)\b/i);
  });
});

describe('rule 1: the product never tells a helper to stop or not to search', () => {
  const STOP = /\b(stop (searching|looking|walking|the search)|do not (search|look)|don['’]t (search|look)|stand down|call(ed)? off|pause the search|hold (your )?position|stay where you are|go home|wait here)\b/i;
  const spoken = [...folderFiles, 'app/lib/searchPicture.js', 'app/lib/witness.js', 'app/api/mission/[missionId]/answer/route.js', 'app/api/mission/[missionId]/picture/route.js', ...TALKERS];

  test.each(spoken)('%s says nothing of the kind', (file) => {
    const lines = code(read(file))
      .split('\n')
      .filter((line) => STOP.test(line));
    expect(lines).toEqual([]);
  });

  test('stopping is the helper\'s own word, said by them and never to them', () => {
    for (const name of ['Area', 'Street']) {
      const card = cardsOf(helper).find((c) => c.name === name).source;
      expect(card).toMatch(/<QuietLink onClick=\{onStop\}>I am stopping<\/QuietLink>/);
    }
    const others = [...folderFiles, 'app/lib/searchPicture.js'].filter((file) => /\bstopping\b/i.test(code(read(file)).replace(/I am stopping/g, '')));
    expect(others).toEqual([]);
  });
});

describe('rule 2: nothing on the screen asks a helper to hold back', () => {
  test('no file of the screen, and nothing the picture sends, says "stay back"', () => {
    const sayers = [...folderFiles, 'app/lib/searchPicture.js', 'app/lib/witness.js'].filter((file) => /stay(ing)? back|hold back|keep (your )?distance/i.test(code(read(file))));
    expect(sayers).toEqual([]);
  });

  test('the picture carries no ask, and the screen has nothing to answer one with', () => {
    const picture = code(read('app/lib/searchPicture.js'));
    expect(picture).not.toMatch(/\bask\b|holdAsk|holdEnded/);
    const asking = folderFiles.filter((file) => /AskCard|onHold\b|'hold'|holdAskText|picture\.ask\b|onAnswer\b/.test(code(read(file))));
    expect(asking).toEqual([]);
    expect(fs.existsSync(path.join(SCREEN, 'lib', 'ask.js'))).toBe(false);
  });

  test('the one thing an owner tells the server about a sighting is that they saw it and that they are going', () => {
    const answer = read('app/api/mission/[missionId]/answer/route.js');
    expect(answer).toMatch(/const ACTIONS = \['seen', 'going'\];/);
    // Only the owner can say it: a helper or a force member answering in the owner's name is refused.
    expect(code(answer)).toMatch(/if \(!searcher\?\.isOwner\) return NextResponse\.json\(\{ error: 'Only the owner can answer a sighting\.' \}, \{ status: 403 \}\);/);
  });
});

describe('rule 3: advice is the site\'s own, word for word', () => {
  test('every block of advice names its source and is handed whole lines, never words written on the spot', () => {
    let blocks = 0;
    for (const file of STEP_FILES) {
      for (const block of read(file).match(/<AdviceBlock\b[^>]*\/>/g) || []) {
        blocks += 1;
        expect(block).toMatch(/\bsource=/);
        const lines = block.match(/lines=\{(\[[^\]]*\]|[a-zA-Z.]+)\}/);
        expect(lines).not.toBeNull();
        // No sentence is typed into the list: each entry is a value from the brief, the engine or the owner.
        expect(lines[1]).not.toMatch(/['"`]/);
      }
    }
    // A helper's area (and a helper's street, on a search from before it was on areas), the owner's sighting,
    // and what the witness reads once it is sent.
    expect(blocks).toBe(4);
  });

  test('the lines come from the three places the site already keeps them', () => {
    expect(helper).toMatch(/import \{ searcherBrief \} from '\.\.\/lib\/briefLines';/);
    expect(read('app/mission-control/lib/briefLines.js')).toMatch(/import \{ briefFor, onSeeing \} from '@\/app\/lib\/brief';/);
    expect(helper).toMatch(/lines=\{\[brief\.look\]\}/);
    // On ground the same line; round a sighting, the brief's own line on seeing the pet comes first.
    expect(helper).toMatch(/const advice = sighting \? \[brief\.never, brief\.look\] : \[brief\.look\];/);
    expect(helper).toMatch(/<AdviceBlock source="The searcher's brief" lines=\{advice\} /);
    // The desk shows the person running the search the very lines a helper is given, as values.
    expect(read('app/mission-control/desktop/Ground.js')).toMatch(/\{\(sighting \? \[brief\.never, brief\.look\] : \[brief\.look\]\)\.filter\(Boolean\)\.map\(\(line\) => \(/);
    expect(owner).toMatch(/import \{ adviceFor \} from '@\/app\/lib\/adviceFor';/);
    expect(read('app/lib/adviceFor.js')).toMatch(/from '@\/app\/lib\/petAdvice'|from '\.\/petAdvice'/);
    expect(owner).toMatch(/const first = advice\.mistakes\[0\]\?\.full;/);
    expect(witness).toMatch(/lines=\{\[picture\.approach\]\}/);
    expect(read('app/lib/searchPicture.js')).toMatch(/approach: guide\.approach \|\| ''/);
  });

  test('the owner\'s steps are the engine\'s own list, under the engine\'s own name for it', () => {
    const card = cardsOf(owner).find((c) => c.name === 'OwnerNow').source;
    expect(card).toMatch(/const steps = \[\.\.\.advice\.steps, \.\.\.advice\.more\]\.slice\(0, 5\);/);
    expect(card).toMatch(/<Eyebrow>\{advice\.source\}<\/Eyebrow>/);
    expect(card).toMatch(/\{item\.lead\}/);
  });

  test('the line on the map is the brief\'s own first sentence', () => {
    expect(shell.match(/\{brief\.neverFirst\}/g)).toHaveLength(1); // a phone; a desk has room for the whole brief
    // The sentence is the brief's own, never cut out of a line at a full stop: a pet's name can hold one.
    const lines = read('app/mission-control/lib/briefLines.js');
    expect(lines).toMatch(/neverFirst: onSeeing\(of\)/);
    expect(code(lines)).not.toMatch(/indexOf\('\.'\)/);
    expect(code(read('app/lib/witness.js'))).not.toMatch(/indexOf\('\.'\)/);
    expect(read('app/lib/brief.js')).toMatch(/\? `\$\{onSeeing\(pet\)\} Sit down, look away/);
  });

  test('a desk shows the same advice, whole, under the name of whose it is', () => {
    const know = read('app/mission-control/desktop/Know.js');
    // The owner reads the advice engine's steps, everyone else the searcher's brief: values, never sentences typed here.
    expect(know).toMatch(/const lines = isOwner \? \[\.\.\.advice\.steps, \.\.\.advice\.more\]\.map\(\(s\) => s\.lead\) : \[brief\.look, brief\.call, brief\.never\];/);
    expect(know).toMatch(/<Card title=\{isOwner \? advice\.source : "The searcher's brief"\}>/);
    expect(know).toMatch(/import \{ adviceFor \} from '@\/app\/lib\/adviceFor';/);
    expect(know).toMatch(/import \{ searcherBrief \} from '\.\.\/lib\/briefLines';/);
    expect(know).toMatch(/\{m\.full\}/);
  });

  test('the safety rules a helper agrees to are the patrol\'s own list, in one file', () => {
    expect(helper).toMatch(/import \{ SAFETY_RULES, SAFETY_AGREEMENT \} from '@\/app\/lib\/safetyRules';/);
    expect(read('app/patrol/join/page.js')).toMatch(/from '@\/app\/lib\/safetyRules'/);
  });
});

describe('the screen keeps the house rules', () => {
  test('no em dashes in its source', () => {
    const offenders = [...folderFiles, 'app/lib/searchPicture.js', 'app/lib/adviceFor.js', 'app/lib/safetyRules.js', 'app/lib/witness.js', 'app/lib/searchBoard.js', 'app/lib/streetWalks.js', ...TALKERS].filter((file) => read(file).includes('—'));
    expect(TALKERS).toEqual(expect.arrayContaining(['app/lib/searchZones.js', 'app/lib/searchCircle.js']));
    expect(offenders).toEqual([]);
  });

  test('the share link and the code to scan carry the site\'s built-in address, never the address in the browser\'s bar', () => {
    // CLAUDE.md: the site's address is built in. Someone who opened the search on the host's own name must not pass that name on.
    const offenders = folderFiles.filter((file) => /window\.location\.(origin|host|hostname|href)|location\.origin/.test(code(read(file))));
    expect(offenders).toEqual([]);
    expect(shell).toMatch(/import \{ getBaseUrl \} from '@\/app\/lib\/config';/);
    expect(code(shell).match(/`\$\{getBaseUrl\(\)\}\/join\/\$\{encodeURIComponent\(picture\.caseNumber\)\}`/g)).toHaveLength(2);
  });

  test('a sighting carries no key: nothing is kept on the phone that could change one later', () => {
    expect(read('app/lib/witness.js')).not.toMatch(/witnessKey|witnessState/);
    expect(read('app/mission-control/lib/identity.js')).not.toMatch(/\bkey\b.*rp_seen|rp_seen.*\bkey\b/);
    expect(read('prisma/schema.prisma')).not.toMatch(/\bwitnessKey\s+String/);
    // No source file reads or writes a plain key column. (Two older routes still strip the unused hash from the rows they return.)
    const appFiles = walk(path.join(FRONTEND, 'app')).map(rel);
    expect(appFiles.filter((file) => /\bwitnessKey\b(?!Hash)/.test(read(file)))).toEqual([]);
  });

  test('a sighting taken back on the day the screen allowed it stays off every screen, and the others stay on', () => {
    // A plain NOT would drop every row whose state is empty, which is all the others.
    expect(read('app/lib/searchPicture.js')).toMatch(/where: \{ OR: \[\{ witnessState: null \}, \{ witnessState: \{ not: 'NOT_THE_PET' \} \}\] \},/);
  });

  test('what the screen promises about names is true for the person reading it', () => {
    // Someone signed in is recorded as themselves, so they are not told "not your name".
    expect(witness).toMatch(/\{signedIn \? ', in your name\. Not your number\.' : '\. Not your name or number\.'\}/);
    expect(witness).toMatch(/\{signedIn \? ', in your name\. Not your number\.' : ', not your name or number\.'\}/);
    // The join card names everyone who sees a helper's first name, and only says nobody sees where they are when nothing records it.
    expect(helper).toMatch(/picture\.forces > 0 \? `\$\{ownerName\} and the Rescue Force looking for \$\{name\} see` : `\$\{ownerName\} sees`/);
    expect(helper).toMatch(/const records = instrument === 'field' && signedIn;/);
    expect(helper).toMatch(/\{records \? 'The app records your path while you walk it\.' : 'Nobody sees where you are\.'\}/);
  });
});
