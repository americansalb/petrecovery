/**
 * Maps action keys to their run(ctx) implementations. Only implemented actions
 * appear here; the registry's `enabled` flag gates which ones actually run.
 * As later PRs land, import + register their run functions.
 */

import { runQr } from './qr.js';
import { runFlyers } from './flyers.js';
import { runSocial } from './social.js';
import { runAiCopy } from './aiCopy.js';
import { runSearchPlan } from './searchPlan.js';
import { runReverseMatch } from './reverseMatch.js';
import { runShelters } from './shelters.js';
import { runNeighborAlert } from './neighborAlert.js';
import { runRescueForce } from './rescueForce.js';

export const ACTION_RUNNERS = {
  qr: runQr,
  ai_copy: runAiCopy,
  reverse_match: runReverseMatch,
  shelters: runShelters,
  neighbor_alert: runNeighborAlert,
  rescue_force: runRescueForce,
  flyers: runFlyers,
  social: runSocial,
  search_plan: runSearchPlan,
};
