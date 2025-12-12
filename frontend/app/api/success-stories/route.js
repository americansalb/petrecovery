import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

/**
 * GET /api/success-stories
 * Get public success stories (reunions)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const species = searchParams.get('species');

    const where = {
      status: 'REUNITED',
      resolvedAt: { not: null },
      ...(species && { petSpecies: species }),
    };

    const [stories, total] = await Promise.all([
      prisma.case.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { resolvedAt: 'desc' },
        select: {
          id: true,
          missionNumber: true,
          petName: true,
          petSpecies: true,
          petBreed: true,
          petPhotoUrl: true,
          lastSeenAddress: true,
          createdAt: true,
          resolvedAt: true,
          resolution: true,
          resolutionNotes: true,
          viewCount: true,
          shareCount: true,
          reporter: {
            select: {
              firstName: true,
              profileImage: true,
            },
          },
          _count: {
            select: {
              sightings: true,
            },
          },
        },
      }),
      prisma.case.count({ where }),
    ]);

    // Calculate days missing for each story
    const storiesWithStats = stories.map(story => ({
      ...story,
      daysMissing: Math.ceil(
        (new Date(story.resolvedAt) - new Date(story.createdAt)) / (1000 * 60 * 60 * 24)
      ),
      sightingsCount: story._count.sightings,
      ownerName: story.reporter.firstName,
      ownerAvatar: story.reporter.profileImage,
    }));

    return NextResponse.json({
      stories: storiesWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Success stories error:', error);
    return NextResponse.json({ error: 'Failed to load stories' }, { status: 500 });
  }
}

/**
 * POST /api/success-stories
 * Submit a success story (with details)
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId, story, thankYouNote, sharePublicly = true } = await request.json();

    if (!missionId || !story) {
      return NextResponse.json({ error: 'Case ID and story required' }, { status: 400 });
    }

    // Verify ownership
    const missionData = await prisma.case.findUnique({
      where: { id: missionId },
      select: { reporterId: true, status: true },
    });

    if (!missionData || missionData.reporterId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (missionData.status !== 'REUNITED') {
      return NextResponse.json({ error: 'Case must be reunited to share story' }, { status: 400 });
    }

    // Create success story
    const successStory = await prisma.successStory.create({
      data: {
        missionId,
        userId: session.user.id,
        story,
        thankYouNote,
        isPublic: sharePublicly,
      },
    });

    // Update case with resolution notes
    await prisma.case.update({
      where: { id: missionId },
      data: { resolutionNotes: story },
    });

    return NextResponse.json({ success: true, story: successStory });
  } catch (error) {
    console.error('Submit story error:', error);
    return NextResponse.json({ error: 'Failed to submit story' }, { status: 500 });
  }
}
