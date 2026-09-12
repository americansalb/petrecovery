/**
 * Kidnapped mode: the car drives itself down the road. Pure helpers,
 * tested without a browser; GoogleStreetViewPane runs them on a clock.
 *
 * Each step takes the Street View link closest to the direction of
 * travel, never turning back (more than 100 degrees) unless the road
 * ends, and keeps the way the passenger is looking relative to the road.
 */

/**
 * Every hop is a fresh Street View panorama load, and a panorama load is
 * what Google bills. At the old 1.1 s a three-minute round bought about
 * 163 of them while the play meter recorded one round, so the pace and
 * the total are both bounded now: 72 hops is the whole of a 180-second
 * round at this step, and the meter charges the site's budget for them
 * (app/lib/geo/meter.js, KIDNAPPED_LOADS).
 */
export const DRIVE_STEP_MS = 2500;
/** The most panorama loads one driven round may buy. */
export const MAX_DRIVE_HOPS = 72;
/** A link is a few dozen metres; a longer hop is a new round or a jump, not driving. */
export const MAX_HOP_KM = 1;
const TURN_BACK_DEGREES = 100;

export function normalizeHeading(heading) {
  return ((((Number(heading) || 0) % 360) + 360) % 360);
}

/** Signed difference a - b in degrees, in (-180, 180]. */
export function angleDiff(a, b) {
  let d = (normalizeHeading(a) - normalizeHeading(b)) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * The link to take next, or null when there is none. A dead end turns
 * the car around: the only way on is the way back.
 */
export function pickLink(links, travelHeading) {
  const usable = (Array.isArray(links) ? links : []).filter((link) => link && link.pano);
  if (!usable.length) return null;
  const scored = usable
    .map((link) => ({ link, turn: Math.abs(angleDiff(link.heading, travelHeading)) }))
    .sort((a, b) => a.turn - b.turn);
  const ahead = scored.filter((s) => s.turn <= TURN_BACK_DEGREES);
  return (ahead[0] || scored[scored.length - 1]).link;
}
