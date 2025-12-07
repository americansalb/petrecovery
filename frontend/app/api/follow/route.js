import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/follow
 * Get user's followed cases
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const follows = await prisma.caseFollow.findMany({
      where: { userId: session.user.id },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            petName: true,
            petSpecies: true,
            petPhotoUrl: true,
            status: true,
            lastSeenAddress: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      follows: follows.map(f => ({
        ...f.case,
        followedAt: f.createdAt,
        notifications: f.notifications,
      })),
    });
  } catch (error) {
    console.error('Get follows error:', error);
    return NextResponse.json({ error: 'Failed to get follows' }, { status: 500 });
  }
}

/**
 * POST /api/follow
 * Follow a case
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId, notifications = true } = await request.json();

    if (!caseId) {
      return NextResponse.json({ error: 'Case ID required' }, { status: 400 });
    }

    // Check case exists
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, petName: true },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Create or update follow
    const follow = await prisma.caseFollow.upsert({
      where: {
        userId_caseId: {
          userId: session.user.id,
          caseId,
        },
      },
      update: { notifications },
      create: {
        userId: session.user.id,
        caseId,
        notifications,
      },
    });

    return NextResponse.json({
      success: true,
      follow,
      message: `Now following ${caseData.petName}'s case`,
    });
  } catch (error) {
    console.error('Follow case error:', error);
    return NextResponse.json({ error: 'Failed to follow case' }, { status: 500 });
  }
}

/**
 * DELETE /api/follow
 * Unfollow a case
 */
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    if (!caseId) {
      return NextResponse.json({ error: 'Case ID required' }, { status: 400 });
    }

    await prisma.caseFollow.deleteMany({
      where: {
        userId: session.user.id,
        caseId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unfollow case error:', error);
    return NextResponse.json({ error: 'Failed to unfollow' }, { status: 500 });
  }
}
