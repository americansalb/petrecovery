/**
 * Live Operations API
 * Real-time dashboard data for case coordination.
 *
 * SECURITY: this returns live volunteer GPS positions (user id, first name,
 * current location), so it is authenticated and scoped to a single case the
 * caller has authority over. Previously it had no auth AND read `missionId`
 * from a `[caseId]` folder (always undefined), which made Prisma drop the
 * scope filter and return every active volunteer's location platform-wide.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { userHasCaseAuthority } from '@/app/lib/authz';
import {
  getLiveOpsData,
  getVolunteerPositions,
  getCaseStats,
} from '@/app/lib/volunteer/liveOps';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // The route param is named caseId; accept a Case id or caseNumber and
    // resolve to the canonical Case.id used by search sessions + authz.
    const ref = params.caseId;
    const theCase = await prisma.case.findFirst({
      where: { OR: [{ id: ref }, { caseNumber: ref }] },
      select: { id: true },
    });
    if (!theCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const authorized = await userHasCaseAuthority(session.user.id, theCase.id);
    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized for this case' }, { status: 403 });
    }

    const caseId = theCase.id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'full';

    switch (type) {
      case 'positions': {
        // Lightweight endpoint for frequent polling
        const positions = await getVolunteerPositions(caseId);
        return NextResponse.json({ success: true, positions });
      }

      case 'stats': {
        const stats = await getCaseStats(caseId);
        return NextResponse.json({ success: true, stats });
      }

      case 'full':
      default: {
        const result = await getLiveOpsData(caseId);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 404 });
        }
        return NextResponse.json(result);
      }
    }
  } catch (error) {
    console.error('Live ops error:', error);
    return NextResponse.json(
      { error: 'Failed to get live data' },
      { status: 500 }
    );
  }
}
