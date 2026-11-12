/**
 * Scout Tip Actions API
 *
 * DELETE /api/mission/[missionId]/tips/[tipId] - Dismiss a tip
 * POST /api/mission/[missionId]/tips/[tipId] - Perform tip action (e.g., post to chat)
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getTipService } from '@/lib/actions';
import { mayKnowThePeople } from '@/app/lib/missionControl/guard';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';

// A tip on one pet's search is put away, or marked as posted, by the people on that search: the owner, an
// active member of a force looking for the pet, and staff. Any account could do either for any pet.
const REFUSAL = { error: 'Only the owner and the forces looking for this pet can do that.', code: 'NOT_ALLOWED' };
const WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30, blockDurationMs: 60 * 1000 };

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * DELETE /api/mission/[missionId]/tips/[tipId]
 *
 * Dismiss a Scout tip for the current user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string; tipId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, WRITE_LIMIT, 'case:tip-write');
    if (!limited.success) return rateLimitResponse(limited) as NextResponse;

    const { missionId, tipId } = await params;
    const who = await mayKnowThePeople(request, missionId);
    if (!who.allowed) return NextResponse.json(REFUSAL, { status: who.status });

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify tip exists and belongs to case
    const tip = await prisma.mascotTip.findFirst({
      where: { id: tipId, missionId },
    });

    if (!tip) {
      return NextResponse.json({ error: 'Tip not found' }, { status: 404 });
    }

    // Dismiss tip
    const tipService = getTipService(prisma);
    await tipService.dismissTip(tipId, user.id);

    return NextResponse.json({
      success: true,
      message: 'Tip dismissed',
    });
  } catch (error) {
    console.error('Tip DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mission/[missionId]/tips/[tipId]
 *
 * Perform an action on a tip (e.g., post to chat)
 *
 * Body: {
 *   action: 'post_to_chat'
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string; tipId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, WRITE_LIMIT, 'case:tip-write');
    if (!limited.success) return rateLimitResponse(limited) as NextResponse;

    const { missionId, tipId } = await params;
    const who = await mayKnowThePeople(request, missionId);
    if (!who.allowed) return NextResponse.json(REFUSAL, { status: who.status });

    const sent = await request.json().catch(() => null);
    const action = sent && typeof sent === 'object' && !Array.isArray(sent) ? (sent as any).action : null;

    // Verify tip exists and belongs to case
    const tip = await prisma.mascotTip.findFirst({
      where: { id: tipId, missionId },
    });

    if (!tip) {
      return NextResponse.json({ error: 'Tip not found' }, { status: 404 });
    }

    if (action === 'post_to_chat') {
      // Mark as posted to chat
      const tipService = getTipService(prisma);
      await tipService.markPostedToChat(tipId);

      return NextResponse.json({
        success: true,
        message: 'Tip posted to chat',
        tip: {
          id: tip.id,
          type: tip.tipType,
          title: tip.title,
          message: tip.message,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: post_to_chat' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Tip POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
