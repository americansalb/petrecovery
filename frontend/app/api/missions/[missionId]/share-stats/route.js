import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/missions/:id/share-stats
 *
 * Get share statistics for a case.
 * Returns counts by platform and total shares.
 */
export async function GET(request, { params }) {
  try {
    const { id: missionId } = await params;

    // Verify case exists
    const mission = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true, shareCount: true }
    });

    if (!mission) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    // Get share counts by platform
    const sharesByPlatform = await prisma.shareEvent.groupBy({
      by: ['platform'],
      where: { missionId },
      _count: { platform: true }
    });

    // Transform to object
    const counts = {
      facebook: 0,
      twitter: 0,
      nextdoor: 0,
      whatsapp: 0,
      email: 0,
      linkedin: 0,
      copy: 0,
      native: 0,
      sms: 0
    };

    sharesByPlatform.forEach(item => {
      counts[item.platform] = item._count.platform;
    });

    // Get recent shares (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentShares = await prisma.shareEvent.count({
      where: {
        missionId,
        createdAt: { gte: oneDayAgo }
      }
    });

    // Get unique sharers count
    const uniqueSharers = await prisma.shareEvent.groupBy({
      by: ['userId'],
      where: {
        missionId,
        userId: { not: null }
      }
    });

    return NextResponse.json({
      counts,
      total: mission.shareCount || Object.values(counts).reduce((a, b) => a + b, 0),
      recentShares,
      uniqueSharers: uniqueSharers.length,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching share stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share stats' },
      { status: 500 }
    );
  }
}
