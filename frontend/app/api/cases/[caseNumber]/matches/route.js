/**
 * Case Matches API - Phase 1.4
 *
 * GET /api/cases/[caseNumber]/matches - Find potential matches for a case
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/db';
import { findMatches, getMatchQuality } from '@/app/lib/matching';

export async function GET(request, { params }) {
  try {
    const { caseNumber } = await params;

    // Find the target case
    const targetCase = await prisma.lostPetCase.findUnique({
      where: { caseNumber },
    });

    if (!targetCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Determine if this is a lost or found case
    const isLost = targetCase.reportType !== 'FOUND';
    const oppositeType = isLost ? 'FOUND' : { in: ['LOST', null] };

    // Find candidate cases (opposite type)
    const candidates = await prisma.lostPetCase.findMany({
      where: {
        id: { not: targetCase.id },
        reportType: oppositeType,
        status: { in: ['OPEN', 'ACTIVE_SEARCH'] },
        petSpecies: targetCase.petSpecies, // Pre-filter by species for efficiency
      },
      select: {
        id: true,
        caseNumber: true,
        reportType: true,
        petName: true,
        petSpecies: true,
        petBreed: true,
        petColor: true,
        petDescription: true,
        city: true,
        state: true,
        zipCode: true,
        lastSeenAt: true,
        lastSeenLandmark: true,
        latitude: true,
        longitude: true,
        photoUrls: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        publicContactOk: true,
        createdAt: true,
      }
    });

    // Calculate matches
    const targetData = {
      petSpecies: targetCase.petSpecies,
      petBreed: targetCase.petBreed,
      petColor: targetCase.petColor,
      city: targetCase.city,
      state: targetCase.state,
      latitude: targetCase.latitude,
      longitude: targetCase.longitude,
      lastSeenAt: targetCase.lastSeenAt,
      createdAt: targetCase.createdAt,
    };

    const matches = findMatches(targetData, candidates, {
      minScore: 30, // Lower threshold for display
      maxResults: 10,
    });

    // Format response
    const formattedMatches = matches.map(match => {
      const quality = getMatchQuality(match.score);
      const c = match.case;

      return {
        caseNumber: c.caseNumber,
        reportType: c.reportType || 'LOST',
        petName: c.petName,
        petSpecies: c.petSpecies,
        petBreed: c.petBreed,
        petColor: c.petColor,
        petDescription: c.petDescription,
        city: c.city,
        state: c.state,
        lastSeenAt: c.lastSeenAt,
        lastSeenLandmark: c.lastSeenLandmark,
        photoUrls: JSON.parse(c.photoUrls || '[]'),
        createdAt: c.createdAt,
        // Contact info (only if public contact is ok)
        contact: c.publicContactOk ? {
          name: c.contactName,
          email: c.contactEmail,
          phone: c.contactPhone,
        } : null,
        // Match details
        matchScore: match.score,
        matchQuality: quality,
        matchDetails: {
          speciesMatch: match.details.speciesMatch,
          distance: match.details.distance,
          breedSimilarity: match.details.breedSimilarity,
          colorSimilarity: match.details.colorSimilarity,
          daysBetween: match.details.daysBetween,
          scores: match.details.scores,
        },
      };
    });

    return NextResponse.json({
      caseNumber,
      reportType: targetCase.reportType || 'LOST',
      totalMatches: formattedMatches.length,
      matches: formattedMatches,
    });
  } catch (error) {
    console.error('[MATCHES API] Error finding matches:', error);
    return NextResponse.json(
      { error: 'Failed to find matches' },
      { status: 500 }
    );
  }
}
