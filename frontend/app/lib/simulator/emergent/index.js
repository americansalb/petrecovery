/**
 * Emergent Monte Carlo Simulation - Public API
 *
 * This module exports the emergent simulation system for use in the frontend.
 */

// Configuration
export {
  SPECIES,
  SIZE,
  AGE_CATEGORY,
  TEMPERAMENT,
  ESCAPE_TYPE,
  BEHAVIOR_STATE,
  TERRAIN_TYPE,
  SPECIES_DEFAULTS,
  TEMPERAMENT_MODIFIERS,
  ESCAPE_INITIAL_FEAR,
  SIZE_MODIFIERS,
  AGE_MODIFIERS,
  BEHAVIORAL_PARAMS,
  QUESTION_MAPPINGS,
  buildPetConfig,
  buildSearcherConfig,
  buildEnvironmentConfig,
} from './config.js';

// Pet Agent
export { PetAgent } from './petAgent.js';

// Outcomes
export {
  OUTCOME_CATEGORY,
  OUTCOME,
  OutcomeTracker,
  VALIDATION_BENCHMARKS,
  validateAgainstBenchmarks,
} from './outcomes.js';

// Engine
export {
  EmergentSimulationEngine,
  runEmergentBatch,
} from './engine.js';

// Validation
export {
  validateDisplacement,
  validateRecoveryRates,
  runAllValidations,
} from './validation.js';
