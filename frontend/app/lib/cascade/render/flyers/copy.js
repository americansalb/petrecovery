/**
 * Flyer copy — direct, dignified, warm. Community voice: the flyer states what
 * happened and exactly how to help, like a calm neighbor asking neighbors.
 * No talking-pet gimmick, no guilt-trips, no cutesy trinkets — the pet's face
 * and a huge phone number do the emotional work; the words stay factual.
 *
 * This is the deterministic fallback that runs with NO AI; the cascade's Haiku
 * copy uses this same voice as its north star and can override headline/plea
 * per case. Placeholders {name} / {species} are interpolated by fillCopy().
 * Keep every line short and scannable — this is a flyer.
 */

export const FLYER_COPY = {
  headline: "{name} hasn't come home.",
  // ONE supporting sentence: species-true facts that make a stranger actually
  // useful, not a plea. Also the body line on social cards. No em dashes.
  pleaBySpecies: {
    DOG: 'Most lost dogs stay within a mile of home. A quick look around your yard, alley, or street could be the sighting that brings {name} back.',
    CAT: 'Lost cats rarely go far. {name} is probably hiding within a few houses of home, so please check sheds, garages, and under porches and decks.',
    BIRD: 'Lost birds stay close and perch high at first. Look up and listen at dawn and dusk. {name} may answer a calm, familiar voice.',
    RABBIT: 'Lost rabbits tuck in low and close. Check under bushes, decks, and porches around dawn and dusk, when {name} is most likely to move.',
    OTHER: 'Most lost pets stay close to home. A slow look around yards, garages, and quiet corners could be what brings {name} back.',
  },
  // Scenario-aware "IF YOU SEE {NAME}" guidance. Third person, practical.
  approachByScenario: {
    got_spooked: "{name} is probably frightened and hiding. Please don't chase or call out. Note the exact spot and get in touch right away.",
    spooked: "{name} is probably frightened and hiding. Please don't chase or call out. Note the exact spot and get in touch right away.",
    door_dashed: '{name} is friendly. Crouch down, speak softly, and let {name} come to you. Then get in touch.',
    door_left_open: '{name} is friendly. Crouch down, speak softly, and let {name} come to you. Then get in touch.',
    off_leash: '{name} is friendly. Crouch down, speak softly, and let {name} come to you. Then get in touch.',
    jumped_fence: "{name} may be roaming and trying to get home. Please don't chase. Note the spot and get in touch right away.",
    unknown: "Please don't chase. A scared pet runs farther. Note the exact spot and time, then get in touch right away.",
  },
  shareNudge: 'One share could reach the person who finds {name}.',
  scanCta: 'Scan to report a sighting',
};

export function fillCopy(str, { name, species } = {}) {
  return String(str || '')
    .replaceAll('{name}', name || 'this pet')
    .replaceAll('{species}', (species || 'pet').toLowerCase());
}

/** Resolve the full flyer copy for a case, honoring AI overrides. */
export function resolveFlyerCopy(caseData, shared = {}) {
  const name = caseData.petName || 'this pet';
  const species = caseData.petSpecies || 'OTHER';
  const scenario = caseData.escapeScenario || 'unknown';

  const plea = shared.plea
    ? shared.plea
    : fillCopy(FLYER_COPY.pleaBySpecies[species] || FLYER_COPY.pleaBySpecies.OTHER, { name, species });

  return {
    headline: shared.headline ? shared.headline : fillCopy(FLYER_COPY.headline, { name }),
    plea,
    // Same single sentence everywhere — kept as its own field so social cards
    // can stay short if the AI plea runs long.
    pleaShort: plea,
    approachLine: fillCopy(
      shared.approachLine || FLYER_COPY.approachByScenario[scenario] || FLYER_COPY.approachByScenario.unknown,
      { name, species }
    ),
    shareNudge: fillCopy(FLYER_COPY.shareNudge, { name }),
    scanCta: fillCopy(FLYER_COPY.scanCta, { name }),
  };
}
