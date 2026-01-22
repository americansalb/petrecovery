import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/volunteers/leaderboard
 * Get volunteer leaderboard
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // all, month, week
    const category = searchParams.get('category') || 'reunions'; // reunions, searches, acreage, honors
    const forceId = searchParams.get('forceId');
    const limit = parseInt(searchParams.get('limit') || '50');

    let dateFilter = {};
    const now = new Date();

    if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { gte: weekAgo };
    } else if (period === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { gte: monthAgo };
    }

    let leaders = [];

    switch (category) {
      case 'reunions':
        leaders = await prisma.user.findMany({
          where: {
            successfulReunions: { gt: 0 },
            ...(forceId && {
              rescueForceMemberships: {
                some: { rescueForceId: forceId, isActive: true },
              },
            }),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            rescueLevel: true,
            successfulReunions: true,
          },
          orderBy: { successfulReunions: 'desc' },
          take: limit,
        });

        leaders = leaders.map((u, idx) => ({
          rank: idx + 1,
          userId: u.id,
          name: `${u.firstName} ${u.lastName?.[0] || ''}.`,
          avatar: u.profileImage,
          level: u.rescueLevel,
          value: u.successfulReunions,
          label: 'reunions',
        }));
        break;

      case 'searches':
        leaders = await prisma.user.findMany({
          where: {
            areasMarkedCount: { gt: 0 },
            ...(forceId && {
              rescueForceMemberships: {
                some: { rescueForceId: forceId, isActive: true },
              },
            }),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            rescueLevel: true,
            areasMarkedCount: true,
          },
          orderBy: { areasMarkedCount: 'desc' },
          take: limit,
        });

        leaders = leaders.map((u, idx) => ({
          rank: idx + 1,
          userId: u.id,
          name: `${u.firstName} ${u.lastName?.[0] || ''}.`,
          avatar: u.profileImage,
          level: u.rescueLevel,
          value: u.areasMarkedCount,
          label: 'areas searched',
        }));
        break;

      case 'acreage':
        leaders = await prisma.user.findMany({
          where: {
            totalAcreageSearched: { gt: 0 },
            ...(forceId && {
              rescueForceMemberships: {
                some: { rescueForceId: forceId, isActive: true },
              },
            }),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            rescueLevel: true,
            totalAcreageSearched: true,
          },
          orderBy: { totalAcreageSearched: 'desc' },
          take: limit,
        });

        leaders = leaders.map((u, idx) => ({
          rank: idx + 1,
          userId: u.id,
          name: `${u.firstName} ${u.lastName?.[0] || ''}.`,
          avatar: u.profileImage,
          level: u.rescueLevel,
          value: Math.round(u.totalAcreageSearched * 10) / 10,
          label: 'acres',
        }));
        break;

      case 'honors':
        leaders = await prisma.user.findMany({
          where: {
            honorsReceived: { gt: 0 },
            ...(forceId && {
              rescueForceMemberships: {
                some: { rescueForceId: forceId, isActive: true },
              },
            }),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            rescueLevel: true,
            honorsReceived: true,
          },
          orderBy: { honorsReceived: 'desc' },
          take: limit,
        });

        leaders = leaders.map((u, idx) => ({
          rank: idx + 1,
          userId: u.id,
          name: `${u.firstName} ${u.lastName?.[0] || ''}.`,
          avatar: u.profileImage,
          level: u.rescueLevel,
          value: u.honorsReceived,
          label: 'honors',
        }));
        break;

      default:
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Get force leaderboard if requested
    let squadLeaders = [];
    if (!forceId) {
      squadLeaders = await prisma.rescueForce.findMany({
        where: { isActive: true, isDeleted: false },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          rescueForceLevel: true,
          successfulReunions: true,
          totalAcreageSearched: true,
          _count: {
            select: { members: true },
          },
        },
        orderBy: { successfulReunions: 'desc' },
        take: 10,
      });

      squadLeaders = squadLeaders.map((s, idx) => ({
        rank: idx + 1,
        forceId: s.id,
        name: s.name,
        logo: s.logoUrl,
        level: s.rescueForceLevel,
        reunions: s.successfulReunions,
        acreage: Math.round(s.totalAcreageSearched),
        members: s._count.members,
      }));
    }

    return NextResponse.json({
      leaders,
      squadLeaders,
      category,
      period,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: 'Failed to get leaderboard' }, { status: 500 });
  }
}
