import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/activity/feed
 * Get personalized activity feed
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type'); // all, followed, nearby, squads

    // Get user's followed cases and squads
    const [followedCases, userSquads, userProfile] = await Promise.all([
      prisma.caseFollow.findMany({
        where: { userId: session.user.id },
        select: { missionId: true },
      }),
      prisma.rescueSquadMember.findMany({
        where: { userId: session.user.id, isActive: true },
        select: { rescueSquadId: true },
      }),
      prisma.userProfile.findUnique({
        where: { userId: session.user.id },
        select: { latitude: true, longitude: true },
      }),
    ]);

    const followedCaseIds = followedCases.map(f => f.missionId);
    const squadIds = userSquads.map(s => s.rescueSquadId);

    // Build activity feed from multiple sources
    const activities = [];

    // Case updates from followed cases
    if (type === 'all' || type === 'followed') {
      const caseUpdates = await prisma.caseUpdate.findMany({
        where: {
          missionId: { in: followedCaseIds },
          ...(cursor && { createdAt: { lt: new Date(cursor) } }),
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          case: {
            select: { missionNumber: true, petName: true, petPhotoUrl: true },
          },
          author: {
            select: { firstName: true, profileImage: true },
          },
        },
      });

      activities.push(...caseUpdates.map(u => ({
        id: `update-${u.id}`,
        type: 'CASE_UPDATE',
        content: u.content,
        missionNumber: u.case.missionNumber,
        petName: u.case.petName,
        petPhoto: u.case.petPhotoUrl,
        author: u.author.firstName,
        authorAvatar: u.author.profileImage,
        createdAt: u.createdAt,
      })));
    }

    // Sightings from followed cases
    if (type === 'all' || type === 'followed') {
      const sightings = await prisma.caseSighting.findMany({
        where: {
          missionId: { in: followedCaseIds },
          ...(cursor && { createdAt: { lt: new Date(cursor) } }),
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          case: {
            select: { missionNumber: true, petName: true, petPhotoUrl: true },
          },
        },
      });

      activities.push(...sightings.map(s => ({
        id: `sighting-${s.id}`,
        type: 'SIGHTING',
        content: `Possible sighting reported near ${s.address}`,
        missionNumber: s.case.missionNumber,
        petName: s.case.petName,
        petPhoto: s.case.petPhotoUrl,
        certainty: s.certaintyLevel,
        location: { lat: s.latitude, lng: s.longitude, address: s.address },
        createdAt: s.createdAt,
      })));
    }

    // Squad activities
    if ((type === 'all' || type === 'squads') && squadIds.length > 0) {
      const squadActivities = await prisma.squadActivity.findMany({
        where: {
          rescueSquadId: { in: squadIds },
          ...(cursor && { createdAt: { lt: new Date(cursor) } }),
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rescueSquad: {
            select: { name: true },
          },
          actor: {
            select: { firstName: true, profileImage: true },
          },
        },
      });

      activities.push(...squadActivities.map(a => ({
        id: `squad-${a.id}`,
        type: 'SQUAD_ACTIVITY',
        activityType: a.type,
        content: a.message,
        squadName: a.rescueSquad.name,
        actor: a.actor?.firstName,
        actorAvatar: a.actor?.profileImage,
        createdAt: a.createdAt,
      })));
    }

    // Nearby new cases (if user has location)
    if ((type === 'all' || type === 'nearby') && userProfile?.latitude) {
      const radiusDegrees = 0.15; // ~10 miles
      const nearbyMissions = await prisma.case.findMany({
        where: {
          status: { in: ['ACTIVE', 'IN_PROGRESS'] },
          lastSeenLatitude: {
            gte: userProfile.latitude - radiusDegrees,
            lte: userProfile.latitude + radiusDegrees,
          },
          lastSeenLongitude: {
            gte: userProfile.longitude - radiusDegrees,
            lte: userProfile.longitude + radiusDegrees,
          },
          ...(cursor && { createdAt: { lt: new Date(cursor) } }),
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          missionNumber: true,
          petName: true,
          petSpecies: true,
          petPhotoUrl: true,
          lastSeenAddress: true,
          createdAt: true,
        },
      });

      activities.push(...nearbyMissions.map(c => ({
        id: `case-${c.id}`,
        type: 'NEARBY_CASE',
        content: `${c.petName} (${c.petSpecies}) reported lost near ${c.lastSeenAddress}`,
        missionNumber: c.missionNumber,
        petName: c.petName,
        petPhoto: c.petPhotoUrl,
        createdAt: c.createdAt,
      })));
    }

    // Success stories (reunions)
    const reunions = await prisma.case.findMany({
      where: {
        status: 'REUNITED',
        resolvedAt: { not: null },
        ...(cursor && { resolvedAt: { lt: new Date(cursor) } }),
      },
      take: Math.min(limit, 5), // Limit reunion stories
      orderBy: { resolvedAt: 'desc' },
      select: {
        id: true,
        missionNumber: true,
        petName: true,
        petSpecies: true,
        petPhotoUrl: true,
        resolvedAt: true,
        resolutionNotes: true,
      },
    });

    activities.push(...reunions.map(r => ({
      id: `reunion-${r.id}`,
      type: 'REUNION',
      content: r.resolutionNotes || `${r.petName} has been reunited with their family!`,
      missionNumber: r.missionNumber,
      petName: r.petName,
      petPhoto: r.petPhotoUrl,
      createdAt: r.resolvedAt,
    })));

    // Sort all activities by date
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply limit and get cursor for pagination
    const limitedActivities = activities.slice(0, limit);
    const nextCursor = limitedActivities.length === limit
      ? limitedActivities[limitedActivities.length - 1].createdAt.toISOString()
      : null;

    return NextResponse.json({
      activities: limitedActivities,
      nextCursor,
      hasMore: activities.length > limit,
    });
  } catch (error) {
    console.error('Activity feed error:', error);
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
  }
}
