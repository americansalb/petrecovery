import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import {
  generateSightingsHeatmap,
  generateSearchCoverageHeatmap,
  generateProbabilityZones,
  calculateCoverageStats,
} from '@/app/lib/mapping/heatmap';

/**
 * GET /api/mapping/heatmap
 * Get heat map data for a case
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');
    const type = searchParams.get('type') || 'all'; // sightings, coverage, probability, all

    if (!missionId) {
      return NextResponse.json({ error: 'Case ID required' }, { status: 400 });
    }

    // Get case details
    const missionData = await prisma.case.findUnique({
      where: { id: missionId },
      select: {
        id: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
        lastSeenAt: true,
        status: true,
      },
    });

    if (!missionData) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const result = {
      missionId,
      center: {
        lat: missionData.lastSeenLatitude,
        lng: missionData.lastSeenLongitude,
      },
    };

    // Get sightings heat map
    if (type === 'sightings' || type === 'all') {
      const sightings = await prisma.caseSighting.findMany({
        where: { missionId },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          sightedAt: true,
          createdAt: true,
          certaintyLevel: true,
          isVerified: true,
        },
      });

      result.sightings = generateSightingsHeatmap(sightings);
    }

    // Get search coverage heat map
    if (type === 'coverage' || type === 'all') {
      const assignments = await prisma.caseAssignment.findMany({
        where: { missionId },
        select: { id: true },
      });

      const assignmentIds = assignments.map(a => a.id);

      const searchAreas = await prisma.searchArea.findMany({
        where: { assignmentId: { in: assignmentIds } },
        select: {
          id: true,
          geometry: true,
          acreage: true,
          markedAt: true,
        },
      });

      result.coverage = generateSearchCoverageHeatmap(searchAreas);
      result.coverageStats = calculateCoverageStats(searchAreas, 100); // Assuming 100 grid cells
    }

    // Get probability zones
    if (type === 'probability' || type === 'all') {
      const hoursElapsed = (Date.now() - new Date(missionData.lastSeenAt).getTime()) / (1000 * 60 * 60);

      const sightings = await prisma.caseSighting.findMany({
        where: { missionId, isVerified: true },
        select: {
          latitude: true,
          longitude: true,
          sightedAt: true,
          isVerified: true,
        },
        orderBy: { sightedAt: 'desc' },
        take: 10,
      });

      result.probabilityZones = generateProbabilityZones(
        { lat: missionData.lastSeenLatitude, lng: missionData.lastSeenLongitude },
        sightings,
        hoursElapsed
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Heatmap error:', error);
    return NextResponse.json({ error: 'Failed to generate heatmap' }, { status: 500 });
  }
}
