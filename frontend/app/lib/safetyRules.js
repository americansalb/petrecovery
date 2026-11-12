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

/** The sentence beside the tick. */
export const SAFETY_AGREEMENT = 'I have read the safety rules and the waiver, and I agree to both.';
