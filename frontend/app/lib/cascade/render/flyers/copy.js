/**
 * Emotional flyer copy — first-person pet voice + the family's quiet heartbreak.
 *
 * Crafted and critiqued for authenticity (heartfelt, dignified, never cheesy or
 * manipulative). This is the deterministic fallback that runs with NO AI; PR4's
 * Haiku copy uses this same voice as its north star and can override the
 * headline/plea per case. Placeholders {name} / {species} are interpolated by
 * fillCopy(). Keep every line short and scannable — this is a flyer.
 */

export const FLYER_COPY = {
  headline: "{name} hasn't come home.",
  headlineAlt: 'My name is {name}.',
  // The emotional heart, spoken by the pet to whoever is reading.
  pleaDefault:
    "My name is {name}, and I'm lost and scared out here. You could be the reason I'm home tonight — it only takes one person looking twice.",
  // A short species-specific touch appended after the plea.
  pleaBySpecies: {
    DOG: "I've never spent a night away from my people.",
    CAT: "I'm small and quiet, so I'm probably hiding close by — please check sheds, garages, and under porches.",
    BIRD: "I may be up high, listening for a voice I know — and I can't last long out here on my own.",
    RABBIT: "When I'm frightened I go still, tucked low under a bush or a deck where I'm easy to miss.",
    OTHER: "I'm little and frightened out here, and I'm probably hiding somewhere close to home.",
  },
  familyLine: "{name}'s family is waiting at home right now, with the light on.",
  // Scenario-aware "how to help" — gentle guidance, not an alarm.
  approachByScenario: {
    got_spooked: "I'm frightened and hiding, so please don't chase me — just call my family and stay nearby.",
    spooked: "I'm frightened and hiding, so please don't chase me — just call my family and stay nearby.",
    door_dashed: "I'm friendly and I bolted out an open door — kneel down, say my name softly, and let me come to you.",
    door_left_open: "I'm friendly and I slipped out an open door — kneel down, say my name softly, and let me come to you.",
    jumped_fence: "I found a way out and can't find my way back — please call my family the moment you spot me.",
    off_leash: "I slipped away and I'm friendly — kneel down, say my name softly, and let me come to you.",
    unknown: "However I ended up out here, I only want to go home — please call my family if you see me.",
  },
  shareNudge: 'One share could reach the person who finds {name}.',
  scanCta: 'Scan to see more of {name} or report a sighting.',
};

export function fillCopy(str, { name, species } = {}) {
  return String(str || '')
    .replaceAll('{name}', name || 'this pet')
    .replaceAll('{species}', (species || 'pet').toLowerCase());
}

/** Resolve the full emotional copy for a case, honoring AI overrides. */
export function resolveFlyerCopy(caseData, shared = {}) {
  const name = caseData.petName || 'this pet';
  const species = caseData.petSpecies || 'OTHER';
  const scenario = caseData.escapeScenario || 'unknown';

  const pleaExtra = FLYER_COPY.pleaBySpecies[species] || FLYER_COPY.pleaBySpecies.OTHER;
  const plea = shared.plea
    ? shared.plea
    : `${fillCopy(FLYER_COPY.pleaDefault, { name, species })} ${pleaExtra}`;

  return {
    headline: shared.headline ? shared.headline : fillCopy(FLYER_COPY.headline, { name }),
    plea,
    // Shorter plea (no species tail) for space-constrained surfaces like the
    // landscape OG / square social cards.
    pleaShort: shared.plea ? shared.plea : fillCopy(FLYER_COPY.pleaDefault, { name, species }),
    familyLine: fillCopy(FLYER_COPY.familyLine, { name }),
    approachLine:
      shared.approachLine || FLYER_COPY.approachByScenario[scenario] || FLYER_COPY.approachByScenario.unknown,
    shareNudge: fillCopy(FLYER_COPY.shareNudge, { name }),
    scanCta: fillCopy(FLYER_COPY.scanCta, { name }),
  };
}
