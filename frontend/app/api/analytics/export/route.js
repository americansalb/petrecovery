import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/analytics/export - Export analytics data
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'missions';
    const format = searchParams.get('format') || 'csv';
    const range = searchParams.get('range') || '30d';

    const now = new Date();
    let startDate = new Date();
    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
    }

    let data = [];
    let headers = [];
    let filename = '';

    switch (type) {
      case 'missions':
        data = await prisma.case.findMany({
          where: { createdAt: { gte: startDate } },
          select: {
            caseNumber: true,
            petName: true,
            petSpecies: true,
            status: true,
            priority: true,
            lastSeenAddress: true,
            createdAt: true,
            resolvedAt: true,
            resolution: true,
          },
          orderBy: { createdAt: 'desc' },
        });
        headers = ['Case Number', 'Pet Name', 'Species', 'Status', 'Priority', 'Location', 'Created', 'Resolved', 'Resolution'];
        filename = `cases-${range}`;
        break;

      case 'users':
        data = await prisma.user.findMany({
          where: { createdAt: { gte: startDate } },
          select: {
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            rescueLevel: true,
            createdAt: true,
            lastActive: true,
          },
          orderBy: { createdAt: 'desc' },
        });
        headers = ['Email', 'First Name', 'Last Name', 'Role', 'Level', 'Joined', 'Last Active'];
        filename = `users-${range}`;
        break;

      case 'squads':
        data = await prisma.rescueSquad.findMany({
          where: { createdAt: { gte: startDate } },
          select: {
            name: true,
            city: true,
            state: true,
            isActive: true,
            totalCasesCompleted: true,
            successfulReunions: true,
            createdAt: true,
            _count: { select: { members: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
        headers = ['Name', 'City', 'State', 'Active', 'Cases Completed', 'Reunions', 'Created', 'Members'];
        filename = `squads-${range}`;
        data = data.map((s) => ({
          ...s,
          memberCount: s._count.members,
        }));
        break;

      case 'daily':
        data = await prisma.dailyStats.findMany({
          where: { date: { gte: startDate } },
          orderBy: { date: 'asc' },
        });
        headers = ['Date', 'New Users', 'Active Users', 'New Cases', 'Resolved', 'Reunions', 'Page Views'];
        filename = `daily-stats-${range}`;
        break;

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    if (format === 'json') {
      return NextResponse.json({ data }, {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        },
      });
    }

    // Generate CSV
    const csv = generateCSV(data, headers, type);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    console.error('Analytics export error:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

function generateCSV(data, headers, type) {
  const rows = [headers.join(',')];

  for (const item of data) {
    let row = [];
    switch (type) {
      case 'missions':
        row = [
          item.caseNumber,
          escapeCSV(item.petName),
          item.petSpecies,
          item.status,
          item.priority,
          escapeCSV(item.lastSeenAddress),
          formatDate(item.createdAt),
          formatDate(item.resolvedAt),
          item.resolution || '',
        ];
        break;
      case 'users':
        row = [
          item.email,
          escapeCSV(item.firstName),
          escapeCSV(item.lastName || ''),
          item.role,
          item.rescueLevel,
          formatDate(item.createdAt),
          formatDate(item.lastActive),
        ];
        break;
      case 'squads':
        row = [
          escapeCSV(item.name),
          escapeCSV(item.city || ''),
          item.state || '',
          item.isActive ? 'Yes' : 'No',
          item.totalCasesCompleted,
          item.successfulReunions,
          formatDate(item.createdAt),
          item.memberCount,
        ];
        break;
      case 'daily':
        row = [
          formatDate(item.date),
          item.newUsers,
          item.activeUsers,
          item.newCases,
          item.resolvedCases,
          item.reunions,
          item.pageViews,
        ];
        break;
    }
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

function escapeCSV(str) {
  if (!str) return '';
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
}
