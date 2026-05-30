/**
 * Case Closure API
 *
 * POST /api/mission/[missionId]/close - Close a case with outcome for ML training
 * GET /api/mission/[missionId]/close - Get case metrics/analytics
 *
 * Per Actions_Guide.md Phase 6 specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getOutcomeService } from '@/lib/actions';
import { OutcomeType, FoundMethod } from '@prisma/client';

// =============================================================================
// VALIDATION
// =============================================================================

const VALID_OUTCOMES: OutcomeType[] = ['REUNITED', 'NOT_FOUND', 'DECEASED', 'CLOSED_OTHER'];
const VALID_FOUND_METHODS: FoundMethod[] = [
  'CAME_HOME',
  'SHELTER_INTAKE',
  'NEIGHBOR_FOUND',
  'SIGHTING_LED_TO',
  'TRAP_CAUGHT',
  'FLYER_RESPONSE',
  'SOCIAL_MEDIA',
  'OTHER',
];
const VALID_PET_BEHAVIORS = ['INDOOR', 'OUTDOOR', 'SKITTISH', 'FRIENDLY'];
const VALID_LOCATION_TYPES = ['URBAN', 'SUBURBAN', 'RURAL'];

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * POST /api/mission/[missionId]/close
 *
 * Close a case with outcome recording
 *
 * Body: {
 *   outcome: 'REUNITED' | 'NOT_FOUND' | 'DECEASED' | 'CLOSED_OTHER',
 *   foundMethod?: FoundMethod (required if REUNITED),
 *   foundMethodDetails?: string,
 *   petBehavior?: 'INDOOR' | 'OUTDOOR' | 'SKITTISH' | 'FRIENDLY',
 *   locationType?: 'URBAN' | 'SUBURBAN' | 'RURAL',
 *   ownerFeedback?: string,
 *   helpfulActions?: string[]
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId } = await params;
    const body = await request.json();

    // Validate required fields
    const { outcome, foundMethod, foundMethodDetails, petBehavior, locationType, ownerFeedback, helpfulActions } = body;

    if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(', ')}` },
        { status: 400 }
      );
    }

    // foundMethod is required for REUNITED
    if (outcome === 'REUNITED' && foundMethod && !VALID_FOUND_METHODS.includes(foundMethod)) {
      return NextResponse.json(
        { error: `Invalid foundMethod. Must be one of: ${VALID_FOUND_METHODS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate optional enums
    if (petBehavior && !VALID_PET_BEHAVIORS.includes(petBehavior)) {
      return NextResponse.json(
        { error: `Invalid petBehavior. Must be one of: ${VALID_PET_BEHAVIORS.join(', ')}` },
        { status: 400 }
      );
    }

    if (locationType && !VALID_LOCATION_TYPES.includes(locationType)) {
      return NextResponse.json(
        { error: `Invalid locationType. Must be one of: ${VALID_LOCATION_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify case exists and user has permission (owner or admin)
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true, reporterId: true },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // For now, only the case owner can close the case
    // TODO: Add admin/moderator check
    if (missionRecord.reporterId !== user.id) {
      return NextResponse.json(
        { error: 'Only the case owner can close this case' },
        { status: 403 }
      );
    }

    // Close the case
    const outcomeService = getOutcomeService(prisma);
    const result = await outcomeService.closeCase({
      missionId,
      outcome,
      foundMethod,
      foundMethodDetails,
      petBehavior,
      locationType,
      ownerFeedback,
      helpfulActions,
      closedBy: user.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      outcomeId: result.outcomeId,
      message: outcome === 'REUNITED' ? 'Congratulations! Case marked as reunited.' : 'Mission closed.',
    });
  } catch (error) {
    console.error('Case close error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/mission/[missionId]/close
 *
 * Get case metrics for display before/after closing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId } = await params;

    // Verify case exists
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      select: {
        id: true,
        petName: true,
        petSpecies: true,
        status: true,
        createdAt: true,
        caseOutcome: true,
      },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Get metrics
    const outcomeService = getOutcomeService(prisma);
    const metrics = await outcomeService.getCaseAnalytics(missionId);

    return NextResponse.json({
      case: {
        id: missionRecord.id,
        petName: missionRecord.petName,
        petType: missionRecord.petSpecies,
        status: missionRecord.status,
        createdAt: missionRecord.createdAt,
        isClosed: !!missionRecord.caseOutcome,
      },
      metrics,
      outcome: missionRecord.caseOutcome
        ? {
            outcome: missionRecord.caseOutcome.outcome,
            foundMethod: missionRecord.caseOutcome.foundMethod,
            timeToReunionHours: missionRecord.caseOutcome.timeToReunionHours,
            createdAt: missionRecord.caseOutcome.createdAt,
          }
        : null,
    });
  } catch (error) {
    console.error('Case metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
