import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';
import { toRelayOpenPayload, toMessagePayload } from '@/app/lib/relay';

export const dynamic = 'force-dynamic';

/**
 * Relay thread for a brokered match connection.
 *
 * POST /api/relay/{token}  — idempotently open the thread (finder clicks "Confirm & connect")
 * GET  /api/relay/{token}  — fetch the thread + messages (poll for owner replies)
 *
 * Hard contract (relay-connect-spec §6): NO response below MUTUAL_OPTIN status
 * contains owner OR finder phone/email/raw contact/exact coords. The owner is
 * referenced only by pet name; the finder only by an anonymous handle. The
 * lostCase is loaded with userId ONLY to derive sender role server-side — it is
 * never returned to the client.
 */

async function loadConnection(token) {
  if (!token || typeof token !== 'string') return null;
  return prisma.matchConnection.findUnique({
    where: { token },
    include: {
      lostCase: {
        select: {
          id: true,
          reporterId: true, // role derivation only — NOT returned
          petName: true,
          petSpecies: true,
          petPhotoUrl: true,
          lastSeenAddress: true,
          city: true,
        },
      },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function POST(request, { params }) {
  try {
    const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'relay:open');
    if (!rl.success) return rateLimitResponse(rl);

    const { token } = await params;
    const connection = await loadConnection(token);
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Idempotent open: the thread already exists (created when the match was
    // surfaced). Emit relay_opened only on the first open (no messages yet) so
    // the conversion funnel isn't inflated by re-opens.
    if (connection.messages.length === 0) {
      await logEvent({
        event_type: 'relay.opened',
        resource_type: 'relay_thread',
        resource_id: connection.token,
        action: 'create',
        result: 'success',
        metadata: { event: 'relay_opened', matchSource: connection.matchSource, pTrueMatch: connection.pTrueMatch },
      }).catch(() => {});
    }

    return NextResponse.json({
      ...toRelayOpenPayload(connection, connection.lostCase),
      messages: connection.messages.map(toMessagePayload),
    });
  } catch (error) {
    console.error('relay open error:', error);
    return NextResponse.json({ error: 'Failed to open relay' }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_READ, 'relay:read');
    if (!rl.success) return rateLimitResponse(rl);

    const { token } = await params;
    const connection = await loadConnection(token);
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...toRelayOpenPayload(connection, connection.lostCase),
      messages: connection.messages.map(toMessagePayload),
    });
  } catch (error) {
    console.error('relay get error:', error);
    return NextResponse.json({ error: 'Failed to load relay' }, { status: 500 });
  }
}
