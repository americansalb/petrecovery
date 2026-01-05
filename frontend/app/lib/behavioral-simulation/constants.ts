/**
 * Research-backed constants from BEHAVIORAL_PROFILES.md
 * Provenance: [R] Research, [P] Practitioner, [A] Assumption, [C] Calculated
 */

// Dog temperament parameters
export const DOG_TEMPERAMENTS = {
  G: { // Gregarious
    name: 'Gregarious',
    description: 'Approaches strangers readily, high social drive',
    flightDistanceM: { min: 10, max: 50 },
    approachStrangerProb: 0.85,
    approachOwnerProb: 0.95,
    fearDecayRate: 0.15, // Fast recovery [P]
    trapSusceptibility: 0.8,
    recallResponse: 0.9,
  },
  C: { // Confident
    name: 'Confident',
    description: 'Curious but cautious, may investigate then retreat',
    flightDistanceM: { min: 30, max: 100 },
    approachStrangerProb: 0.5,
    approachOwnerProb: 0.85,
    fearDecayRate: 0.12,
    trapSusceptibility: 0.6,
    recallResponse: 0.75,
  },
  A: { // Aloof
    name: 'Aloof',
    description: 'Avoids contact but does not flee in panic',
    flightDistanceM: { min: 50, max: 200 },
    approachStrangerProb: 0.2,
    approachOwnerProb: 0.7,
    fearDecayRate: 0.08,
    trapSusceptibility: 0.4,
    recallResponse: 0.5,
  },
  X: { // Xenophobic
    name: 'Xenophobic',
    description: 'Flees from all humans including owner when stressed',
    flightDistanceM: { min: 100, max: 500 },
    approachStrangerProb: 0.02,
    approachOwnerProb: 0.3,
    fearDecayRate: 0.03, // Slow recovery [P]
    trapSusceptibility: 0.2,
    recallResponse: 0.2,
  },
  B: { // Bonded
    name: 'Bonded',
    description: 'Only trusts owner/household, fearful of all others',
    flightDistanceM: { min: 80, max: 300 },
    approachStrangerProb: 0.05,
    approachOwnerProb: 0.8,
    fearDecayRate: 0.05,
    trapSusceptibility: 0.3,
    recallResponse: 0.7,
  },
};

// Cat temperament parameters
export const CAT_TEMPERAMENTS = {
  CUR: { // Curious
    name: 'Curious',
    description: 'Investigates environment, may approach strangers',
    flightDistanceM: { min: 5, max: 30 },
    approachStrangerProb: 0.4,
    thresholdDays: { min: 3, max: 7 }, // Shorter threshold [P]
    emergenceProb: 0.4,
    trapSusceptibility: 0.7,
  },
  CL: { // Careless (Care-less)
    name: 'Careless',
    description: 'Indoor/outdoor cat, street-smart, less fearful',
    flightDistanceM: { min: 10, max: 50 },
    approachStrangerProb: 0.3,
    thresholdDays: { min: 2, max: 5 },
    emergenceProb: 0.5,
    trapSusceptibility: 0.6,
  },
  CAU: { // Cautious
    name: 'Cautious',
    description: 'Hides initially but may emerge after threshold',
    flightDistanceM: { min: 20, max: 100 },
    approachStrangerProb: 0.1,
    thresholdDays: { min: 7, max: 12 }, // Standard threshold [R]
    emergenceProb: 0.3,
    trapSusceptibility: 0.4,
  },
  X: { // Xenophobic
    name: 'Xenophobic',
    description: 'Flees from all, deep hiding, may never emerge',
    flightDistanceM: { min: 50, max: 300 },
    approachStrangerProb: 0.01,
    thresholdDays: { min: 14, max: 30 },
    emergenceProb: 0.1,
    trapSusceptibility: 0.15,
  },
  B: { // Bonded
    name: 'Bonded',
    description: 'Only trusts owner, fearful of all others',
    flightDistanceM: { min: 30, max: 150 },
    approachStrangerProb: 0.02,
    thresholdDays: { min: 10, max: 18 },
    emergenceProb: 0.2,
    trapSusceptibility: 0.25,
  },
};

// Displacement distributions [R] - Huang 2018 (cats), Kremer 2021 (dogs)
export const DISPLACEMENT = {
  cat: {
    indoorOnly: { medianM: 39, q75M: 137 },      // [R] Huang 2018
    indoorOutdoor: { medianM: 300, q75M: 1609 }, // [R] Huang 2018
  },
  dog: {
    general: { medianM: 460, q75M: 1200 },       // [C] Derived from Kremer 2021
    within122mPct: 0.42,                          // [R] 42% within 400ft
    within1609mPct: 0.70,                         // [R] 70% within 1 mile
  },
};

// Movement speeds in meters per hour
export const MOVEMENT_SPEEDS = {
  dog: {
    fleeing: 8000,    // ~5 mph sprint
    traveling: 4000,  // ~2.5 mph walk
    foraging: 1500,
    resting: 0,
  },
  cat: {
    fleeing: 6000,    // ~3.7 mph
    traveling: 2000,  // ~1.2 mph
    foraging: 800,
    resting: 0,
  },
};

// Physiological parameters
export const PHYSIOLOGY = {
  hunger: {
    ratePerHour: 0.015,    // ~66 hours to reach 1.0
    foragingRelief: 0.4,
    criticalThreshold: 0.9,
  },
  thirst: {
    ratePerHour: 0.025,    // ~40 hours to reach 1.0
    waterRelief: 0.6,
    criticalThreshold: 0.85,
  },
  stamina: {
    drainFleeing: 0.3,
    drainTraveling: 0.1,
    recoveryResting: 0.15,
  },
};

// Time of day activity multipliers
export const TIME_OF_DAY = {
  dog: {
    dawn: 1.2,      // 5-8
    morning: 1.0,   // 8-12
    afternoon: 0.9, // 12-17
    dusk: 1.3,      // 17-20
    night: 0.5,     // 20-5
  },
  cat: {
    dawn: 1.5,      // Crepuscular
    morning: 0.6,
    afternoon: 0.4,
    dusk: 1.5,
    night: 0.8,
  },
};

// Baseline outcomes from research [R] - Weiss 2012
export const BASELINE_OUTCOMES = {
  dog: {
    overallRecoveryRate: 0.93,
    selfReturnRate: 0.15,
    shelterRecoveryRate: 0.15,
    strangerReturnRate: 0.40,
  },
  cat: {
    overallRecoveryRate: 0.75,
    selfReturnRate: 0.59,
    shelterRecoveryRate: 0.05,
    strangerReturnRate: 0.08,
  },
};

// Searcher parameters
export const SEARCHER_PARAMS = {
  OWNER: {
    detectionRangeM: 50,
    recallBonus: 0.4,
    captureSkill: 0.7,
    hoursPerDay: 8,
  },
  HOUSEHOLD: {
    detectionRangeM: 40,
    recallBonus: 0.3,
    captureSkill: 0.6,
    hoursPerDay: 6,
  },
  VOLUNTEER: {
    detectionRangeM: 30,
    recallBonus: 0.0,
    captureSkill: 0.3,
    hoursPerDay: 3,
  },
  PROFESSIONAL: {
    detectionRangeM: 60,
    recallBonus: 0.1,
    captureSkill: 0.9,
    hoursPerDay: 10,
  },
};
