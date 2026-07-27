/**
 * GET /api/cases/[caseNumber]/recovery-kit
 *
 * The durable read behind the "Recovery Kit" success dashboard AND the case
 * page. Reads the persisted CaseActivation + steps + assets so both surfaces
 * render "everything we did for you" on a cold reload with no live connection.
 * Public + PII-safe: matches are already coarsened; owner contact is never
 * included. If there's no activation (older cases), returns exists:false so the
 * UI shows the legacy static next-steps list.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { CASCADE_ACTIONS } from '@/app/lib/cascade/registry';
import { piggybackDrain } from '@/app/lib/cascade/followups';
import { logEvent } from '@/lib/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LABELS = Object.fromEntries(CASCADE_ACTIONS.map((a) => [a.key, a.label]));
const FLYER_KINDS = ['FLYER_LETTER', 'FLYER_HALF', 'FLYER_POSTER'];
const SOCIAL_KINDS = ['SOCIAL_OG', 'SOCIAL_SQUARE', 'SOCIAL_STORY'];

export async function GET(_request, { params }) {
  const { caseNumber } = params;

  const activation = await prisma.caseActivation.findUnique({
    where: { caseNumber },
    include: { steps: true, assets: true },
  });

  if (!activation) {
    return NextResponse.json(
      { exists: false, caseNumber, status: 'unknown', steps: [], assets: { flyers: [], social: [], qr: null } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const stepByKey = Object.fromEntries(activation.steps.map((s) => [s.key, s]));
  const readyAssets = activation.assets.filter((a) => a.status === 'ready' && a.url);
  const assetByKind = Object.fromEntries(readyAssets.map((a) => [a.kind, a]));

  const pickAssets = (kinds) =>
    kinds
      .filter((k) => assetByKind[k])
      .map((k) => ({
        kind: k,
        label: assetByKind[k].label,
        url: assetByKind[k].url,
        mimeType: assetByKind[k].mimeType,
        width: assetByKind[k].width,
        height: assetByKind[k].height,
      }));

  const aiCopy = stepByKey.ai_copy?.result || null;
  const searchPlanStep = stepByKey.search_plan?.result || null;
  const reverseMatch = stepByKey.reverse_match?.result || null;
  const sheltersStep = stepByKey.shelters?.result || null;
  const rescueStep = stepByKey.rescue_force?.result || null;
  const shareTargetsStep = stepByKey.share_targets?.result || null;

  const body = {
    exists: true,
    caseNumber,
    status: activation.status,
    steps: CASCADE_ACTIONS.filter((a) => stepByKey[a.key]).map((a) => ({
      key: a.key,
      label: LABELS[a.key] || a.key,
      status: stepByKey[a.key].status,
      count: stepByKey[a.key].count ?? null,
    })),
    assets: {
      flyers: pickAssets(FLYER_KINDS),
      social: pickAssets(SOCIAL_KINDS),
      qr: assetByKind.QR ? { url: assetByKind.QR.url } : null,
    },
    copy: aiCopy
      ? {
          headline: aiCopy.headline || null,
          plea: aiCopy.plea || null,
          captions: aiCopy.captions || null,
          hashtags: aiCopy.hashtags || [],
          source: aiCopy.source || null,
        }
      : null,
    searchPlan: searchPlanStep
      ? { narrative: searchPlanStep.narrative, sections: searchPlanStep.sections || [] }
      : null,
    matches: reverseMatch?.matches || [],
    shelters: sheltersStep?.shelters || [],
    sheltersGuidance: sheltersStep?.guidance || null,
    forces: rescueStep?.forces || [],
    shareTargets: shareTargetsStep?.targets || [],
  };

  logEvent({
    event_type: 'cascade.recovery_kit.read',
    resource_type: 'case',
    resource_id: activation.caseId,
    action: 'read',
    result: 'success',
    metadata: { caseNumber, status: activation.status },
  }).catch(() => {});

  // Opportunistically deliver a few due follow-ups on case-page traffic - keeps
  // reminders punctual without a cron, and never delays this read.
  piggybackDrain(3);

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
