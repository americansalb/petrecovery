import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getDashboardStats,
  getCasesByStatusOverTime,
  getCasesByPetType,
  getCasesByLocation,
  getUserRegistrationTrends,
  getSquadMetrics,
  getEngagementMetrics,
  getResolutionTimeMetrics,
} from '@/app/lib/analytics';

/**
 * GET /api/admin/analytics
 *
 * Get analytics data for the admin dashboard.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    // Admin only
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const section = searchParams.get('section');

    // If specific section requested, return only that
    if (section) {
      let data;
      switch (section) {
        case 'overview':
          data = await getDashboardStats(days);
          break;
        case 'cases':
          data = await getCasesByStatusOverTime(days);
          break;
        case 'petTypes':
          data = await getCasesByPetType();
          break;
        case 'locations':
          data = await getCasesByLocation();
          break;
        case 'users':
          data = await getUserRegistrationTrends(days);
          break;
        case 'squads':
          data = await getSquadMetrics();
          break;
        case 'engagement':
          data = await getEngagementMetrics(days);
          break;
        case 'resolution':
          data = await getResolutionTimeMetrics();
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid section' },
            { status: 400 }
          );
      }
      return NextResponse.json({ [section]: data });
    }

    // Return all analytics data
    const [
      overview,
      caseTrends,
      petTypes,
      locations,
      userTrends,
      squads,
      engagement,
      resolution,
    ] = await Promise.all([
      getDashboardStats(days),
      getCasesByStatusOverTime(days),
      getCasesByPetType(),
      getCasesByLocation(),
      getUserRegistrationTrends(days),
      getSquadMetrics(),
      getEngagementMetrics(days),
      getResolutionTimeMetrics(),
    ]);

    return NextResponse.json({
      overview,
      caseTrends,
      petTypes,
      locations,
      userTrends,
      squads,
      engagement,
      resolution,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
