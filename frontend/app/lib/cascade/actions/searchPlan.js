/**
 * search_plan action (tier 1) - the personalized "where to look in the first
 * 24 hours" plan surfaced on the success screen + case page. Uses the plan the
 * ai_copy step produced; if ai_copy was skipped/failed, builds a full plan from
 * the deterministic fallback so this never dead-ends.
 */

import { fallbackCopy } from '../aiCopy.js';

export async function runSearchPlan(ctx) {
  const fromAi = ctx.results.ai_copy?.searchPlan;
  const plan = fromAi && Array.isArray(fromAi.sections) && fromAi.sections.length
    ? fromAi
    : fallbackCopy(ctx.case).searchPlan;

  const totalSteps = plan.sections.reduce((n, s) => n + (s.items?.length || 0), 0);
  return { count: totalSteps, result: { ...plan, source: ctx.results.ai_copy?.source || 'fallback' } };
}
