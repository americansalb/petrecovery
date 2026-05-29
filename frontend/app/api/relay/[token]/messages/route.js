import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';
import { toMessagePayload } from '@/app/lib/relay';

export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LEN = 2000;

/**
 * POST /api/relay/{token}/messages  — send a message in the brokered thread.
 *
 * Sender role is derived SERVER-SIDE (session vs the lost-case owner), never
 * trusted from the client. Messages are stored + rendered as plain text (no
 * HTML). No PII is accepted or returned (contract §6).
 */
export async function POST(request, { params }) {
  try {
    const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'relay:message');
    if (!rl.success) return rateLimitResponse(rl);

    const { token } = await params;
    const body = await request.json().catch(() => null);
    const text = typeof body?.body === 'string' ? body.body.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    }
    if (text.length > MAX_MESSAGE_LEN) {
      return NextResponse.json({ error: 'Message too long' }, { status: 413 });
    }

    const connection = await prisma.matchConnection.findUnique({
      where: { token },
      include: { lostCase: { select: { reporterId: true } } },
    });
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }
    if (connection.status === 'REJECTED' || connection.status === 'REUNITED') {
      return NextResponse.json({ error: 'This conversation is closed' }, { status: 409 });
    }

    // Derive sender role server-side: the lost-case owner is OWNER, anyone else
    // (incl. the anonymous finder) is FINDER. Never trust a client-supplied role.
    const session = await getServerSession(authOptions).catch(() => null);
    const isOwner = session?.user?.id && session.user.id === connection.lostCase?.reporterId;
    const senderRole = isOwner ? 'OWNER' : 'FINDER';

    const message = await prisma.relayMessage.create({
      data: { connectionId: connection.id, senderRole, body: text },
    });

    // First owner reply transitions the thread + marks the funnel milestone.
    if (senderRole === 'OWNER' && connection.status === 'OPEN') {
      await prisma.matchConnection.update({
        where: { id: connection.id },
        data: { status: 'OWNER_REPLIED' },
      });
      await logEvent({
        event_type: 'relay.first_owner_reply',
        resource_type: 'relay_thread',
        resource_id: connection.token,
        action: 'transition',
        result: 'success',
        actor_user_id: session?.user?.id || null,
        actor_role: 'OWNER',
        metadata: { event: 'relay_first_owner_reply' },
      }).catch(() => {});
    }

    return NextResponse.json(toMessagePayload(message), { status: 201 });
  } catch (error) {
    console.error('relay message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
