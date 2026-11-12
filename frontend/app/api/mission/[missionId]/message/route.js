/**
 * A word between people on one pet's search (app/lib/searchTalk.js).
 *
 * POST /api/mission/[missionId]/message
 *   { text, to? }
 *   With `to` (a person's handle from the board's roster): whoever runs
 *   the search (the owner: app/lib/searcher.js, `leads`) writes to that
 *   helper. It shows on the helper's card on their phone.
 *   Without `to`: a helper's word back to the people running the search.
 *   It takes someone who is on the search: a helper who joined, someone
 *   who has held or walked a street, someone the desk has written to, or
 *   a member of a force looking for the pet. Someone only looking at the
 *   page calls the owner instead.
 *
 * PATCH /api/mission/[missionId]/message
 *   { words?: [id, ...], ask?: true }
 *   This person's screen has shown these words, or the street they were
 *   asked to walk. It is what the desk reads as "seen", so it is said by
 *   the screen that showed it and not inferred from a read. A person can
 *   mark only what was written to them or asked of them.
 *
 * Reading is the picture's job (GET .../picture carries `words` for the
 * person asking), so the screen keeps one poll.
 *
 * A found pet has no search, so it has none of this.
 *
 * [missionId] is the case id or the case number, as on a share link.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { isCaseOpen } from '@/app/lib/caseStatus';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';
import { searcherFor } from '@/app/lib/searcher';
import { personByHandle, teamOf } from '@/app/lib/searchTeam';
import { sendWord, markWordsSeen, WordError } from '@/app/lib/searchTalk';
import { markAskSeen } from '@/app/lib/searchAsk';
import { logEvent } from '@/lib/logging';

export const dynamic = 'force-dynamic';

const WORD_LIMIT = { windowMs: 60 * 1000, maxRequests: 20, blockDurationMs: 60 * 1000 };
const SEEN_LIMIT = { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 60 * 1000 };
const CASE_SELECT = { id: true, caseNumber: true, status: true, reportType: true, petName: true, reporterId: true };

/** A request's body as an object, whatever was sent: nothing, a list or a bare value is an empty one. */
async function bodyOf(request) {
  const body = await request.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

export async function POST(request, { params }) {
  const limit = await withRateLimitAsync(request, WORD_LIMIT, 'search:word');
  if (!limit.success) return rateLimitResponse(limit);
  const correlationId = crypto.randomUUID();
  try {
    const { missionId } = await params;
    const body = await bodyOf(request);
    // Words are text. Anything else is refused here, before it is read as text.
    if (typeof body.text !== 'string') return NextResponse.json({ error: 'Write something first.', code: 'EMPTY' }, { status: 400 });
    const pet = await prisma.case.findFirst({ where: missionWhere(missionId), select: CASE_SELECT });
    if (!pet || pet.reportType === 'FOUND') return NextResponse.json({ error: 'This link does not match a search.' }, { status: 404 });
    const searcher = await searcherFor(request, pet.id);
    if (!searcher) return NextResponse.json({ error: 'Join the search first.', code: 'NOT_JOINED' }, { status: 401 });
    if (!isCaseOpen(pet.status)) return NextResponse.json({ error: 'This search has ended.', code: 'CLOSED' }, { status: 409 });

    let to = null;
    if (body.to != null && body.to !== '') {
      // Writing to a helper is for whoever runs the search: the owner. Checked before the person is looked for, so nobody
      // learns from the answer who is on the search.
      if (!searcher.leads) return NextResponse.json({ error: 'Only the owner can write to a helper.', code: 'NOT_ALLOWED' }, { status: 403 });
      to = typeof body.to === 'string' ? await personByHandle(pet.id, body.to, { ownerId: pet.reporterId }) : null;
      if (!to) return NextResponse.json({ error: 'That person is not on this search.', code: 'NO_PERSON' }, { status: 404 });
    } else if (!searcher.leads && !searcher.seesNames) {
      // A word to the desk comes from someone on the search, not from someone only looking at the page.
      const team = await teamOf(pet.id, { ownerId: pet.reporterId });
      if (!team.some((p) => p.id === searcher.id)) {
        return NextResponse.json({ error: 'Take a street first, or call the owner.', code: 'NOT_ON_SEARCH' }, { status: 403 });
      }
    }

    const row = await sendWord({ caseId: pet.id, pet, searcher, to: to ? { id: to.id, name: to.name } : null, text: body.text });

    await logEvent({
      event_type: to ? 'search.word_to_helper' : 'search.word_to_desk',
      correlation_id: correlationId,
      actor_user_id: searcher.userId,
      resource_type: 'search_message',
      resource_id: row.id,
      action: 'create',
      result: 'success',
      metadata: { caseId: pet.id, length: row.text.length, volunteer: searcher.kind === 'volunteer' },
    }).catch(() => {});

    return NextResponse.json({ message: { id: row.id, at: row.createdAt, text: row.text } }, { status: 201 });
  } catch (error) {
    if (error instanceof WordError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Search message failed:', error);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const limit = await withRateLimitAsync(request, SEEN_LIMIT, 'search:seen');
  if (!limit.success) return rateLimitResponse(limit);
  try {
    const { missionId } = await params;
    const body = await bodyOf(request);
    const pet = await prisma.case.findFirst({ where: missionWhere(missionId), select: CASE_SELECT });
    if (!pet || pet.reportType === 'FOUND') return NextResponse.json({ error: 'This link does not match a search.' }, { status: 404 });
    const searcher = await searcherFor(request, pet.id);
    if (!searcher) return NextResponse.json({ error: 'Join the search first.', code: 'NOT_JOINED' }, { status: 401 });
    // Only what is this person's own: a word written to them, the street asked of them. Nothing in the request names anyone else.
    const words = await markWordsSeen(pet.id, searcher.id, body.words);
    const ask = body.ask === true ? await markAskSeen(pet.id, searcher.id) : 0;
    return NextResponse.json({ seen: { words, ask } });
  } catch (error) {
    console.error('Search seen failed:', error);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }
}
