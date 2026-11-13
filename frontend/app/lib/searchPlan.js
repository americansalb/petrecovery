/**
 * The plan follows the animal.
 *
 * Founder, 2026-11-13: "A real search and rescue team would find this
 * superficial and comical ... You are not trying hard enough to put
 * yourselves in the shoes of the complex S&R team". A team does not run
 * the same search for every subject. What it does first depends on who is
 * lost. For a pet that is the species and how it is with people, which the
 * report already asks (app/lib/caseDetails.js), and the desk used none of
 * it: every pet got the same circle and the same people on foot.
 *
 * This says, for one pet, which tasks other than searching ground come
 * first, and in one sentence why. Pure, so the desk and its tests read the
 * same thing. The wording is the site's own and is quoted as written.
 *
 * Where the tactics come from (published lost-pet guidance, read
 * 2026-11-13):
 *  - Strangers do not call or chase a frightened dog, and a crowd of
 *    unfamiliar searchers can drive one further off: Maddie's Fund, "What
 *    you don't know about lost pets can hurt them"; Kinship, "How to find
 *    a lost dog".
 *  - A feeding station near a confirmed sighting, with something that
 *    smells of home, re-baited once a day; a camera to see what eats the
 *    food; a trap only once the dog comes to the station more than once,
 *    borrowed from a shelter or animal control and checked often: Pet FBI,
 *    "Advice on trapping a runaway dog".
 *  - Reports to shelters, vets, animal control and the microchip company;
 *    flyers that say not to chase; posts in local online groups: Humane
 *    World, "How to find a lost dog".
 *
 * It names tactics. It does not say any of them will work.
 *
 * A task comes with what the site has already made for it. Founder,
 * 2026-11-13, on a Tasks tab that offered "Door to door" with nothing but
 * a box that said "Where it is": "Door to door people need to give the
 * flyer, no? Why are we acting as though all these assets cannot assist
 * in the mission control". When a pet is reported the site makes its
 * flyers, its share pictures, the words of a post, and finds the nearest
 * shelters and local groups (the recovery kit, read by
 * app/lib/searchKit.js). `gearFor` says which of those each task uses, so
 * the half sheets are on the door-to-door task and the phone numbers are
 * on the calls. Flyers, door to door and posts are shown to the people
 * helping too, with the same files, once whoever runs the search sets
 * them up.
 */

export const TASK_KINDS = ['FLYERS', 'POSTS', 'CALLS', 'DOORS', 'SCENT', 'STATION', 'CAMERA', 'TRAP', 'OTHER'];

/**
 * What each task is called, in one sentence what it is, and what its place is called: where flyers went up is
 * not "where it is", and a round of calls has no place at all. `{name}` is the pet's.
 */
const TASKS = {
  FLYERS: { title: 'Flyers', what: 'Large flyers at the corners around where {name} was lost and wherever {name} is seen, saying not to chase.', where: 'Which corners or streets' },
  POSTS: { title: 'Posts online', what: "{name}'s picture and link posted in the local lost-pet groups and on Nextdoor.", where: 'Which groups' },
  CALLS: { title: 'Shelters and vets', what: 'Calls to the shelters, vets and animal control nearby, and to the microchip company.', where: '' },
  DOORS: { title: 'Door to door', what: 'The nearest neighbors handed a flyer and asked to check their own yards, sheds and garages, and whether a camera of theirs caught anything.', where: 'Which streets' },
  SCENT: { title: 'Scent of home', what: 'Something that smells of home, such as worn clothing or bedding, left where {name} was lost.', where: 'Where it was left' },
  STATION: { title: 'Feeding station', what: 'Food and water left in one quiet spot near a sighting, put out again once a day at the same time.', where: 'Where it is' },
  CAMERA: { title: 'Camera on the station', what: 'A trail camera pointed at the food, to see what is eating it.', where: 'Where it is' },
  TRAP: { title: 'Humane trap', what: 'A humane trap at the station once {name} has come to it more than once. Shelters and animal control lend them. It is checked often.', where: 'Where it is' },
  OTHER: { title: 'Something else', what: 'A task of your own.', where: 'Where, if it has a place' },
};

/**
 * The tasks the people helping are shown once they are set up, with where: anyone can put up a flyer, hand one
 * to a neighbor or share a post from public ground. Never a station, a camera or a trap.
 */
export const SHARED_KINDS = ['FLYERS', 'POSTS', 'DOORS'];

/** A station, a camera and a trap are looked at again and again; the others are done once. */
export const KEPT_KINDS = ['STATION', 'CAMERA', 'TRAP'];
/** How long a kept task goes before the desk says it is due a look, in hours. */
export const CHECK_EVERY_HOURS = { STATION: 24, CAMERA: 24, TRAP: 4 };

const fill = (text, name) => String(text).replace(/\{name\}/g, name);

/** A task kind as the screen names it: { kind, title, what }. */
export function taskOf(kind, name = 'the pet') {
  const known = TASKS[kind] || TASKS.OTHER;
  const is = TASKS[kind] ? kind : 'OTHER';
  return { kind: is, title: known.title, what: fill(known.what, name), where: known.where, shared: SHARED_KINDS.includes(is) };
}

