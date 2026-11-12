/**
 * POST /api/mission/[missionId]/trained
 *
 * Someone has read "Before you go out", the short training shown after
 * they agree to the waiver (app/lib/safetyRules.js). The time is stamped
 * on the record of that agreement (WaiverAcceptance.trainedAt), so the
 * site can show that a helper was told how to search before they went.
 *
 * Nothing refuses a search to someone without it: the training is a step
 * on the way, not a gate (founder, 2026-11-12). The person is whoever
 * the request proves they are (app/lib/searcher.js); no id is read from
 * the body.
 */
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { searcherFor } from '@/app/lib/searcher';
import { recordTrained } from '@/app/lib/waiver';
import { withRateLimitAsync } from '@/app/lib/rateLimit';

const LIMIT = { windowMs: 60 * 1000, maxRequests: 10, blockDurationMs: 60 * 1000 };

export async function POST(request, { params }) {
  const limit = await withRateLimitAsync(request, LIMIT, 'search:trained');
  if (!limit.success) return NextResponse.json({ error: 'That is a lot at once. Try again in a moment.' }, { status: 429 });
  const { missionId } = await params;
  const pet = await prisma.case.findFirst({ where: missionWhere(missionId), select: { id: true } }).catch(() => null);
  if (!pet) return NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 });
  const searcher = await searcherFor(request, pet.id);
  if (!searcher) return NextResponse.json({ error: 'Join the search first.', code: 'NOT_JOINED' }, { status: 401 });
  const stamped = await recordTrained({ userId: searcher.userId, volunteerId: searcher.volunteerId });
  return NextResponse.json({ ok: true, recorded: stamped });
}
