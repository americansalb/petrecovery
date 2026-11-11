/**
 * The rules the search screen (Mission Control) is built on, checked
 * against its source. Like global-chrome.test.js this is static: no DOM,
 * fast, and it fails in CI the moment someone writes past a rule.
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
 *   2. Holding people back is the owner's or the lead's ask, in their
 *      name, and a helper can decline.
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

// The GPS walk's own machinery: only the app runs it.
const RECORDER = ['app/mission-control/hooks/useSearchLeg.js', 'app/mission-control/hooks/useSearchSession.js', 'app/mission-control/components/FieldGps.js'];

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
    expect(helper).toMatch(/\{recording \? brief\.records : /);
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
  });

  test('a reading too rough to name a street is never sent as a sighting', () => {
    expect(shell).toMatch(/const SIGHTING_ACCURACY_METERS = \d+;/);
    const limit = Number(shell.match(/const SIGHTING_ACCURACY_METERS = (\d+);/)[1]);
    expect(limit).toBeLessThanOrEqual(200);
    expect(code(shell)).toMatch(/if \(!here \|\| !\(here\.accuracy <= SIGHTING_ACCURACY_METERS\)\) \{/);
  });
});

describe('three instruments: a desk is never asked where it is and is never handed a street', () => {
  test('every position read in the screen goes through one function, and a desk gets no reading', () => {
    expect(code(shell)).toMatch(/const locate = useCallback\(\(options\) => \(desk \? Promise\.resolve\(null\) : readPosition\(options\)\), \[desk, readPosition\]\);/);
    // The hook's own reader is named once, to build that function, and never called directly.
    expect(code(shell).match(/search\.locate/g)).toHaveLength(1);
    expect(code(shell)).not.toMatch(/search\.locate\(/);
    for (const file of ['app/mission-control/steps/Helper.js', 'app/mission-control/steps/Owner.js', 'app/mission-control/steps/Witness.js', 'app/mission-control/desktop/Rail.js']) {
      expect(read(file)).not.toMatch(/\.locate\(|geolocation/);
    }
  });

  test('"I\'ve seen" from a desk is a typed street, not the desk\'s position', () => {
    expect(code(shell)).toMatch(/if \(desk\) \{\s*setEarlierFrom\(30\);\s*return go\('seenEarlier'\);\s*\}/);
    // Every way into the sighting steps goes through that one function.
    expect(code(shell).match(/go\('seen'\)/g)).toHaveLength(1);
    expect(code(shell)).not.toMatch(/setView\('seen'\)/);
  });

  test('the typed-street form does not offer "Use my location" on a desk', () => {
    expect(shell).toMatch(/<SeenEarlier\b.*canLocate=\{!desk\}/);
    expect(witness).toMatch(/<LocationPicker value=\{where\} onChange=\{setWhere\} variant="lost" canLocate=\{canLocate\} \/>/);
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

  test('"stay back" is said to a helper only as the owner\'s ask, or as the helper\'s own answer', () => {
    // The sentence itself lives in two places that a test holds together (searchWords.test.js).
    const sayers = [...folderFiles, 'app/lib/searchPicture.js'].filter((file) => /Please stay back/.test(read(file)));
    expect(sayers.sort()).toEqual(['app/lib/searchPicture.js', 'app/mission-control/lib/ask.js']);
    // On a helper's screen the only other uses are the helper's own words.
    const left = code(helper)
      .replace(/I will stay back/g, '')
      .replace(/'stay back'/g, '');
    expect(left).not.toMatch(/stay back/i);
    // A witness is never told to stay back by the screen: how to behave near the pet is the owner's own answer.
    expect(code(witness)).not.toMatch(/stay back/i);
  });

  test('a sighting screen says what was seen and gives the helper a way to carry on', () => {
    const sighting = helper.slice(helper.indexOf('export function SightingIn'), helper.indexOf('export function Home'));
    expect(sighting).toMatch(/was seen/);
    expect(sighting).toMatch(/'Back to my street' : 'Back to the map'/);
    // With no ask from the owner there is nothing to answer.
    expect(sighting).toMatch(/\{ask && mine && !answered && \(/);
  });
});

describe('rule 2: holding people back is a person\'s ask, in their name, and can be declined', () => {
  test('the ask on a helper\'s screen is the one the picture carries, shown under a name', () => {
    expect(shell).toMatch(/ask=\{picture\.ask && picture\.ask\.sightingId === hot\.id \? picture\.ask : null\}/);
    expect(helper).toMatch(/\{ask && <AskCard from=\{ask\.from \|\| owner\?\.firstName\} text=\{ask\.text\}/);
    expect(read('app/mission-control/components/kit.js')).toMatch(/\{from \|\| 'The owner'\} \{who\}/);
  });

  test('the two answers are the same button, side by side', () => {
    const answers = helper.match(/<Second onClick=\{\(\) => onAnswer\('(back|looking)'\)\} className="([^"]*)">\s*(I will stay back|I will keep looking)\s*<\/Second>/g) || [];
    expect(answers).toHaveLength(2);
    const classes = answers.map((a) => a.match(/className="([^"]*)"/)[1]);
    expect(classes[0]).toBe(classes[1]);
    expect(helper).toMatch(/<div className="mt-4 grid grid-cols-2 gap-2\.5">\s*<Second onClick=\{\(\) => onAnswer\('back'\)\}/);
  });

  test('the owner\'s switch is off until the owner turns it on, shows the words that go out, and says helpers can decline', () => {
    expect(owner).toMatch(/checked=\{hot\.hold\}/);
    expect(owner).toMatch(/'Off\. Nobody is asked to stop\.'/);
    expect(owner).toMatch(/They got: "\$\{holdAskTextFor\(name\)\}" They can decline\./);
    // Only the owner's step can send it.
    const senders = folderFiles.filter((file) => /onHold|'hold'/.test(code(read(file))));
    expect(senders.sort()).toEqual(['app/mission-control/SearchScreen.js', 'app/mission-control/steps/Owner.js']);
  });

  test('on the server, a hold is on only when someone asked and has not ended it', () => {
    const picture = read('app/lib/searchPicture.js');
    expect(picture).toMatch(/hold: Boolean\(s\.holdAskedAt && !s\.holdEndedAt\)/);
    const schema = read('prisma/schema.prisma');
    expect(schema).toMatch(/\n\s+holdAskedAt\s+DateTime\?\n/);
    expect(schema).toMatch(/\n\s+holdEndedAt\s+DateTime\?\n/);
  });
});

describe('rule 3: advice is the site\'s own, word for word', () => {
  const stepFiles = ['app/mission-control/steps/Helper.js', 'app/mission-control/steps/Owner.js', 'app/mission-control/steps/Witness.js'];

  test('every block of advice names its source and is handed whole lines, never words written on the spot', () => {
    let blocks = 0;
    for (const file of stepFiles) {
      for (const block of read(file).match(/<AdviceBlock\b[^>]*\/>/g) || []) {
        blocks += 1;
        expect(block).toMatch(/\bsource=/);
        const lines = block.match(/lines=\{(\[[^\]]*\]|[a-zA-Z.]+)\}/);
        expect(lines).not.toBeNull();
        // No sentence is typed into the list: each entry is a value from the brief, the engine or the owner.
        expect(lines[1]).not.toMatch(/['"`]/);
      }
    }
    // Walking, a sighting coming in, the owner's sighting, and the witness's screens.
    expect(blocks).toBe(4);
  });

  test('the lines come from the three places the site already keeps them', () => {
    expect(helper).toMatch(/import \{ searcherBrief \} from '\.\.\/lib\/briefLines';/);
    expect(read('app/mission-control/lib/briefLines.js')).toMatch(/import \{ briefFor \} from '@\/app\/lib\/brief';/);
    expect(owner).toMatch(/import \{ adviceFor \} from '@\/app\/lib\/adviceFor';/);
    expect(read('app/lib/adviceFor.js')).toMatch(/from '@\/app\/lib\/petAdvice'|from '\.\/petAdvice'/);
    expect(witness).toMatch(/lines=\{\[picture\.approach\]\}/);
    expect(read('app/lib/searchPicture.js')).toMatch(/approach: guide\.approach \|\| ''/);
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

  test('one yellow button to a step', () => {
    // <Primary> is the one yellow button. A step may branch between two, and never shows two at once.
    for (const [name, source] of [['Helper', helper], ['Owner', owner], ['Witness', witness]]) {
      const steps = source.split(/\nexport function /).slice(1);
      for (const step of steps) {
        const title = step.slice(0, step.indexOf('('));
        const count = (code(step).match(/<Primary\b/g) || []).length;
        expect({ file: name, step: title, ok: count <= 2 }).toEqual({ file: name, step: title, ok: true });
      }
    }
  });
});
