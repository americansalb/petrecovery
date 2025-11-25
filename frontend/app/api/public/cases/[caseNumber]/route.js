// /api/public/cases/[caseNumber]/route.js
// Public API for viewing case details

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/app/lib/logging';

/**
 * GET /api/public/cases/[caseNumber]
 * Get public case details
 */
export async function GET(request, { params }) {
  const { caseNumber } = params;

  try {
    const caseData = await prisma.case.findFirst({
      where: {
        caseNumber,
        isPublic: true,
      },
      select: {
        id: true,
        caseNumber: true,
        petName: true,
        petSpecies: true,
        petBreed: true,
        petColor: true,
        petSize: true,
        petPhotoUrl: true,
        petDescription: true,
        lastSeenAt: true,
        lastSeenAddress: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
        escapeScenario: true,
        escapeDetails: true,
        status: true,
        hasReward: true,
        rewardAmount: true,
        publicContactOk: true,
        publicPhoneVisible: true,
        publicEmailVisible: true,
        ownerName: true,
        ownerPhone: true,
        ownerEmail: true,
        createdAt: true,
        viewCount: true,
        sightings: {
          select: {
            id: true,
            address: true,
            sightedAt: true,
            certaintyLevel: true,
            description: true,
            isVerified: true,
          },
          orderBy: { sightedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!caseData) {
      logEvent('public_case.detail_not_found', { caseNumber });
      return NextResponse.json(
        { error: 'Case not found or not public' },
        { status: 404 }
      );
    }

    // Increment view count (non-blocking)
    prisma.case.update({
      where: { id: caseData.id },
      data: { viewCount: { increment: 1 } },
    }).catch(console.error);

    // Apply privacy rules
    const response = {
      caseNumber: caseData.caseNumber,
      petName: caseData.petName,
      petSpecies: caseData.petSpecies,
      petBreed: caseData.petBreed,
      petColor: caseData.petColor,
      petSize: caseData.petSize,
      petPhotoUrl: caseData.petPhotoUrl,
      petDescription: caseData.petDescription,
      lastSeenAt: caseData.lastSeenAt,
      lastSeenAddress: caseData.lastSeenAddress,
      lastSeenLatitude: caseData.lastSeenLatitude,
      lastSeenLongitude: caseData.lastSeenLongitude,
      escapeScenario: caseData.escapeScenario,
      escapeDetails: caseData.escapeDetails,
      status: caseData.status,
      hasReward: caseData.hasReward,
      rewardAmount: caseData.hasReward ? caseData.rewardAmount : null,
      publicContactOk: caseData.publicContactOk,
      ownerFirstName: caseData.ownerName?.split(' ')[0] || 'Owner',
      ownerPhone: caseData.publicPhoneVisible ? caseData.ownerPhone : null,
      ownerEmail: caseData.publicEmailVisible ? caseData.ownerEmail : null,
      createdAt: caseData.createdAt,
      viewCount: caseData.viewCount,
      sightings: caseData.sightings.map(s => ({
        id: s.id,
        address: s.address,
        sightedAt: s.sightedAt,
        certaintyLevel: s.certaintyLevel,
        isVerified: s.isVerified,
      })),
    };

    logEvent('public_case.detail_viewed', { caseNumber });

    return NextResponse.json(response);
  } catch (error) {
    logEvent('public_case.detail_failed', { caseNumber, error: error.message });
    console.error('Public case detail error:', error);
    return NextResponse.json(
      { error: 'Failed to load case' },
      { status: 500 }
    );
  }
}
