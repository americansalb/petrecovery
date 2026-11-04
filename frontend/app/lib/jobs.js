/**
 * One job at a time. Someone who wants to help a pet says how (on foot,
 * by car, from home, with gear) and when (now for half an hour, now for an
 * hour or more, tonight, the next search party), and the search hands
 * them one job sized to that, with a brief. Every job is a real thing:
 * a block of the board nobody is walking (app/lib/searchBoard.js), an
 * open need of the force (app/lib/forceNeeds.js), or the next search
 * party (app/lib/petRoom.js). Nothing is invented to keep people busy.
 *
 * `rankJobs` is pure and tested; `pickJob` reads the rows.
 */

import { listNeeds } from '@/app/lib/forceNeeds';
import { nextParty } from '@/app/lib/petRoom';
import { openBlocks } from '@/app/lib/searchBoard';
import { distanceMeters } from '@/app/lib/searchGrid';
import { briefFor } from '@/app/lib/brief';

export { briefFor };

export const WAYS = {
  foot: { label: 'On foot', kinds: ['area', 'doors', 'flyers', 'other'] },
  car: { label: 'By car', kinds: ['flyers', 'area', 'other'] },
  home: { label: 'From home', kinds: ['shelter', 'other'] },
  gear: { label: 'With gear', kinds: ['other'] },
};

export const WHENS = {
  now30: { label: 'Now, 30 minutes', minutes: 30 },
  now60: { label: 'Now, an hour or more', minutes: 75 },
  tonight: { label: 'Tonight', minutes: 60 },
  party: { label: 'The next search party', minutes: 120 },
};

/** About how long one block takes on foot, and how many fit in the time given. */
const MINUTES_PER_BLOCK = 20;

function blocksThatFit(when) {
  const minutes = WHENS[when]?.minutes || 30;
  return Math.max(1, Math.min(3, Math.floor(minutes / MINUTES_PER_BLOCK)));
}

function metersAway(near, point) {
  if (!near || point?.lat == null || point?.lng == null) return null;
  return distanceMeters(near, point);
}

function walkText(meters) {
  if (meters == null) return '';
  if (meters < 150) return 'Right where you are';
  if (meters < 1000) return `${Math.round(meters / 50) * 50} m from you`;
  return `${(meters / 1609.344).toFixed(1)} mi from you`;
}

/**
 * Rank what could be done into jobs for this person. Pure.
 *
 * `blocks`: open blocks (label, priority, centerLatitude, centerLongitude).
 * `needs`: open needs as listNeeds gives them (kind, title, taken, peopleNeeded, mine, lat, lng).
 * `party`: the next search party or null. `near`: {lat, lng} of the person, if given.
 */
export function rankJobs({ blocks = [], needs = [], party = null, way = 'foot', when = 'now30', near = null, petName = 'the pet' }) {
  const kinds = WAYS[way]?.kinds || WAYS.foot.kinds;
  const jobs = [];

  // A search party is a job of its own when that is the time they gave.
  if (when === 'party' && party) {
    jobs.push({
      kind: 'party',
      id: party.id,
      title: `Join the search party for ${petName}`,
      minutes: WHENS.party.minutes,
      why: `${party.goingCount} going so far. Blocks are handed out when it meets.`,
      score: 1000,
    });
  }

  // Needs the force asked for, matched to the way they can help, nobody on them first.
  const openNeeds = needs.filter((n) => !n.mine && n.taken < n.peopleNeeded && kinds.includes(n.kind || 'other'));
  for (const n of openNeeds) {
    const rank = kinds.indexOf(n.kind || 'other');
    const away = metersAway(near, { lat: n.lat, lng: n.lng });
    const nobody = n.taken === 0;
    jobs.push({
      kind: 'need',
      id: n.id,
      title: n.title,
      minutes: n.kind === 'shelter' ? 10 : 30,
      why: [
        n.byOwner ? 'The owner asked for this.' : null,
        nobody ? 'Nobody is on it yet.' : `${n.taken} of ${n.peopleNeeded} people on it.`,
        away != null ? `${walkText(away)}.` : null,
      ].filter(Boolean).join(' '),
      score: 500 - rank * 60 + (nobody ? 40 : 0) + (n.byOwner ? 30 : 0) - (away != null ? Math.min(away, 3000) / 100 : 0),
    });
  }

  // Blocks of the board, for feet and cars. The priority already says "near a sighting".
  if (way === 'foot' || way === 'car') {
    const count = way === 'car' ? 1 : blocksThatFit(when);
    const sorted = blocks
      .map((b) => ({ ...b, away: metersAway(near, { lat: b.centerLatitude, lng: b.centerLongitude }) }))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.away ?? 1e9) - (b.away ?? 1e9));
    if (sorted.length) {
      const picked = sorted.slice(0, count);
      const hot = (picked[0].priority || 0) >= 8;
      const labels = picked.map((b) => b.label);
      const title = labels.length === 1 ? `Walk ${labels[0]}` : `Walk ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
      jobs.push({
        kind: 'block',
        id: picked[0].id,
        cellIds: picked.map((b) => b.id),
        labels,
        title: way === 'car' ? `Drive the edge of the area, then ${title.toLowerCase()}` : title,
        minutes: picked.length * MINUTES_PER_BLOCK,
        why: [
          hot ? 'Next to where the trail is warmest.' : 'Nobody has walked it.',
          picked[0].status === 'NEEDS_REVISIT' ? 'Walked once in poor light; worth another look.' : null,
          picked[0].away != null ? `${walkText(picked[0].away)}.` : null,
        ].filter(Boolean).join(' '),
        score: (way === 'foot' ? 400 : 200) + (picked[0].priority || 0) * 10 - (picked[0].away != null ? Math.min(picked[0].away, 3000) / 100 : 0),
      });
    }
  }

  jobs.sort((a, b) => b.score - a.score);
  return jobs;
}


/**
 * The one job for this person, and a few alternatives. `member` is whether
 * they are in the force looking for the pet (needs and the party are for
 * members; blocks are for anyone signed in).
 */
export async function pickJob({ pet, forceId, userId, member, way = 'foot', when = 'now30', near = null, now = new Date() }) {
  const [blocks, needs, party] = await Promise.all([
    way === 'foot' || way === 'car' ? openBlocks(pet.id) : [],
    forceId && member ? listNeeds(forceId, { userId, member, caseId: pet.id }) : [],
    forceId && member && when === 'party' ? nextParty(forceId, pet.id, { userId, member, now }) : null,
  ]);
  const jobs = rankJobs({ blocks, needs, party, way, when, near, petName: pet.petName || 'the pet' });
  const [job, ...rest] = jobs;
  return {
    job: job || null,
    alternatives: rest.slice(0, 3),
    brief: briefFor({ way, pet }),
    way: WAYS[way]?.label || WAYS.foot.label,
    when: WHENS[when]?.label || WHENS.now30.label,
  };
}
