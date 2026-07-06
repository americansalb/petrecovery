/**
 * Maps action keys to their run(ctx) implementations. Only implemented actions
 * appear here; the registry's `enabled` flag gates which ones actually run.
 * As later PRs land, import + register their run functions.
 */

import { runQr } from './qr.js';
import { runFlyers } from './flyers.js';
import { runSocial } from './social.js';

export const ACTION_RUNNERS = {
  qr: runQr,
  flyers: runFlyers,
  social: runSocial,
};
