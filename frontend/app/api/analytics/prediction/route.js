import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/db';
import {
  calculateSuccessProbability,
  analyzeOptimalSearchTimes,
  predictLocationZones,
  findSimilarCases,
} from '@/app/lib/analytics/predictive';

/**
 * GET /api/analytics/prediction?missionId=xxx
 * Get predictive analytics for a case
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');
    const analysisType = searchParams.get('type') || 'full';

    if (!missionId) {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      );
    }

    // Fetch case data
    const missionData = await prisma.case.findUnique({
      where: { id: missionId },
      include: {
        sightings: true,
        _count: {
          select: {
            squadAssignments: true,
          },
        },
      },
    });

    if (!missionData) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    // Prepare case data for analysis
    const analysisData = {
      petSpecies: missionData.petSpecies,
      lastSeenAt: missionData.lastSeenAt,
      hasMicrochip: missionData.hasMicrochip,
      hasCollar: missionData.hasCollar,
      sightingsCount: missionData.sightings?.length || 0,
      activeSearchers: missionData._count?.squadAssignments || 0,
      hasReward: missionData.rewardAmount > 0,
      isUrban: missionData.isUrban ?? true,
      checkedShelters: missionData.checkedShelters,
    };

    const response = { missionId };

    // Success probability
    if (analysisType === 'full' || analysisType === 'probability') {
      const probability = await calculateSuccessProbability(analysisData, []);
      response.probability = probability;
    }

    // Optimal search times
    if (analysisType === 'full' || analysisType === 'times') {
      const searchTimes = analyzeOptimalSearchTimes(missionData.sightings);
      response.optimalSearchTimes = searchTimes;
    }

    // Location zones
    if (analysisType === 'full' || analysisType === 'zones') {
      const hoursElapsed = (Date.now() - new Date(missionData.lastSeenAt).getTime()) / (1000 * 60 * 60);
      const zones = predictLocationZones(
        {
          lat: missionData.lastSeenLatitude,
          lng: missionData.lastSeenLongitude,
        },
        missionData.sightings?.map(s => ({
          latitude: s.latitude,
          longitude: s.longitude,
          sightedAt: s.sightedAt,
        })),
        missionData.petSpecies,
        hoursElapsed
      );
      response.locationZones = zones;
    }

    // Similar cases (for pattern matching)
    if (analysisType === 'full' || analysisType === 'similar') {
      const historicalCases = await prisma.case.findMany({
        where: {
          status: 'REUNITED',
          petSpecies: missionData.petSpecies,
          id: { not: missionId },
        },
        take: 100,
        select: {
          id: true,
          petSpecies: true,
          petSize: true,
          city: true,
          createdAt: true,
          status: true,
          reunionDate: true,
        },
      });

      // Calculate days to reunion for historical cases
      const casesWithDays = historicalCases.map(c => ({
        ...c,
        daysToReunion: c.reunionDate
          ? Math.ceil((new Date(c.reunionDate) - new Date(c.createdAt)) / (1000 * 60 * 60 * 24))
          : null,
      }));

      const similarCases = findSimilarCases(
        {
          petSpecies: missionData.petSpecies,
          petSize: missionData.petSize,
          city: missionData.city,
        },
        casesWithDays
      );

      response.similarCases = {
        matches: similarCases,
        averageDaysToReunion: similarCases
          .filter(s => s.daysToReunion)
          .reduce((sum, s, _, arr) => sum + s.daysToReunion / arr.length, 0) || null,
        successRate: similarCases.length > 0
          ? similarCases.filter(s => s.wasFound).length / similarCases.length
          : null,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      { error: 'Failed to generate predictions' },
      { status: 500 }
    );
  }
}
