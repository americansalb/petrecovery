#!/usr/bin/env node
/**
 * Validation Runner for Emergent Simulation
 *
 * Usage:
 *   node scripts/validate-emergent.mjs [batch-size]
 *
 * Examples:
 *   node scripts/validate-emergent.mjs        # Run with default 100 simulations
 *   node scripts/validate-emergent.mjs 500    # Run with 500 simulations
 */

import { runAllValidations } from '../app/lib/simulator/emergent/validation.js';

const batchSize = parseInt(process.argv[2]) || 100;

console.log('Starting validation...\n');

runAllValidations(batchSize)
  .then(results => {
    console.log('\nValidation complete.');
    process.exit(results.displacementResults.comparison.overallPass ? 0 : 1);
  })
  .catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
