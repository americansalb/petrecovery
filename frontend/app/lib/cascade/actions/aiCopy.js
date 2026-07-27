/**
 * ai_copy action (tier 0) - generates the emotional flyer copy, per-platform
 * social captions, and the personalized search plan. Always succeeds: the
 * generator returns a full deterministic pack when AI is unavailable, so
 * downstream flyers/social/share_kit/search_plan always have copy to use.
 */

import { generateAiCopy } from '../aiCopy.js';

export async function runAiCopy(ctx) {
  const copy = await generateAiCopy(ctx.case);
  // Exposed to flyers/social (headline/plea/description) and share_kit
  // (captions/hashtags) and search_plan (searchPlan) via ctx.results.ai_copy.
  return { result: copy };
}
