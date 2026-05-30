import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/db';
import { isAdmin } from '@/app/lib/authz';
import {
  generateExecutiveDashboard,
  analyzeTrends,
  buildCustomReport,
  exportData,
  getRealTimeMetrics,
  generateGeographicReport,
} from '@/app/lib/reporting/businessIntelligence';

/**
 * GET /api/reports/dashboard
 * Get dashboard data and reports
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Platform-wide business intelligence + data export → admin only (fresh
    // role). Note: report-create auto-creates a user per guest reporter, so
    // "any session" is effectively "anyone who ever filed a report".
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'executive';

    switch (type) {
      case 'executive':
        const dashboard = await generateExecutiveDashboard(prisma, {
          startDate: searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: searchParams.get('endDate') || new Date().toISOString(),
        });
        return NextResponse.json(dashboard);

      case 'realtime':
        const realtime = await getRealTimeMetrics(prisma);
        return NextResponse.json(realtime);

      case 'geographic':
        const geographic = await generateGeographicReport(prisma, {
          state: searchParams.get('state'),
          city: searchParams.get('city'),
        });
        return NextResponse.json(geographic);

      case 'trends':
        const trends = await analyzeTrends(prisma, {
          metric: searchParams.get('metric'),
          period: searchParams.get('period'),
          lookback: parseInt(searchParams.get('lookback')) || 12,
        });
        return NextResponse.json(trends);

      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json(
      { error: 'Report generation failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/dashboard
 * Build custom reports or export data
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Platform-wide business intelligence + data export → admin only (fresh
    // role). Note: report-create auto-creates a user per guest reporter, so
    // "any session" is effectively "anyone who ever filed a report".
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'custom':
        const customReport = await buildCustomReport(prisma, body.config);
        return NextResponse.json(customReport);

      case 'export':
        const exportResult = await exportData(prisma, body.exportConfig);
        return NextResponse.json(exportResult);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Reports action error:', error);
    return NextResponse.json(
      { error: 'Action failed' },
      { status: 500 }
    );
  }
}
