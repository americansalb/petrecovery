/**
 * Source guards for client defects that no node-environment test could
 * have caught, because the game's screens are never rendered here.
 *
 * Each one shipped or nearly shipped, and each one was silent: Apple
 * rooms with no way to guess, a scored guess relabelled "time ran out",
 * a script round recorded twice, a script map replaced by its own
 * fallback seconds after it drew. The guards are deliberately narrow -
 * they check the one expression that was wrong, not the shape of the
 * file around it.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('RoomClient: the guess map is gated on the SDK the room is on', () => {
  const src = read('app/geo/components/RoomClient.js');

  test('the map block is gated on imageryReady, not on the Google handle', () => {
    // `api` is only ever set by the Google branch of the SDK effect, so
    // gating the shared map block on it left Apple rooms with no map and
    // no Guess button: every round timed out at zero for everyone.
    expect(src).toContain('{imageryReady && joined ? (');
    expect(src).not.toContain('{api && joined ? (');
  });

  test('imageryReady is the handle the room actually draws with', () => {
    // It used to read the Google handle, which an Apple room never
    // sets. There is one imagery now, so there is one handle, and
    // nothing here may reach for a second.
    expect(src).toMatch(/const imageryReady = Boolean\(mapkit\);/);
    expect(src).not.toMatch(/Boolean\(api\)/);
  });

  test('the map block still holds the map and the submit button', () => {
    const block = src.slice(src.indexOf('{imageryReady && joined ? ('));
    const end = block.indexOf('{/* Screens */}');
    const map = block.slice(0, end);
    expect(map).toContain('<AppleGuessMap');
    expect(map).toContain('onClick={submitGuess}');
    // The harness clicks this rather than the label, which now changes
    // with the pin ("Guess" / "Sending") while the hook does not.
    expect(map).toContain('data-geo-guess');
  });
});

describe('PlayClient: the server decides whether a round timed out', () => {
  const src = read('app/geo/components/PlayClient.js');

  test('the stored round takes timedOut from the response, not from the caller', () => {
    // Retrying a failed send passed timedOut:true purely to allow an
    // empty guess, and that flag then overwrote the server's answer: a
    // guess that was placed, sent and scored was shown as "Time ran out
    // before a guess", with the real score next to it.
    expect(src).toContain('timedOut: data.result?.timedOut ?? !guess');
    expect(src).not.toMatch(/timedOut: timedOut/);
  });

  test('the clock and the retry ask for an empty guess, not for a timeout label', () => {
    expect(src).toContain('{ allowEmpty: true }');
    expect(src).not.toMatch(/submitGuess\(undefined, \{ timedOut: true \}\)/);
  });
});

describe('ScriptPlayClient: the clock submits once, outside the state updater', () => {
  const src = read('app/geo/components/script/ScriptPlayClient.js');

  test('no submit happens inside a setSecondsLeft updater', () => {
    // React 18 Strict Mode double-invokes updaters, and both invocations
    // saw the same unblocked guard, so the round was posted and appended
    // to history twice: double score, and a five-round game that ended
    // after four.
    expect(src).not.toMatch(/setSecondsLeft\(\([^)]*\) => \{[\s\S]*?submitRef\.current/);
  });

  test('the timeout submit is fired once per round, keyed off the round token', () => {
    expect(src).toContain('firedRef.current === round.token');
    expect(src).toContain('firedRef.current = round.token;');
  });
});

describe('the script round always has a map it can be played on', () => {
  const client = read('app/geo/components/script/ScriptPlayClient.js');
  const apple = read('app/geo/components/script/AppleScriptMap.js');

  test('the round is played on Apple, with the keyless map behind it', () => {
    expect(client).toContain('<AppleScriptMap');
    expect(client).toContain('<LeafletScriptMap');
    // And nothing else. A fallback billed per map load would cost real
    // money on exactly the days Apple is not drawing, which is a worse
    // problem than the one it solves.
    expect(client).not.toContain('GoogleScriptMap');
  });

  test('Apple answering slowly is not Apple refusing', () => {
    // The round used to give MapKit three seconds to confirm the token
    // after the script landed and read the silence as a no. Any page
    // where the Initialized event had already fired before this screen
    // mounted, and any connection slow enough to miss the window, drew
    // the keyless map on a site where Apple works. There is one clock
    // now and it is for the script never arriving.
    expect(client).not.toContain('MAPKIT_AUTH_MS');
    const settle = client.slice(client.indexOf('const settle = (state)'));
    const body = settle.slice(0, settle.indexOf('};'));
    // Only a refusal moves the round. Nothing in here fires on silence.
    expect(body).toContain("if (state === 'failed') setProvider('leaflet');");
    expect(body).not.toContain('setTimeout');
  });

  test('a refusal is latched, so the map is never swapped out mid-round', () => {
    // Apple is only ever chosen out of 'pending', so an authorization
    // that lands after a refusal has already moved the round cannot
    // drag it back to Apple and take the placed pin with it.
    expect(client).toContain("setProvider((current) => (current === 'pending' ? 'apple' : current))");
  });

  test("Apple writes nothing on the map of its own", () => {
    // The round asks which language, and in South Asia the state is the
    // answer: Tamil Nadu, Punjab, Gujarat, Karnataka, West Bengal. A
    // map that labels itself hands the round over before the guess.
    expect(apple).toContain('map.labels = false');
    expect(apple).toContain('map.showsPointsOfInterest = false');
  });

  test('the names on the map are the game\'s own, and are country names', () => {
    expect(apple).toContain("import('@/app/lib/geo/data/country-labels.json')");
    expect(apple).toContain('wg-country-label');
  });
});

describe('RoomClient: only players load billed imagery', () => {
  const src = read('app/geo/components/RoomClient.js');

  test('the panorama panes are gated on having joined', () => {
    // The joined check was applied to the cheap component (the guess
    // map) and missed on the expensive one, so anyone who opened the
    // room link mounted a Street View pane and loaded a panorama for
    // every round, charged to nobody.
    expect(src).toMatch(/const showApple = mapkit && joined &&/);
  });
});

