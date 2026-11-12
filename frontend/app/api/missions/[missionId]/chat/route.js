/**
 * The older case chat.
 *
 * GET  /api/missions/[missionId]/chat  the messages on one pet's search
 * POST /api/missions/[missionId]/chat  write one
 *
 * Nothing on the site calls it: talk on a search goes through
 * /api/mission/[missionId]/message (app/lib/searchTalk.js). It stays for
 * the people a search's own lists are for (app/lib/missionControl/guard.js,
 * `mayKnowThePeople`): the owner, an active member of a force looking for
 * the pet, and staff.
 *
 * It used to answer any account, for any pet: read every message with its
 * writer's account id, and write text of any length into the feed of the
 * force assigned to the pet. People are first names here, a message is
 * text held to a length, and writing is counted per connection.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { mayKnowThePeople } from '@/app/lib/missionControl/guard';
import { onlyText, hasText, cut, firstWord } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse, RateLimitPresets } from '@/app/lib/rateLimit';

export const dynamic = 'force-dynamic';

const CHAT_MAX = 500;
const WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 12, blockDurationMs: 60 * 1000 };
const REFUSAL = { error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' };

/** The pet the address names and whether this request may read its chat: { pet, who } or { refusal }. */
async function door(request, params) {
  const { missionId } = await params;
  const pet = await prisma.case.findFirst({ where: missionWhere(String(missionId || '')), select: { id: true } });
  if (!pet) return { refusal: NextResponse.json({ error: 'Mission not found', messages: [] }, { status: 404 }) };
  const who = await mayKnowThePeople(request, pet.id);
  if (!who.allowed) return { refusal: NextResponse.json({ ...REFUSAL, messages: [] }, { status: who.status }) };
  return { pet, who };
}

const shown = (activity, viewerId) => ({
  id: activity.id,
  // A first name, and whether the message is the reader's own. Never an account id.
  userName: firstWord(activity.actor?.firstName) || 'A helper',
  mine: Boolean(viewerId && activity.actorId === viewerId),
  text: activity.message,
  timestamp: activity.createdAt.toISOString(),
});

export async function GET(request, { params }) {
  try {
    const limited = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'case:chat-read');
    if (!limited.success) return rateLimitResponse(limited);
    const { pet, who, refusal } = await door(request, params);
    if (refusal) return refusal;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit'), 10) || 100, 1), 200);

    const activities = await prisma.squadActivity.findMany({
      where: { caseId: pet.id, type: 'CHAT_MESSAGE' },
      include: { actor: { select: { firstName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Oldest first for display
    const viewerId = who.searcher?.userId || null;
    return NextResponse.json({ messages: activities.map((a) => shown(a, viewerId)).reverse() });
  } catch (error) {
    console.error('Error fetching mission chat:', error);
    return NextResponse.json({ error: 'Failed to fetch messages', messages: [] }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const limited = await withRateLimitAsync(request, WRITE_LIMIT, 'case:chat-write');
    if (!limited.success) return rateLimitResponse(limited);
    const { pet, who, refusal } = await door(request, params);
    if (refusal) return refusal;
    // Writing takes an account: the message is kept under its writer.
    const userId = who.searcher?.userId || null;
    if (!userId) return NextResponse.json({ error: 'Please sign in to chat' }, { status: 401 });

    const sent = await request.json().catch(() => null);
    const content = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent.content : null;
    const text = typeof content === 'string' ? cut(onlyText(content).replace(/\n{3,}/g, '\n\n').trim(), CHAT_MAX) : '';
    if (!hasText(text)) return NextResponse.json({ error: 'Message content required' }, { status: 400 });

    // A message is kept as a force's activity, so it needs a force: the one assigned to the pet. A pet with
    // none has no chat here (this used to make a hidden force for it, from any account's request).
    const assignment = await prisma.caseAssignment.findFirst({
      where: { missionId: pet.id, rescueSquadId: { not: null } },
      select: { rescueSquadId: true },
      orderBy: { id: 'asc' },
    });
    if (!assignment?.rescueSquadId) {
      return NextResponse.json({ error: 'No force is looking for this pet yet, so there is no chat to write in.', code: 'NO_FORCE' }, { status: 409 });
    }

    const message = await prisma.squadActivity.create({
      data: {
        rescueSquadId: assignment.rescueSquadId,
        type: 'CHAT_MESSAGE',
        message: text,
        actorId: userId,
        caseId: pet.id,
        details: JSON.stringify({}),
      },
      include: { actor: { select: { firstName: true } } },
    });

    return NextResponse.json({ message: shown(message, userId) });
  } catch (error) {
    console.error('Error sending mission chat:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
