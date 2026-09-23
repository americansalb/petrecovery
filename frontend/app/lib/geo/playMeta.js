/**
 * What a play link says when it is pasted into a chat.
 *
 * After the share page, the game's most shared addresses are play links:
 * probablyearth.com/daily, a mode's own link, and "Challenge a friend",
 * which is the same places with a seed. Each previewed as plain
 * "Probably Earth" with the site's description. They say which game
 * they are now, in the words the front page uses for it (GameMenu.js).
 */

import { buildShareMetadata } from './meta';
import { MODES } from './modes';

function copyFor(mode, seeded) {
  switch (mode) {
    case 'daily':
      return { title: "Today's daily", description: `${MODES.daily.fixed.rounds} places, no timer, the same places for everyone today.` };
    case 'ranked':
      return { title: 'Ranked', description: `${MODES.ranked.fixed.rounds} rounds, ${MODES.ranked.fixed.time} seconds each, no moving. Placement games first, then a rating.` };
    case 'cup':
      return { title: 'Weekly cup', description: `${MODES.cup.fixed.rounds} places, one entry a week.` };
    case 'streak':
      return { title: 'Country streak', description: 'Name the country from the street. One wrong answer ends the run.' };
    default:
      return seeded
        ? { title: 'Same places, your turn', description: 'A game of Probably Earth someone played. Look around each street and pin where it is, then compare scores.' }
        : { title: 'Play Street', description: 'Look around a street somewhere on Earth and pin where you think it is.' };
  }
}

export function playLinkMetadata(params = {}) {
  const get = (key) => (typeof params?.get === 'function' ? params.get(key) : params?.[key]);
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  const copy = copyFor(String(first(get('mode')) || ''), Boolean(first(get('seed'))));
  return buildShareMetadata({
    title: `${copy.title} | Probably Earth`,
    ogTitle: copy.title,
    description: copy.description,
    index: false,
  });
}
