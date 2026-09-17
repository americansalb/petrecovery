/**
 * The room settings offer modes the game has.
 *
 * ROOM_MODES listed 'world' and 'cities' for months after MODES stopped
 * having them. Nothing broke, because roomConfig() filters the list
 * against MODES before using it - which is exactly why nobody noticed,
 * and which would have swallowed a real mode added here with a typo the
 * same way.
 */

const { ROOM_MODES, ROOM_ROUND_OPTIONS, ROOM_TIME_OPTIONS, DEFAULT_ROOM_TIME, VARIANTS } = require('@/app/lib/geo/rooms');
const { MODES } = require('@/app/lib/geo/modes');

test('every room mode is a mode', () => {
  const missing = ROOM_MODES.filter((id) => !MODES[id]);
  expect(missing).toEqual([]);
});

test('every room mode can be played on Apple, which is the only imagery', () => {
  const unplayable = ROOM_MODES.filter((id) => !MODES[id]?.providers?.includes('apple'));
  expect(unplayable).toEqual([]);
});

test('the default time is one of the offered times, and the rounds are sane', () => {
  expect(ROOM_TIME_OPTIONS).toContain(DEFAULT_ROOM_TIME);
  expect(ROOM_ROUND_OPTIONS.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
});

test('both variants describe themselves without counting anything', () => {
  // A description that names a number is a number that drifts
  // (copy-counts.test.js makes the same check for the script ladders).
  for (const [id, variant] of Object.entries(VARIANTS)) {
    expect({ id, description: Boolean(variant.description) }).toEqual({ id, description: true });
    expect(variant.description).not.toMatch(/\d/);
  }
});
