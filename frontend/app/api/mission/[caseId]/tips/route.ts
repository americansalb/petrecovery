/**
 * Scout Tips API
 *
 * GET /api/mission/[caseId]/tips - Get active tips for a case
 * POST /api/mission/[caseId]/tips - Generate new tips
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
 * GET /api/mission/[caseId]/tips
 *
 * Get active Scout tips for a case
 *
 * Query params:
 * - include_dismissed: boolean (default: false) - Include tips the user has dismissed
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId } = await params;
    const { searchParams } = new URL(request.url);
    const includeDismissed = searchParams.get('include_dismissed') === 'true';

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify case exists
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, petName: true },
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Get active tips
    const tipService = getTipService(prisma);
    const tips = await tipService.getActiveTips(
      caseId,
      includeDismissed ? undefined : user.id
    );

    // Format tips for response
    const formattedTips = tips.map((tip) => ({
      id: tip.id,
      type: tip.tipType,
      title: tip.title,
      message: tip.message,
      priority: tip.priority,
      actionLabel: tip.actionLabel,
      actionType: tip.actionType,
      expiresAt: tip.expiresAt,
      isDismissed: tip.dismissedBy?.includes(user.id) || false,
      createdAt: tip.createdAt,
    }));

    return NextResponse.json({
      tips: formattedTips,
      petName: caseRecord.petName,
      total: formattedTips.length,
    });
  } catch (error) {
    console.error('Tips GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mission/[caseId]/tips
 *
 * Generate new Scout tips for a case
 *
 * Body: {
 *   coldSpotsCount?: number - Number of cold spots (from flyer data)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const { coldSpotsCount = 0 } = body;

    // Verify case exists
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Generate tips
    const tipService = getTipService(prisma);
    const context = await tipService.getTipContext(caseId);

    if (!context) {
      return NextResponse.json({ error: 'Failed to get case context' }, { status: 500 });
    }

    // Add cold spots count from request
    context.coldSpotsCount = coldSpotsCount;

    // Generate and save tips
    const generatedTips = await tipService.generateTips(context);
    await tipService.saveTips(caseId, generatedTips);

    // Get user ID for filtering
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    // Return active tips
    const tips = await tipService.getActiveTips(caseId, user?.id);

    return NextResponse.json({
      success: true,
      generated: generatedTips.length,
      tips: tips.map((tip) => ({
        id: tip.id,
        type: tip.tipType,
        title: tip.title,
        message: tip.message,
        priority: tip.priority,
        actionLabel: tip.actionLabel,
        actionType: tip.actionType,
        expiresAt: tip.expiresAt,
        createdAt: tip.createdAt,
      })),
    });
  } catch (error) {
    console.error('Tips POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
