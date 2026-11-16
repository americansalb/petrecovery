/**
 * When the pet went missing, as the person answered it (app/lib/lastSeenAnswer.js).
 *
 * The wizards ask in bands, not for a clock time. "A few hours ago" used to
 * be shown as "Missing 3 hours" and "Lost here 10:07 am", and "Longer than a
 * week" was stored as fifteen days. The band is now kept in the report's two
 * times and read back from them, so a screen can say what was answered.
 */

import { lastSeenFromAnswer, answerOf, lastSeenWords, answerKey, LAST_SEEN_ANSWERS } from '@/app/lib/lastSeenAnswer';

const NOW = new Date('2026-11-16T15:07:00Z');
const HOUR = 3600e3;

test('"Longer than a week" is stored as a week, the least it can be, not fifteen days', () => {
  const at = lastSeenFromAnswer('more_than_2_weeks', NOW);
  expect(NOW.getTime() - at.getTime()).toBe(7 * 24 * HOUR);
});

test('each band reads back from the report it was stored on, with the words for it', () => {
  for (const key of Object.keys(LAST_SEEN_ANSWERS)) {
    const report = { createdAt: NOW, lastSeenAt: lastSeenFromAnswer(key, NOW) };
    expect(answerOf(report)?.key).toBe(key);
  }
  expect(lastSeenWords({ createdAt: NOW, lastSeenAt: lastSeenFromAnswer('1_to_6_hours', NOW) })).toBe('a few hours');
  expect(lastSeenWords({ createdAt: NOW, lastSeenAt: lastSeenFromAnswer('more_than_2_weeks', NOW) })).toBe('more than a week');
});

test('a few seconds between the two writes is still the same answer', () => {
  const report = { createdAt: new Date(NOW.getTime() + 4000), lastSeenAt: lastSeenFromAnswer('1_to_6_hours', NOW) };
  expect(answerOf(report)?.key).toBe('1_to_6_hours');
});

test('a time the owner set by hand is a real time and has no band', () => {
  const report = { createdAt: NOW, lastSeenAt: new Date(NOW.getTime() - (2 * HOUR + 17 * 60e3)) };
  expect(answerOf(report)).toBeNull();
  expect(lastSeenWords(report)).toBeNull();
  expect(answerOf({ lastSeenAt: NOW })).toBeNull();
});

test('a value the wizard does not send falls back to half a day, as before', () => {
  expect(answerKey('nonsense')).toBe('6_to_24_hours');
  expect(NOW.getTime() - lastSeenFromAnswer(undefined, NOW).getTime()).toBe(12 * HOUR);
});
