import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { calculateMatchScore } from '@/app/lib/matching';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const report = await prisma.case.findUnique({
      where: { id },
      include: {
        pet: true,
        reporter: {
          select: {
            id: true,
            firstName: true,
            email: true,
            phone: true,
          }
        },
        sightings: {
          include: {
            reportedBy: {
              select: {
                firstName: true,
              }
            }
          },
          orderBy: {
            sightedAt: 'desc',
          }
        },
        missionControl: true,
        assignments: {
          where: {
            status: { in: ['ACCEPTED', 'ACTIVE'] }
          },
          include: {
            rescueSquad: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              }
            }
          }
        }
      }
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const session = await getServerSession(authOptions);
    const isOwner = session?.user?.email === report.reporter.email;

    // Parse photos from pet if available, or use denormalized petPhotoUrl
    let photos = [];
    if (report.pet?.photos) {
      try {
        photos = JSON.parse(report.pet.photos || '[]');
      } catch (e) {
        photos = [];
      }
    }
    if (photos.length === 0 && report.petPhotoUrl) {
      photos = [report.petPhotoUrl];
    }

    // If this is a FOUND pet, surface potential matches (open LOST cases).
    // PII-broker contract (relay-connect-spec §6): this payload may be read by an
    // unauthenticated viewer, so it must NOT contain owner name/phone/email, the
    // exact last-seen address, or raw coordinates — only pet fields, a coarse
    // area, and the calibrated confidence. Contact is brokered separately.
    let potentialMatches = [];
    if (report.reportType === 'FOUND') {
      const lostCases = await prisma.case.findMany({
        where: {
          status: 'ACTIVE',
          reportType: 'LOST',
        },
      });

      potentialMatches = lostCases
        .map(lostCase => ({ lostCase, match: calculateMatchScore(report, lostCase) }))
        // Gate out low-confidence matches (calibration-proof via band, not a raw cutoff).
        .filter(({ match }) => match.band !== 'suppress')
        .sort((a, b) => b.match.pTrueMatch - a.match.pTrueMatch)
        .slice(0, 5)
        .map(({ lostCase, match }) => ({
          // lostCase.id is an opaque case handle, not owner PII. matchId/relay
          // handle + canConnect action arrive with the MatchConnection model.
          id: lostCase.id,
          petName: lostCase.petName,
          species: lostCase.petSpecies,
          breed: lostCase.petBreed,
          color: lostCase.petColor,
          size: lostCase.petSize,
          primaryPhotoUrl: lostCase.petPhotoUrl,
          coarseArea: coarseArea(lostCase.lastSeenAddress, match.details?.distance),
          pTrueMatch: match.pTrueMatch,
          matchSource: match.matchSource,
          band: match.band,
          canConnect: match.band === 'actionable',
          // owner name / phone / email, exact address, and raw coords omitted.
        }));
    }

    return NextResponse.json({
      report: {
        id: report.id,
        caseNumber: report.caseNumber,
        reportType: report.reportType,
        status: report.status,
        lastSeenAt: report.lastSeenAt,
        lastSeenAddress: report.lastSeenAddress,
        lastSeenLatitude: report.lastSeenLatitude,
        lastSeenLongitude: report.lastSeenLongitude,
        searchRadius: report.searchRadius,
        hasReward: report.hasReward,
        rewardAmount: report.rewardAmount,
        createdAt: report.createdAt,
        escapeScenario: report.escapeScenario,
        escapeDetails: report.escapeDetails,
      },
      pet: {
        id: report.pet?.id || report.id,
        name: report.petName,
        species: report.petSpecies,
        breed: report.petBreed,
        color: report.petColor,
        size: report.petSize,
        distinctiveMarks: report.pet?.distinctiveMarks || null,
        description: report.petDescription,
        photos: photos,
        primaryPhotoUrl: report.petPhotoUrl,
      },
      reporter: isOwner ? {
        firstName: report.ownerName || report.reporter.firstName,
        email: report.ownerEmail || report.reporter.email,
        phone: report.ownerPhone || report.reporter.phone,
      } : {
        firstName: report.ownerName || report.reporter.firstName,
        // Don't expose full contact info to non-owners
      },
      sightings: report.sightings.map(s => ({
        id: s.id,
        sightedAt: s.sightedAt,
        address: s.address,
        description: s.description,
        certaintyLevel: s.certaintyLevel,
        reportedBy: s.reportedBy.firstName,
        latitude: s.latitude,
        longitude: s.longitude,
        isVerified: s.isVerified,
      })),
      potentialMatches, // Empty array for LOST pets, populated for FOUND pets
      isOwner,
      missionControl: report.missionControl,
      rescueSquads: report.assignments?.map(a => ({
        id: a.rescueSquad.id,
        name: a.rescueSquad.name,
        logoUrl: a.rescueSquad.logoUrl,
        status: a.status,
      })) || [],
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Build a privacy-preserving coarse area string for a match.
 * Drops the street-level segment of the address (everything before the first
 * comma) and buckets distance, so we never expose the exact missing location
 * (typically near the owner's home) to an unauthenticated viewer.
 */
function coarseArea(address, distanceMiles) {
  let region = 'Nearby area';
  if (typeof address === 'string' && address.includes(',')) {
    // Keep only the city/region portion after the street segment.
    const rest = address.split(',').slice(1).join(',').trim();
    if (rest) region = rest;
  }

  let proximity = '';
  if (typeof distanceMiles === 'number' && Number.isFinite(distanceMiles)) {
    const bucket =
      distanceMiles <= 1 ? '~1 mi' :
      distanceMiles <= 3 ? '~3 mi' :
      distanceMiles <= 6 ? '~6 mi' : '~10+ mi';
    proximity = ` · within ${bucket}`;
  }

  return `${region}${proximity}`;
}
