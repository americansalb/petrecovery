/**
 * shelter_strays action (tier 0): when a lost report comes in, check it
 * against AVAILABLE stray animals on shelter rosters. Candidates land as
 * PENDING ShelterStrayMatch rows on the shelter dashboard; shelter staff
 * confirm before the owner is ever contacted (that notification lives in
 * the confirm endpoint, never here).
 */

import { runShelterStrayCheck } from '@/app/lib/shelterMatching';

export async function runShelterStrays(ctx) {
  const { candidates, written, sheltersNotified } = await runShelterStrayCheck(ctx.case);
  return { count: written, result: { candidates, written, sheltersNotified } };
}
