/**
 * The safety rules someone agrees to before they go out looking for a pet.
 *
 * One list, read in two places: joining the neighborhood patrol
 * (app/patrol/join) and joining one pet's search from its share link
 * (app/mission-control). The words are the same in both because they are
 * the same promise; the liability waiver that goes with them is the
 * legal document "liability-waiver" (GET /api/legal/documents/...).
 */
export const SAFETY_RULES = [
  'Do not approach animals that may attack humans or harbor disease.',
  'Contact animal control or owners when appropriate. Never take direct action with aggressive animals.',
  'Never enter private property without permission.',
  'Stay out of the road. Cross at a crossing, and never follow an animal into traffic.',
  'Stay out of water and drains, off rail lines, and outside anything fenced or signed.',
  'Look at your phone only when you are standing still. Pull over first if you are driving.',
  'Report sightings only. You are not expected to capture or chase animals.',
  'Your safety comes first. If you feel unsafe, do not engage.',
];

/**
 * The sentence beside the tick. It says the person is an adult because a
 * waiver agreed to by a child does not hold, and the waiver itself says a
 * child comes only with their own parent or guardian.
 */
export const SAFETY_AGREEMENT = 'I am 18 or older. I have read the safety rules and the waiver, and I agree to both.';

/**
 * What the waiver does, in plain view above the tick, not only inside the
 * text behind "Read them": a release that the person agreeing could not
 * have missed is the one that holds up (founder, 2026-11-12: "We need to
 * find a stronger way to remove any liability").
 */
export const WAIVER_IN_SHORT = [
  'You search at your own risk.',
  'ReunitePets does not check any ground, and nobody is watching where you are.',
  "You give up the right to sue ReunitePets, the pet's owner and the other people helping if you are hurt.",
];

/**
 * "Before you go out": the short training someone reads after they agree
 * and before their first area. It is a step everyone passes through, and
 * the screen never calls it optional (founder, 2026-11-12: "a bit of
 * optional training on rescue ... but not say its optional"). Nothing on
 * the server refuses a search without it; finishing it is recorded on the
 * person's waiver record (POST /api/mission/[id]/trained).
 *
 * Each point is a few words and one or two sentences. `name` is the pet's.
 */
export function searchTraining(name = 'the pet') {
  return [
    { title: 'Search from public ground', text: 'Sidewalks, paths and parks. Ask at the door before you look in a yard, shed or garage.' },
    { title: 'Stay out of roads, water and rail lines', text: `Never follow ${name} into traffic. Your card names a main road, rail line or water that the map shows in your area. The map can leave things out.` },
    { title: 'Phone away while you move', text: 'Stop walking, then look at the screen. Pull over first if you are driving.' },
    { title: 'Do not chase or grab', text: `A scared pet runs from strangers, often into the road. Stop, crouch, look away, and tap "I've seen ${name}". The owner is told at once.` },
    { title: 'Keep away from an animal that growls, snaps or looks sick', text: 'Send the sighting and stay back.' },
    { title: 'After dark, go with someone and carry a light', text: 'Leave any place that feels wrong. You can swap your area or stop at any time.' },
    { title: 'In an emergency, call your local emergency number', text: 'ReunitePets is not an emergency service.' },
  ];
}
