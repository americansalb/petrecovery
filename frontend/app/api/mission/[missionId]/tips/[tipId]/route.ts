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
import prisma from '@/app/lib/prisma';
import { getTipService } from '@/lib/actions';

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
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId, tipId } = await params;

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
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId, tipId } = await params;
    const body = await request.json();
    const { action } = body;

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
