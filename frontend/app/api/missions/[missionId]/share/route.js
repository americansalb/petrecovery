import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/missions/:id/share
 *
 * Track a share event for a case.
 * Records the platform, user (if logged in), and timestamp.
 */
export async function POST(request, { params }) {
  try {
    const { id: missionId } = await params;
    const session = await getServerSession(authOptions);

    const body = await request.json();
    const { platform } = body;

    // Validate platform
    const validPlatforms = ['facebook', 'twitter', 'nextdoor', 'whatsapp', 'email', 'linkedin', 'copy', 'native', 'sms'];
    if (!platform || !validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // Verify case exists
    const mission = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true, petName: true, userId: true }
    });

    if (!mission) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    // Get client IP for anonymous tracking
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    // Create share record
    const share = await prisma.shareEvent.create({
      data: {
        missionId,
        platform,
        userId: session?.user?.id || null,
        ipAddress: session?.user?.id ? null : ip, // Only store IP for anonymous shares
        userAgent: request.headers.get('user-agent')?.substring(0, 500) || null
      }
    });

    // Update case share count (denormalized for performance)
    await prisma.case.update({
      where: { id: missionId },
      data: {
        shareCount: { increment: 1 }
      }
    });

    // If the case owner is not the sharer, notify them
    if (mission.userId && mission.userId !== session?.user?.id) {
      try {
        await prisma.notification.create({
          data: {
            userId: mission.userId,
            type: 'CASE_SHARED',
            title: 'Your case was shared!',
            message: `Someone shared ${mission.petName}'s case on ${platform}. More visibility means more chances of finding them!`,
            data: JSON.stringify({
              missionId,
              platform,
              shareId: share.id
            }),
            read: false
          }
        });
      } catch (notifyError) {
        console.error('Error creating share notification:', notifyError);
        // Don't fail the request if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      shareId: share.id,
      message: 'Share recorded successfully'
    });

  } catch (error) {
    console.error('Error recording share:', error);
    return NextResponse.json(
      { error: 'Failed to record share' },
      { status: 500 }
    );
  }
}
