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
import { runShareTargets } from './shareTargets.js';
import { runReverseMatch } from './reverseMatch.js';
import { runShelters } from './shelters.js';
import { runNeighborAlert } from './neighborAlert.js';
import { runRescueForce } from './rescueForce.js';
import { runRecoveryEmail } from './recoveryEmail.js';
import { runFollowups } from './followups.js';

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
  share_targets: runShareTargets,
  recovery_email: runRecoveryEmail,
  followups: runFollowups,
};
