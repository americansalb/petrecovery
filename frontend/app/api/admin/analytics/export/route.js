import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import {
  getDashboardStats,
  getCasesByStatusOverTime,
  getCasesByPetType,
  getCasesByLocation,
  getSquadMetrics,
  getEngagementMetrics,
  getResolutionTimeMetrics,
} from '@/app/lib/analytics';

/**
 * GET /api/admin/analytics/export
 *
 * Export analytics data as CSV or JSON.
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
    const format = searchParams.get('format') || 'json';
    const days = parseInt(searchParams.get('days') || '30');

    // Gather all data
    const [
      overview,
      caseTrends,
      petTypes,
      locations,
      squads,
      engagement,
      resolution,
    ] = await Promise.all([
      getDashboardStats(days),
      getCasesByStatusOverTime(days),
      getCasesByPetType(),
      getCasesByLocation(),
      getSquadMetrics(),
      getEngagementMetrics(days),
      getResolutionTimeMetrics(),
    ]);

    const data = {
      exportDate: new Date().toISOString(),
      dateRange: `${days} days`,
      overview,
      caseTrends,
      petTypes,
      locations,
      squads,
      engagement,
      resolution,
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvSections = [];

      // Overview section
      csvSections.push('# Overview');
      csvSections.push('Metric,Value');
      Object.entries(overview).forEach(([key, value]) => {
        csvSections.push(`${key},${value}`);
      });

      // Case trends section
      csvSections.push('');
      csvSections.push('# Case Trends');
      csvSections.push('Date,Created,Resolved,Total');
      caseTrends.forEach((row) => {
        csvSections.push(`${row.date},${row.created},${row.resolved},${row.total}`);
      });

      // Pet types section
      csvSections.push('');
      csvSections.push('# Cases by Pet Type');
      csvSections.push('Type,Count');
      petTypes.forEach((row) => {
        csvSections.push(`${row.type},${row.count}`);
      });

      // Locations section
      csvSections.push('');
      csvSections.push('# Cases by Location');
      csvSections.push('State,Count');
      locations.forEach((row) => {
        csvSections.push(`${row.state},${row.count}`);
      });

      // Resolution times section
      csvSections.push('');
      csvSections.push('# Resolution Times');
      csvSections.push(`Average Days,${resolution.averageDays}`);
      csvSections.push(`Median Days,${resolution.medianDays}`);
      csvSections.push(`Total Resolved,${resolution.totalResolved}`);
      csvSections.push('');
      csvSections.push('Time Range,Count');
      resolution.distribution.forEach((row) => {
        csvSections.push(`${row.range},${row.count}`);
      });

      const csv = csvSections.join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="reunitepets-analytics-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON format
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="reunitepets-analytics-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export analytics' },
      { status: 500 }
    );
  }
}
