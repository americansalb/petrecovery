/**
 * Source guards for three client defects that no node-environment test
 * could have caught, because the game's screens are never rendered here.
 *
 * Each one shipped and each one was silent: Apple rooms with no way to
 * guess, a scored guess relabelled "time ran out", and a script round
 * recorded twice. The guards are deliberately narrow - they check the one
 * expression that was wrong, not the shape of the file around it.
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

  test('imageryReady answers for the provider the room is actually on', () => {
    expect(src).toMatch(/const imageryReady = isApple \? Boolean\(mapkit\) : Boolean\(api\);/);
  });

  test('the map block still holds both maps and the submit button', () => {
    const block = src.slice(src.indexOf('{imageryReady && joined ? ('));
    const end = block.indexOf('{/* Screens */}');
    const map = block.slice(0, end);
    expect(map).toContain('<AppleGuessMap');
    expect(map).toContain('<GoogleGuessMap');
    expect(map).toContain('onClick={submitGuess}');
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
