/**
 * The trail: the game the search plays with the people helping.
 *
 * Founder, 2026-11-13: "one of the things we are missing is our mascot
 * Sarama, beautifully guiding everyone. This has to feel like a fun game
 * and drive engagement, not feel like a chore."
 *
 * Sarama, the search dog on every card, is the guide
 * (app/mission-control/components/Sarama.js, and her lines in
 * app/mission-control/lib/sarama.js). What a helper does leaves paw
 * prints on the pet's search, the prints add up to a rank, and the whole
 * neighborhood has one goal it can see: keep the map green, which fades
 * by itself over a day (app/mission-control/lib/ground.js).
 *
 * What earns prints is what helps a search, and nothing else:
 *
 *  - An area searched, and one more for the debrief on it. Never more for
 *    saying "all of it": a reward for the answer would buy the answer.
 *  - Nothing for speed, for how many areas in an hour, or for going near
 *    the animal. A game that pays for those gets people hurt and drives a
 *    scared dog off (app/lib/searchPlan.js).
 *  - There is no board of who has the most. People looking for the same
 *    pet are one team, and the count everyone sees is the team's.
 *
 * The prints are worked out from the record of searches every time, so
 * there is nothing to award, lose or cheat: they are the record, counted.
 * Pure, so the server and the screen count the same way.
 *
 * A search far shorter than the area takes one person (under a third of
 * its time: app/lib/searchCircle.js, isShortSearch) leaves no prints, and
 * neither does a debrief on it. "I searched it" fourteen seconds after
 * taking an area went over no ground, and paying it the three prints a
 * search earns would pay for speed: tapping it straight away, over and
 * over, would be the quickest way up the ranks. A third is where the
 * record already calls a search far shorter than the area takes, so the
 * prints and the record agree; between a third and the full time the
 * person did cover real ground, the map counts it for less, and someone
 * who had twenty minutes for a forty-five minute area has helped. A search
 * whose time is not known (said after the site had stopped counting the
 * person there) is never called short. The server marks each finished
 * search `short` (app/lib/searchZones.js), so nothing here reads a clock.
 */
import { isShortSearch } from '@/app/lib/searchCircle';

export const PAWS = Object.freeze({ SEARCH: 3, DEBRIEF: 1 });

/** Ranks by paw prints on one pet's search, highest first. */
export const RANKS = Object.freeze([
  { at: 20, name: 'Trail lead' },
  { at: 8, name: 'Tracker' },
  { at: 1, name: 'Scout' },
]);

export const pawsFor = ({ searches = 0, debriefs = 0 } = {}) => searches * PAWS.SEARCH + debriefs * PAWS.DEBRIEF;

/** The rank a count of prints is, or '' before the first. */
export function rankOf(paws = 0) {
  return RANKS.find((r) => paws >= r.at)?.name || '';
}

/** The next rank up and how many prints it is away, or null at the top. */
export function nextRank(paws = 0) {
  const above = [...RANKS].reverse().find((r) => paws < r.at);
  return above ? { name: above.name, need: above.at - paws } : null;
}

/**
 * The trail of one search from its finished searches: the team's prints
 * and how many people left them, and the reader's own. `finished`:
 * [{ outcome, searcherId, covered, short }]. Ground put down from the desk
 * is not a helper's search and leaves no prints, and a search far shorter
 * than the area takes (`short`) leaves none either, debrief or not.
 */
export function trailOf(finished = [], viewer = null) {
  const all = { searches: 0, debriefs: 0 };
  const mine = { searches: 0, debriefs: 0 };
  const people = new Set();
  for (const one of finished) {
    if (!one || one.outcome !== 'SEARCHED' || one.short) continue;
    all.searches += 1;
    if (one.covered) all.debriefs += 1;
    people.add(one.searcherId);
    if (viewer && one.searcherId === viewer) {
      mine.searches += 1;
      if (one.covered) mine.debriefs += 1;
    }
  }
  return { paws: pawsFor(all), helpers: people.size, mine: viewer ? { ...mine, paws: pawsFor(mine), rank: rankOf(pawsFor(mine)) } : null };
}

/** How long an area counts as fresh for the goal everyone shares. */
export const FRESH_HOURS = 12;
const FRESH_MS = FRESH_HOURS * 60 * 60 * 1000;

/**
 * Whether an area was searched in the last twelve hours, by a search that
 * went over the ground: one far shorter than the area takes does not keep
 * the map green, as the map itself counts it for next to nothing. Read
 * from the area's searches where the board sends them, and from its last
 * search where it does not.
 */
export function searchedLately(area, now = Date.now()) {
  const within = (at) => Boolean(at) && now - new Date(at).getTime() < FRESH_MS;
  const kept = Array.isArray(area?.history) && area.history.length ? area.history : null;
  if (!kept) return within(area?.searchedAt);
  return kept.some((one) => within(one.at) && !isShortSearch(one, area));
}

/**
 * The shared goal, as a count anyone can check: how many of the search's
 * own areas were searched in the last twelve hours or are being searched
 * now. `areas`: the board's, the circle round a sighting left out.
 */
export function freshAreas(areas = [], now = Date.now()) {
  const own = areas.filter((a) => a && a.ring !== 3);
  const fresh = own.filter((a) => a.status === 'IN_PROGRESS' || searchedLately(a, now));
  return { fresh: fresh.length, total: own.length };
}
