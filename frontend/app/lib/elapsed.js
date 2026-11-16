/**
 * How many whole days have passed. Every count of days the site shows for
 * a pet (the pet's page, the search screen's top line, the desk's map
 * labels, its Ground list and its "missing" figure, a link preview) comes
 * from here, so one pet is never "Missing 2 days" on one screen and "Lost
 * 3 days ago" on another at the same moment.
 *
 * A part of a day is not counted: 2 days and 20 hours is 2 days, the way a
 * person says how long something has been.
 */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days in `ms` milliseconds. Never negative. */
export function wholeDays(ms) {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 ? Math.floor(n / DAY_MS) : 0;
}
