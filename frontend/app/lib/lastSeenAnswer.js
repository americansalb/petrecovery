/**
 * When the pet went missing, or was found, as the person answered it.
 *
 * The report wizards ask how long ago in bands ("A few hours ago" is one to
 * six hours, "Longer than a week" is a week or more), not for a clock time.
 * Case.lastSeenAt is a single moment, and the schema has no column that
 * says the moment is an estimate, so the answer is kept in the two times
 * the report row already has: lastSeenAt is written as createdAt minus the
 * band's hours, inside the same request. `answerOf(case)` reads the band
 * back from that difference, and `lastSeenWords(case)` gives the words to
 * show instead of a clock time or an exact count of hours. A time the owner
 * later sets by hand no longer sits on a band's mark, so it reads as exact.
 *
 * Before this, "A few hours ago" was shown as "Missing 3 hours" and "Lost
 * here 10:07 am", and "Longer than a week" was stored as fifteen days.
 */

const HOUR_MS = 60 * 60 * 1000;

/**
 * The wizard's values (app/components/report/wizardTheme.js), the hours
 * written into lastSeenAt for each, and the words that say what was
 * answered. `days` marks the bands too long for a time of day to mean
 * anything. 'more_than_2_weeks' is the value the lost wizard sends for
 * "Longer than a week": it is stored as a week, the least it can be.
 */
export const LAST_SEEN_ANSWERS = {
  less_than_hour: { hours: 0.5, words: 'within the hour', days: false },
  '1_to_6_hours': { hours: 3, words: 'a few hours', days: false },
  '6_to_24_hours': { hours: 12, words: 'less than a day', days: false },
  '1_to_3_days': { hours: 48, words: 'a day or two', days: true },
  '3_to_7_days': { hours: 120, words: 'three to seven days', days: true },
  '1_to_2_weeks': { hours: 240, words: 'one to two weeks', days: true },
  more_than_2_weeks: { hours: 168, words: 'more than a week', days: true, atLeast: true },
};

/** The answer used when none was sent: the old default, half a day. */
const DEFAULT_ANSWER = '6_to_24_hours';

/** How far apart the two times may be and still be the same answer: the request's own few milliseconds, generously. */
const SAME_ANSWER_MS = 2 * 60 * 1000;

/** The answer's key, or the default when the value is not one of the wizard's. */
export function answerKey(value) {
  return Object.prototype.hasOwnProperty.call(LAST_SEEN_ANSWERS, value) ? value : DEFAULT_ANSWER;
}

/** The moment to store for an answer, counted back from `now`. */
export function lastSeenFromAnswer(value, now = new Date()) {
  const { hours } = LAST_SEEN_ANSWERS[answerKey(value)];
  return new Date(new Date(now).getTime() - hours * HOUR_MS);
}

/**
 * The band a stored report was answered with, or null when its time is a
 * real one. Reads createdAt and lastSeenAt.
 */
export function answerOf(c) {
  if (!c?.lastSeenAt || !c?.createdAt) return null;
  const gap = new Date(c.createdAt).getTime() - new Date(c.lastSeenAt).getTime();
  if (!Number.isFinite(gap)) return null;
  for (const [key, band] of Object.entries(LAST_SEEN_ANSWERS)) {
    if (Math.abs(gap - band.hours * HOUR_MS) <= SAME_ANSWER_MS) return { key, ...band };
  }
  return null;
}

/**
 * How long, as it was answered: "a few hours", "more than a week" (before
 * the report was made). Null when the time is a real one, which the caller
 * shows as it is.
 */
export function lastSeenWords(c) {
  return answerOf(c)?.words || null;
}
