/**
 * Priority Mode API
 * Urgent case surge protocol
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  getCasePriority,
  activatePriorityMode,
  deactivatePriorityMode,
  getActivePriorityCases,
  getSurgeStats,
} from '@/app/lib/volunteer/priorityMode';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const type = searchParams.get('type') || 'list';

    if (type === 'list') {
      // Get all active priority cases
      const cases = await getActivePriorityCases();
      return NextResponse.json({ success: true, cases });
    }

    if (caseId) {
      if (type === 'stats') {
        const stats = await getSurgeStats(caseId);
        return NextResponse.json({ success: true, stats });
      }

      // Get priority info for specific case
      const prisma = (await import('@/app/lib/prisma')).default;
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
      });

      if (!caseData) {
        return NextResponse.json(
          { error: 'Case not found' },
          { status: 404 }
        );
      }

      const priority = getCasePriority(caseData);
      return NextResponse.json({ success: true, priority });
    }

    return NextResponse.json(
      { error: 'Case ID required for priority info' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Priority mode GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get priority data' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession();

    // Some priority actions require authentication
    const body = await request.json();
    const { action, caseId, reason, duration } = body;

    if (!caseId) {
      return NextResponse.json(
        { error: 'Case ID required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'activate':
        // Requires leader permissions in production
        const activateResult = await activatePriorityMode(caseId, {
          triggeredBy: session?.user?.id || 'MANUAL',
          reason: reason || 'Manual activation',
          duration: duration || 2,
        });

        if (!activateResult.success) {
          return NextResponse.json(
            { error: activateResult.error },
            { status: 400 }
          );
        }

        return NextResponse.json(activateResult);

      case 'deactivate':
        if (!session?.user?.id) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          );
        }

        const deactivateResult = await deactivatePriorityMode(
          caseId,
          reason || 'Manual deactivation'
        );

        return NextResponse.json(deactivateResult);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Priority mode POST error:', error);
    return NextResponse.json(
      { error: 'Failed to perform priority action' },
      { status: 500 }
    );
  }
}
