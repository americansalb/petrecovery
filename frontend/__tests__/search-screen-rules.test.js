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
 *   a desk         sees and plans. It is never asked where it is and is
 *                  never handed a street.
 *   a phone        in a browser reads its position once, when asked, and
 *                  never watches it. No GPS walk.
 *   the app        does what the phone does, and records the walk.
 *
 * Three rules on what the product says (founder, 2026-11-11):
 *   1. It never tells a helper to stop or not to search.
 *   2. Nothing on the screen asks a helper to hold back. (The owner's
 *      "ask" was one more thing to answer; it went with the maze.)
 *   3. Advice is the site's own, word for word. The screen writes none.
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

/**
 * The files the screen actually loads: everything reachable from its
 * page by imports inside the folder. The folder also keeps two hooks for
 * older components elsewhere (useFlyerTracking, useScoutTips); the screen
 * does not import them, so the rules about instruments do not read them.
 */
function reachable(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = read(file);
    for (const match of source.matchAll(/(?:from\s+|import\()\s*['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      let target = null;
      if (spec.startsWith('.')) target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      else if (spec.startsWith('@/app/mission-control/')) target = spec.slice(2);
      if (!target || !target.startsWith('app/mission-control/')) continue;
      const hit = [target, `${target}.js`, `${target}/index.js`].find((candidate) => fs.existsSync(path.join(FRONTEND, candidate)) && fs.statSync(path.join(FRONTEND, candidate)).isFile());
      if (hit) queue.push(hit);
    }
  }
  return [...seen].sort();
}
const screenFiles = reachable('app/mission-control/page.js');
const shell = read('app/mission-control/SearchScreen.js');
const helper = read('app/mission-control/steps/Helper.js');
const owner = read('app/mission-control/steps/Owner.js');
const witness = read('app/mission-control/steps/Witness.js');
const STEP_FILES = ['app/mission-control/steps/Helper.js', 'app/mission-control/steps/Owner.js', 'app/mission-control/steps/Witness.js'];

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
    expect(cardsOf(helper).map((c) => c.name)).toEqual(['Main', 'Join', 'Street', 'Home']);
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
    // A place the person typed or put there by hand stands whatever the time.
    expect(code(shell)).toMatch(/function placeByHand\(value\) \{\s*setWhere\(value\);\s*setWhereFrom\(value \? 'hand' : null\);/);
    expect(shell).toMatch(/<Seen\b.*onWhere=\{placeByHand\}.*onMinutes=\{chooseWhen\}/);
  });

  test('a link that opens a card is used once: a reload or a restored tab asks the phone nothing', () => {
    expect(code(shell)).toMatch(/rest\.delete\('action'\);\s*window\.history\.replaceState\(window\.history\.state, '', `\$\{window\.location\.pathname\}\?\$\{rest\}`\);/);
    // The action is taken off the address before anything is opened.
    const effect = code(shell).slice(code(shell).indexOf("const action = params.get('action');"));
    expect(effect.indexOf('window.history.replaceState')).toBeLessThan(effect.indexOf('openSeen()'));
    // Two actions and no others: the sighting form, and the join card for someone who said "on foot" on the pet's page.
    expect([...code(shell).matchAll(/action === '([a-z]+)'/g)].map((m) => m[1]).sort()).toEqual(['sighting', 'walk']);
  });

  test('a dropped signal is words on the card, and no button is left spinning', () => {
    const hook = read('app/mission-control/hooks/useSearch.js');
    // Every write goes through the one request that answers null instead of throwing.
    expect(code(hook)).toMatch(/function send\(url, init\) \{\s*return fetch\(url, init\)\.catch\(\(\) => null\);/);
    expect(code(hook).match(/await send\(/g)).toHaveLength(5);
    expect(code(hook).match(/if \(!res\) return \{ error: NO_SIGNAL/g)).toHaveLength(5);
    // And each thing a person presses clears its own spinner whatever happens.
    for (const name of ['takeStreet', 'walked', 'stopWalking', 'sendSeen']) {
      const body = code(shell).slice(code(shell).indexOf(`async function ${name}(`));
      const end = body.indexOf('\n  }\n');
      expect({ name, ok: /finally \{\s*setBusy\(null\);\s*\}/.test(body.slice(0, end)) }).toEqual({ name, ok: true });
    }
  });

  test('"Different street" moves down the list and never hands one back', () => {
    expect(code(shell)).toMatch(/if \(exceptId\) passed\.current\.add\(exceptId\);/);
    expect(code(shell)).toMatch(/\.filter\(\(i\) => i\.id !== exceptId && !passed\.current\.has\(i\.id\)\)/);
    // A desk holds a street only if a phone took it: it cannot be handed another.
    expect(shell).toMatch(/<Street\b.*canOther=\{!desk && candidates\.length > 0\}/);
  });

  test('when no street can be given, the first card says why and nobody is sent off', () => {
    expect(code(shell)).toMatch(/setView\('main'\);\s*setProblem\(words\);/);
    expect(code(shell)).not.toMatch(/Thank you for coming/);
  });

  test('the map is looked at, not tapped', () => {
    const map = read('app/mission-control/components/SearchMap.js');
    expect(code(map)).not.toMatch(/\.on\('click'|onPick|offered|bearing/);
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
    expect(helper).toMatch(/\{recording \? ` \$\{brief\.records\}` : ''\}/);
    expect(helper.match(/brief\.records/g)).toHaveLength(1);
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
    expect(code(shell)).toMatch(/if \(here && here\.accuracy <= SIGHTING_ACCURACY_METERS\) \{\s*const point = \{ lat: here\.lat, lng: here\.lng \};\s*const spot = [^;]+;\s*phoneSpot\.current = spot;\s*setWhere\(spot\);\s*setWhereFrom\('phone'\);/);
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
    for (const file of [...STEP_FILES, 'app/mission-control/desktop/Rail.js']) {
      expect(read(file)).not.toMatch(/\.locate\(|geolocation/);
    }
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

describe('rule 1: the product never tells a helper to stop or not to search', () => {
  const STOP = /\b(stop (searching|looking|walking|the search)|do not (search|look)|don['’]t (search|look)|stand down|call(ed)? off|pause the search|hold (your )?position|stay where you are|go home|wait here)\b/i;
  const spoken = [...folderFiles, 'app/lib/searchPicture.js', 'app/lib/witness.js', 'app/api/mission/[missionId]/answer/route.js', 'app/api/mission/[missionId]/picture/route.js'];

  test.each(spoken)('%s says nothing of the kind', (file) => {
    const lines = code(read(file))
      .split('\n')
      .filter((line) => STOP.test(line));
    expect(lines).toEqual([]);
  });

  test('stopping is the helper\'s own word, said by them and never to them', () => {
    const street = cardsOf(helper).find((c) => c.name === 'Street').source;
    expect(street).toMatch(/<QuietLink onClick=\{onStop\}>I am stopping<\/QuietLink>/);
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
    // A helper's street, the owner's sighting, and what the witness reads once it is sent.
    expect(blocks).toBe(3);
  });

  test('the lines come from the three places the site already keeps them', () => {
    expect(helper).toMatch(/import \{ searcherBrief \} from '\.\.\/lib\/briefLines';/);
    expect(read('app/mission-control/lib/briefLines.js')).toMatch(/import \{ briefFor \} from '@\/app\/lib\/brief';/);
    expect(helper).toMatch(/lines=\{\[brief\.look\]\}/);
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
    expect(shell.match(/\{brief\.neverFirst\}/g)).toHaveLength(2); // a desk and a phone
    expect(read('app/mission-control/lib/briefLines.js')).toMatch(/neverFirst: never\.slice\(0, never\.indexOf\('\.'\) \+ 1\)/);
  });

  test('the safety rules a helper agrees to are the patrol\'s own list, in one file', () => {
    expect(helper).toMatch(/import \{ SAFETY_RULES, SAFETY_AGREEMENT \} from '@\/app\/lib\/safetyRules';/);
    expect(read('app/patrol/join/page.js')).toMatch(/from '@\/app\/lib\/safetyRules'/);
  });
});

describe('the screen keeps the house rules', () => {
  test('no em dashes in its source', () => {
    const offenders = [...folderFiles, 'app/lib/searchPicture.js', 'app/lib/adviceFor.js', 'app/lib/safetyRules.js', 'app/lib/witness.js', 'app/lib/searchBoard.js', 'app/lib/streetWalks.js'].filter((file) => read(file).includes('—'));
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
