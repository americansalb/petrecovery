import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/cases/:id/share-stats
 *
 * Get share statistics for a case.
 * Returns counts by platform and total shares.
 */
export async function GET(request, { params }) {
  try {
    const { id: caseId } = await params;

    // Verify case exists
    const lostPetCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, shareCount: true }
    });

    if (!lostPetCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Get share counts by platform
    const sharesByPlatform = await prisma.shareEvent.groupBy({
      by: ['platform'],
      where: { caseId },
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
        caseId,
        createdAt: { gte: oneDayAgo }
      }
    });

    // Get unique sharers count
    const uniqueSharers = await prisma.shareEvent.groupBy({
      by: ['userId'],
      where: {
        caseId,
        userId: { not: null }
      }
    });

    return NextResponse.json({
      counts,
      total: lostPetCase.shareCount || Object.values(counts).reduce((a, b) => a + b, 0),
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
