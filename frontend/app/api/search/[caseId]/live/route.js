/**
 * Live Operations API
 * Real-time dashboard data for case coordination
 */

import { NextResponse } from 'next/server';
import {
  getLiveOpsData,
  getVolunteerPositions,
  getCaseStats,
} from '@/app/lib/volunteer/liveOps';

export async function GET(request, { params }) {
  try {
    const { caseId } = params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'full';

    switch (type) {
      case 'positions':
        // Lightweight endpoint for frequent polling
        const positions = await getVolunteerPositions(caseId);
        return NextResponse.json({ success: true, positions });

      case 'stats':
        const stats = await getCaseStats(caseId);
        return NextResponse.json({ success: true, stats });

      case 'full':
      default:
        const result = await getLiveOpsData(caseId);
        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 404 }
          );
        }
        return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Live ops error:', error);
    return NextResponse.json(
      { error: 'Failed to get live data' },
      { status: 500 }
    );
  }
}