/** What the site made for the pet that each task uses, in the order shown, and what each is called. */
const GEAR = {
  FLYERS: [
    ['print', 'FLYER_POSTER', 'Print the poster, 11 by 17'],
    ['print', 'FLYER_LETTER', 'Print the flyer with tear-off tabs'],
  ],
  DOORS: [['print', 'FLYER_HALF', 'Print half sheets to hand out, two to a page']],
  POSTS: [
    ['picture', 'SOCIAL_SQUARE', 'Square picture for a post'],
    ['picture', 'SOCIAL_STORY', 'Tall picture for a story'],
    ['words'],
    ['groups'],
  ],
  CALLS: [['shelters'], ['directory']],
};

/**
 * What a task comes with, from the pet's kit (app/lib/searchKit.js): [{ type, label, href, text, detail }].
 * `print` and `picture` are files the site made, `copy` is words to paste, `call` is a phone number, `link`
 * is a page. A kit with nothing for a task gives an empty list, and the task is still a task.
 */
export function gearFor(kind, kit) {
  const out = [];
  for (const [type, key, label] of GEAR[kind] || []) {
    if ((type === 'print' || type === 'picture') && kit?.files?.[key]) out.push({ type, label, href: kit.files[key] });
    if (type === 'words' && kit?.caption) out.push({ type: 'copy', label: 'Copy the words for the post', text: kit.caption });
    if (type === 'groups') for (const group of kit?.groups || []) out.push({ type: 'link', label: group.name, href: group.url });
    if (type === 'shelters') {
      for (const shelter of kit?.shelters || []) {
        if (!shelter.phone) continue;
        out.push({ type: 'call', label: `Call ${shelter.name}`, href: `tel:${shelter.phone}`, detail: Number.isFinite(shelter.miles) ? `${shelter.miles} mi` : '' });
      }
    }
    if (type === 'directory') out.push({ type: 'link', label: 'Find shelters in the directory', href: '/shelters' });
  }
  return out;
}

const upper = (text) => String(text || '').toUpperCase();

/**
 * The plan for one pet: { animal, about, footNote, order }. `about` is the
 * one sentence that says what kind of search this is, `footNote` what that
 * means for people searching on foot, and `order` the task kinds with the
 * ones to do first at the top.
 */
export function planFor({ species, temperament, name = 'the pet' } = {}) {
  const kind = upper(species);
  const how = upper(temperament);
  if (kind === 'DOG') {
    if (how === 'FRIENDLY') {
      return {
        animal: 'DOG_FRIENDLY',
        about: `A friendly dog is often taken in by someone nearby. Flyers, posts in local groups, door to door and calls to shelters are how those people are found.`,
        footNote: `People searching on foot can say ${name}'s name in a calm voice.`,
        order: ['FLYERS', 'POSTS', 'DOORS', 'CALLS', 'SCENT', 'STATION', 'CAMERA', 'TRAP', 'OTHER'],
      };
    }
    const like = how === 'SCARED' ? 'scared' : how === 'SHY' ? 'shy' : how === 'DEFENSIVE' ? 'likely to snap' : null;
    return {
      animal: 'DOG_WARY',
      about: like
        ? `${name} is ${like}. A dog like that runs from strangers, so sightings, a feeding station and a trap do more than people on foot.`
        : `Nobody has said how ${name} is with strangers, so the search treats ${name} as a dog that may run from them. Sightings, a feeding station and a trap do more than people on foot.`,
      footNote: `Keep the people out looking few. They do not call ${name} or walk toward ${name}.`,
      order: ['FLYERS', 'POSTS', 'CALLS', 'STATION', 'CAMERA', 'TRAP', 'SCENT', 'DOORS', 'OTHER'],
    };
  }
  if (kind === 'CAT') {
    return {
      animal: 'CAT',
      about: `A cat that got out usually hides close by and stays silent. The nearest yards, sheds and garages come before anything further off.`,
      footNote: `People searching on foot look low and close, and ask at the door before a yard, shed or garage.`,
      order: ['DOORS', 'SCENT', 'STATION', 'CAMERA', 'TRAP', 'FLYERS', 'POSTS', 'CALLS', 'OTHER'],
    };
  }
  return {
    animal: 'OTHER',
    about: `Flyers, posts in local groups, the nearest neighbors and calls to shelters and vets are how most lost pets are found.`,
    footNote: `People searching on foot do not chase ${name}.`,
    order: ['FLYERS', 'POSTS', 'DOORS', 'CALLS', 'SCENT', 'OTHER'],
  };
}

/**
 * Whether a kept task is due a look: never looked at since it was set up,
 * or longer ago than its kind goes. `task`: { kind, status, createdAt,
 * checkedAt }.
 */
export function dueCheck(task, now = Date.now()) {
  if (!task || task.status !== 'OPEN' || !KEPT_KINDS.includes(task.kind)) return false;
  const last = new Date(task.checkedAt || task.createdAt).getTime();
  return now - last >= (CHECK_EVERY_HOURS[task.kind] || 24) * 60 * 60 * 1000;
}
