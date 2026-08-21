/**
 * The one place PetSpecies becomes a word a person reads.
 *
 * Four pages kept private copies of the same map, and the pages that did
 * not have one printed the enum raw: /join/[missionId] read
 * "Golden DOG - Golden Retriever" on the screen a stranger opens from a
 * text message about a missing animal.
 *
 * Keep in step with `enum PetSpecies` in prisma/schema.prisma.
 */

const LABELS = {
  DOG: 'Dog',
  CAT: 'Cat',
  BIRD: 'Bird',
  RABBIT: 'Rabbit',
  OTHER: 'Pet',
};

export const PET_SPECIES = Object.keys(LABELS);

export function speciesLabel(species) {
  if (!species) return 'Pet';
  return LABELS[String(species).toUpperCase()] || 'Pet';
}

/**
 * How to describe an animal in one line.
 *
 * The breed is the more useful word to someone scanning for a pet, so it
 * leads when it is known and the species label stands in when it is not.
 * The colour is dropped when the breed already contains it: a golden
 * retriever whose colour is recorded as "Golden" should not read "Golden
 * Golden Retriever", which is what plain concatenation gives on real
 * seeded data.
 */
export function describePet({ species, breed, color } = {}) {
  const noun = breed || speciesLabel(species);
  if (!color) return noun;

  const alreadySaid = noun.toLowerCase().includes(String(color).toLowerCase().trim());
  return alreadySaid ? noun : `${color} ${noun}`;
}

/** The map itself, for call sites that index it directly. */
export const SPECIES_LABELS = LABELS;
