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
    ratePerHour: { min: 0.012, max: 0.018 },  // 55-83 hours to reach 1.0
    foragingRelief: { min: 0.3, max: 0.5 },
    criticalThreshold: { min: 0.85, max: 0.95 },
  },
  thirst: {
    ratePerHour: { min: 0.02, max: 0.03 },    // 33-50 hours to reach 1.0
    waterRelief: { min: 0.5, max: 0.7 },
    criticalThreshold: { min: 0.8, max: 0.9 },
  },
  stamina: {
    drainFleeing: { min: 0.25, max: 0.35 },
    drainTraveling: { min: 0.08, max: 0.12 },
    recoveryResting: { min: 0.12, max: 0.18 },
  },
};

// Survival parameters with ranges [A] - Based on realistic pet survival
// Key insight: Most lost pets survive and are found. Death is RARE.
// A healthy adult medium-sized pet should have <5% mortality over 30 days
export const SURVIVAL = {
  // Dehydration - pets usually find water sources (puddles, streams, birdbaths)
  // True dehydration death is rare except in extreme conditions
  dehydration: {
    criticalAfterHours: { min: 96, max: 144 },    // 4-6 days without ANY water (rare)
    fatalAfterHours: { min: 144, max: 240 },      // 6-10 days - most pets find water before this
    deathRatePerHour: { min: 0.0005, max: 0.002 }, // Very low - 0.05-0.2% per hour when critical
    findWaterProbPerHour: 0.15,                    // 15% chance per hour of finding water
  },
  // Starvation - pets can survive 2-3+ weeks without food easily
  starvation: {
    criticalAfterHours: { min: 336, max: 504 },   // 2-3 weeks
    fatalAfterHours: { min: 504, max: 720 },      // 3-4 weeks
    deathRatePerHour: { min: 0.0002, max: 0.001 }, // Very slow
  },
  // Environmental hazards - these are RARE events
  // Rates are per-hour probability, should result in ~1-3% total over 30 days
  hazards: {
    vehicleStrike: {
      nearRoad: { min: 0.000005, max: 0.00003 },  // ~0.5-2% over 30 days
      fleeing: { min: 0.00001, max: 0.00005 },    // Slightly higher when panicked
    },
    predator: {
      nighttime: { min: 0.000002, max: 0.00001 }, // Very rare - most areas safe
      smallPet: { min: 0.000005, max: 0.00002 },  // Small pets slightly more at risk
    },
    exposure: {
      extreme: { min: 0.000001, max: 0.000005 },  // Only in extreme weather
    },
    accident: {
      general: { min: 0.000001, max: 0.000005 }, // Very rare
    },
  },
  // Modifiers based on pet characteristics
  modifiers: {
    size: {
      TOY: { survival: 0.7, dehydration: 1.4 },   // Toy breeds dehydrate faster
      SML: { survival: 0.85, dehydration: 1.2 },
      MED: { survival: 1.0, dehydration: 1.0 },
      LRG: { survival: 1.1, dehydration: 0.9 },
      GNT: { survival: 1.0, dehydration: 0.85 },  // Need more food but retain water better
    },
    age: {
      PUP: { survival: 0.7, resilience: 0.6 },    // Very vulnerable
      KIT: { survival: 0.7, resilience: 0.6 },
      JUV: { survival: 0.85, resilience: 0.8 },
      YNG: { survival: 1.0, resilience: 1.0 },
      ADT: { survival: 1.0, resilience: 1.0 },
      SEN: { survival: 0.75, resilience: 0.7 },   // Seniors vulnerable
    },
    species: {
      dog: { outdoorSurvival: 1.0, predatorRisk: 0.7 },  // Dogs fend off predators better
      cat: { outdoorSurvival: 0.9, predatorRisk: 1.0 },
    },
    indoorOnly: {
      survivalPenalty: 0.8,  // 20% less likely to survive outdoors
      foragingPenalty: 0.6,  // Worse at finding food/water
    },
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
