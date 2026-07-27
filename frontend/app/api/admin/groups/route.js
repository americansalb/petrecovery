import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * Admin view of the CommunityGroup directory (groups discovered by the
 * share_targets cascade action). Listing a group here is NOT an endorsement;
 * rows are raw search-engine discoveries. Admins can block anything that
 * should never be suggested to owners.
 *
 * GET    - list with filters (search/state/status/kind), pagination, stats.
 * PATCH  - set one row's status: ACTIVE | STALE | REMOVED. REMOVED is the
 *          admin block: sweeps never resurrect it and it is never served.
 * DELETE - hard-delete rows by id (junk cleanup; a future sweep may re-add
 *          the group, use REMOVED to block permanently).
 */

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return null;
  return session;
}

const STATUSES = ['ACTIVE', 'STALE', 'REMOVED'];

export async function GET(request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const search = searchParams.get('search');
    const state = searchParams.get('state');
    const status = searchParams.get('status');
    const kind = searchParams.get('kind');

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { coverage: { contains: search, mode: 'insensitive' } },
        { cities: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (state) where.state = { equals: state, mode: 'insensitive' };
    if (status && STATUSES.includes(status)) where.status = status;
    if (kind) where.kind = kind;

    const [groups, total, totalAll, active, stale, removed, areas, serves] = await Promise.all([
      prisma.communityGroup.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
      }),
      prisma.communityGroup.count({ where }),
      prisma.communityGroup.count(),
      prisma.communityGroup.count({ where: { status: 'ACTIVE' } }),
      prisma.communityGroup.count({ where: { status: 'STALE' } }),
      prisma.communityGroup.count({ where: { status: 'REMOVED' } }),
      prisma.communityGroup.groupBy({ by: ['city', 'state'] }),
      prisma.communityGroup.aggregate({ _sum: { timesServed: true } }),
    ]);

    return NextResponse.json({
      groups,
      total,
      page,
      limit,
      searchConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      stats: {
        total: totalAll,
        active,
        stale,
        removed,
        areas: areas.length,
        timesServed: serves._sum.timesServed || 0,
      },
    });
  } catch (error) {
    console.error('Admin groups error:', error);
    return NextResponse.json({ error: 'Failed to fetch groups', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id, status } = await request.json();
    if (!id || !STATUSES.includes(status)) {
      return NextResponse.json({ error: `Provide id and status (${STATUSES.join(', ')})` }, { status: 400 });
    }

    const group = await prisma.communityGroup.update({
      where: { id },
      data: { status, staleAt: status === 'ACTIVE' ? null : new Date() },
    });

    return NextResponse.json({ success: true, group });
  } catch (error) {
    console.error('Admin groups patch error:', error);
    return NextResponse.json({ error: 'Failed to update group', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Provide a non-empty ids array' }, { status: 400 });
    }

    const result = await prisma.communityGroup.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ success: true, deletedCount: result.count });
  } catch (error) {
    console.error('Admin groups delete error:', error);
    return NextResponse.json({ error: 'Failed to delete groups', details: error.message }, { status: 500 });
  }
}
