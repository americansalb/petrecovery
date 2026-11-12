/**
 * The brief that goes with a job: four lines someone reads once before
 * they set off, species-aware, by the way they are helping (on foot, by
 * car, from home, with gear). Pure, so the pet's share link can show it
 * to a witness in the browser as well as the job API on the server.
 *
 * Where it says to look is where a stranger may look: from the sidewalk
 * or a path, and in a yard, shed or garage only after asking at the door.
 * Until 2026-11-12 it sent people "under decks, in open garages and sheds,
 * along creeks", which is other people's property and the water's edge
 * (founder: "Are we inadvertantly telling people to search in ponds ...
 * We need to be careful about that").
 *
 * The button it names is the one the site has: "I've seen Max", on the
 * pet's page, the search screen and a force's post. (It said "I saw Max"
 * until 2026-11-12, a button that was nowhere.)
 */

import { speciesLabel } from '@/app/lib/species';

const nameOf = (pet) => pet?.petName || `the ${speciesLabel(pet?.petSpecies).toLowerCase()}`;
const isDog = (pet) => String(pet?.petSpecies || '').toUpperCase() === 'DOG';

/**
 * What to do on seeing the pet, in one sentence: the first sentence of the
 * brief's last line, for the places that have room for one. Written here
 * rather than cut out of the line at its first full stop, because a pet's
 * name can hold one ("Mr. Whiskers"), and the cut then ended mid-name.
 */
export function onSeeing(pet) {
  return isDog(pet) ? `If you see ${nameOf(pet)}, don't chase or call out.` : `If you see ${nameOf(pet)}, don't chase.`;
}

export function briefFor({ way, pet }) {
  const name = nameOf(pet);
  const dog = isDog(pet);
  const cat = String(pet?.petSpecies || '').toUpperCase() === 'CAT';
  const look = cat
    ? 'Look low and close from the sidewalk: under parked cars, under porches and decks, behind bins. Ask at the door before you look in a yard, shed or garage. A scared cat hides within a few houses and goes quiet.'
    : 'Look low from the sidewalk or a path: under parked cars, under porches and decks, along fences and hedges. Ask at the door before you look in a yard, shed or garage. A scared pet hides and goes quiet.';
  const call = dog
    ? `Call "${name}" once a minute in a calm voice, then listen.`
    : cat
      ? `Say ${name}'s name softly now and then, and shake a treat bag. Listen more than you call.`
      : `Say ${name}'s name now and then, then listen.`;
  const never = dog
    ? `${onSeeing(pet)} Sit down, look away, tap "I've seen ${name}". The owner's voice is what ${name} comes to.`
    : `${onSeeing(pet)} Note where and which way, tap "I've seen ${name}", and keep your distance.`;
  if (way === 'home') {
    return [
      `Say you are calling about a lost ${speciesLabel(pet?.petSpecies).toLowerCase()} named ${name}${pet?.petColor ? `, ${String(pet.petColor).toLowerCase()}` : ''}${pet?.petBreed ? `, ${pet.petBreed}` : ''}.`,
      'Ask whether any animal matching came in since the date lost, and whether they can note the case number.',
      'Write down who you spoke to and when. Tap Done and it goes on the record for everyone.',
      `If they have a match, tap "I've seen ${name}" and the owner is told at once.`,
    ];
  }
  if (way === 'car') {
    return [
      'Drive slowly with the windows down, and pull over before you look at your phone. Pets move along edges: fence lines, hedges, the backs of lots.',
      call,
      never,
      'Your drive records as you go, so the team sees what you covered.',
    ];
  }
  if (way === 'gear') {
    return [
      'A gear job comes with its own instructions from the coordinator. Check with them before setting anything.',
      look,
      never,
      'Photos of what you set up go on the record so the next person can check it.',
    ];
  }
  return ['Walk every street in the block. Your path records as you go.', look, call, never];
}

/**
 * The brief as a page outside the search screen may say it, so that every
 * line is true there. Two cuts, and no word added:
 *
 *  - Nothing says a path or a drive "records as you go". That happens only
 *    in the app, and the search screen says it there, while it records.
 *  - A job that is one street, or one area of ground, is not told to
 *    "walk every street in the block": its own title names what it is,
 *    and ground is searched, not walked street by street.
 */
export function briefOnPage(brief = [], job = null) {
  return (brief || [])
    .map((line) => String(line || '').replace(/\s*[^.]*\brecords as you go\b[^.]*\./, '').trim())
    .filter((line) => line && !((job?.unit === 'street' || job?.unit === 'area') && /^Walk every street in the block\.?$/.test(line)));
}
