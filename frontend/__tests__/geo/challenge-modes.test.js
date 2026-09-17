/**
 * A challenge is a mode played against a board, and three places in the
 * code have to agree on which modes those are.
 *
 * The server hands a challenge round to ONE profile and reveals its
 * answer to nobody else, because a round token used to be a bearer
 * credential: anyone holding it could read the answer with no identity
 * and no side effect, then replay the round under a real profile for a
 * perfect score. Two things follow, and both need the same list:
 *
 *  - the browser must have a profile BEFORE it asks for the round, or
 *    it is handed one it will then be refused a score on;
 *  - the guess route must refuse a round whose subject is somebody else.
 *
 * They were written out separately and they disagreed. `ranked` was in
 * the server's list and missing from the browser's, so Ranked worked
 * from the old lobby, which happened to create a profile before
 * navigating, and was refused from anywhere else. Deleting that lobby
 * turned a latent bug into a broken button, and a link straight to
 * /geo/play?mode=ranked had been broken the whole time.
 */

const fs = require('fs');
const path = require('path');
const { CHALLENGE_MODES, isChallengeMode, MODES } = require('@/app/lib/geo/modes');

const read = (rel) => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

describe('one list of the modes played against a board', () => {
  test('it names the three, and nothing else', () => {
    expect([...CHALLENGE_MODES].sort()).toEqual(['cup', 'daily', 'ranked']);
    for (const mode of CHALLENGE_MODES) {
      // A mode that does not exist cannot be played against anything.
      expect({ mode, defined: Boolean(MODES[mode]) }).toEqual({ mode, defined: true });
      // Everyone gets the same places, so the set has to be fixed.
      expect({ mode, fixed: Boolean(MODES[mode].fixed) }).toEqual({ mode, fixed: true });
    }
    for (const mode of ['balanced', 'continent', 'country', 'streak']) {
      expect({ mode, challenge: isChallengeMode(mode) }).toEqual({ mode, challenge: false });
    }
    expect(isChallengeMode(undefined)).toBe(false);
    expect(isChallengeMode('')).toBe(false);
  });

  test.each([
    ['the browser, before it asks for a round', 'app/geo/components/PlayClient.js'],
    ['the guess route, before it reveals one', 'app/api/geo/guess/route.js'],
    ['the challenge record', 'app/lib/geo/server/challenges.js'],
  ])('%s reads the list rather than repeating it', (_what, file) => {
    const source = read(file);
    expect(source).toContain('isChallengeMode');
    // The shape that drifted: all three named in one expression, where
    // dropping one is invisible. A TWO-mode test is a different
    // question and stays allowed - the summary shows a board after a
    // daily or a cup and a rating change after a ranked set, which is
    // membership of its own, not a copy of this list gone wrong.
    for (const line of source.split('\n')) {
      const named = ['daily', 'cup', 'ranked'].filter((mode) => line.includes(`=== '${mode}'`));
      expect({ line: line.trim().slice(0, 80), named: named.length }).not.toEqual(
        expect.objectContaining({ named: 3 })
      );
    }
  });

  test('the browser waits for a profile on every one of them', () => {
    // Not on the ordinary modes: an anonymous round is the whole point
    // of being able to play without an account.
    const play = read('app/geo/components/PlayClient.js');
    expect(play).toContain('const needsProfile = isChallengeMode(config.mode)');
    expect(play).toContain('if (needsProfile && !profileSettled) return;');
  });
});
