/**
 * Unified Shelter API
 *
 * Aggregates data from multiple shelter APIs:
 * - Apple MapKit (Primary - 250K free calls/day)
 * - PetFinder (Enrichment - FREE)
 * - RescueGroups (Backup)
 */

import * as petfinder from './petfinder';
import * as rescuegroups from './rescuegroups';
import * as appleMapKit from './appleMapKit';
import prisma from '@/app/lib/prisma';

/**
 * Search animals across all configured APIs
 */
export async function searchAllAnimals(params) {
  const results = await Promise.allSettled([
    petfinder.searchAnimals(params).catch(() => ({ animals: [] })),
    rescuegroups.searchAnimals(params).catch(() => ({ animals: [] })),
  ]);

  const allAnimals = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.animals) {
      allAnimals.push(...result.value.animals);
    }
  }

  // Deduplicate by name and location (simple heuristic)
  const seen = new Set();
  const unique = allAnimals.filter((animal) => {
    const key = `${animal.name}-${animal.location?.city}-${animal.species}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}

/**
 * Search organizations across all APIs
 */
export async function searchAllOrganizations(params) {
  const results = await Promise.allSettled([
    petfinder.searchOrganizations(params).catch(() => ({ organizations: [] })),
    rescuegroups.searchOrganizations(params).catch(() => ({ organizations: [] })),
  ]);

  const allOrgs = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.organizations) {
      allOrgs.push(...result.value.organizations);
    }
  }

  // Deduplicate by name
  const seen = new Set();
  return allOrgs.filter((org) => {
    const key = org.name?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Find potential matches for a lost pet across all sources
 */
export async function findPotentialMatches(lostPet, location, radiusMiles = 50) {
  const results = await Promise.allSettled([
    petfinder.findPotentialMatches(lostPet, location, radiusMiles),
    rescuegroups.findPotentialMatches(lostPet, location, radiusMiles),
  ]);

  const allMatches = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allMatches.push(...result.value);
    }
  }

  // Sort by match score
  return allMatches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 20);
}

/**
 * Sync shelter data to local database
 */
export async function syncSheltersNearLocation(location, radiusMiles = 100) {
  const organizations = await searchAllOrganizations({ location, distance: radiusMiles });

  let created = 0;
  let updated = 0;

  for (const org of organizations) {
    try {
      const existing = await prisma.shelter.findFirst({
        where: {
          OR: [
            { name: org.name },
            { apiEndpoint: org.externalId },
          ],
        },
      });

      if (existing) {
        await prisma.shelter.update({
          where: { id: existing.id },
          data: {
            name: org.name,
            email: org.email,
            phone: org.phone,
            website: org.website,
            address: org.address?.street,
            city: org.address?.city,
            state: org.address?.state,
            zipCode: org.address?.postcode,
            apiType: org.source.toUpperCase(),
            apiEndpoint: org.externalId,
            lastSyncAt: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.shelter.create({
          data: {
            name: org.name,
            email: org.email,
            phone: org.phone,
            website: org.website,
            address: org.address?.street || '',
            city: org.address?.city || '',
            state: org.address?.state || '',
            zipCode: org.address?.postcode || '',
            type: org.isShelter ? 'SHELTER' : org.isRescue ? 'RESCUE' : 'SHELTER',
            apiType: org.source.toUpperCase(),
            apiEndpoint: org.externalId,
            lastSyncAt: new Date(),
          },
        });
        created++;
      }
    } catch (error) {
      console.error(`Error syncing shelter ${org.name}:`, error);
    }
  }

  return { created, updated, total: organizations.length };
}

/**
 * Sync found animals from shelters
 */
export async function syncFoundAnimals(location, radiusMiles = 50) {
  const animals = await searchAllAnimals({
    location,
    distance: radiusMiles,
    status: 'found',
    limit: 100,
  });

  let synced = 0;

  for (const animal of animals) {
    try {
      // Check if we already have this intake
      const existing = await prisma.shelterIntake.findFirst({
        where: {
          externalId: animal.externalId,
          shelter: {
            apiType: animal.source.toUpperCase(),
          },
        },
      });

      if (existing) continue;

      // Find or create shelter
      let shelter = await prisma.shelter.findFirst({
        where: {
          apiEndpoint: animal.organizationId || animal.organization?.id,
        },
      });

      if (!shelter) {
        shelter = await prisma.shelter.create({
          data: {
            name: animal.organization?.name || 'Unknown Shelter',
            address: '',
            city: animal.location?.city || '',
            state: animal.location?.state || '',
            zipCode: animal.location?.postcode || '',
            apiType: animal.source.toUpperCase(),
            apiEndpoint: animal.organizationId || animal.organization?.id,
          },
        });
      }

      // Create intake record
      await prisma.shelterIntake.create({
        data: {
          shelterId: shelter.id,
          externalId: animal.externalId,
          species: animal.species || 'unknown',
          breed: animal.breed,
          color: animal.color,
          size: animal.size,
          name: animal.name,
          description: animal.description,
          photoUrls: JSON.stringify(animal.photos || []),
          intakeDate: animal.publishedAt ? new Date(animal.publishedAt) : new Date(),
          intakeType: 'STRAY',
          status: 'AVAILABLE',
        },
      });

      synced++;
    } catch (error) {
      console.error(`Error syncing animal ${animal.name}:`, error);
    }
  }

  return { synced, total: animals.length };
}

/**
 * Match shelter intakes with active cases
 */
export async function matchIntakesWithCases() {
  // Get recent unmatched intakes
  const intakes = await prisma.shelterIntake.findMany({
    where: {
      matchedCaseId: null,
      status: 'AVAILABLE',
      intakeDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: { shelter: true },
  });

  // Get active cases
  const cases = await prisma.case.findMany({
    where: {
      status: { in: ['ACTIVE', 'IN_PROGRESS'] },
    },
  });

  const matches = [];

  for (const intake of intakes) {
    for (const lostCase of cases) {
      const score = calculateMatchScore(lostCase, intake);

      if (score > 0.5) {
        matches.push({
          intakeId: intake.id,
          caseId: lostCase.id,
          caseNumber: lostCase.caseNumber,
          score,
          intake,
          case: lostCase,
        });
      }
    }
  }

  // Sort by score and return top matches
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Calculate match score between case and intake
 */
function calculateMatchScore(lostCase, intake) {
  let score = 0;

  // Species match (required)
  if (lostCase.petSpecies?.toLowerCase() !== intake.species?.toLowerCase()) {
    return 0;
  }
  score += 0.25;

  // Breed match
  if (lostCase.petBreed && intake.breed) {
    if (lostCase.petBreed.toLowerCase() === intake.breed.toLowerCase()) {
      score += 0.2;
    } else if (intake.breed.toLowerCase().includes(lostCase.petBreed.toLowerCase())) {
      score += 0.1;
    }
  }

  // Color match
  if (lostCase.petColor && intake.color) {
    const caseColors = lostCase.petColor.toLowerCase().split(/[,\s]+/);
    const intakeColors = intake.color.toLowerCase().split(/[,\s]+/);

    if (caseColors.some((c) => intakeColors.includes(c))) {
      score += 0.2;
    }
  }

  // Size match
  if (lostCase.petSize && intake.size) {
    if (lostCase.petSize.toLowerCase() === intake.size.toLowerCase()) {
      score += 0.15;
    }
  }

  // Location proximity (if we have shelter location)
  if (intake.shelter?.latitude && intake.shelter?.longitude &&
      lostCase.lastSeenLatitude && lostCase.lastSeenLongitude) {
    const distance = calculateDistance(
      lostCase.lastSeenLatitude,
      lostCase.lastSeenLongitude,
      intake.shelter.latitude,
      intake.shelter.longitude
    );

    if (distance < 10) score += 0.2;
    else if (distance < 25) score += 0.1;
  }

  return Math.min(score, 1);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Search and save shelters for a city using Apple MapKit
 */
export async function fetchAndSaveSheltersForCity(city, state) {
  if (!appleMapKit.isConfigured()) {
    throw new Error('Apple MapKit not configured. Set APPLE_MAPKIT_TEAM_ID, APPLE_MAPKIT_KEY_ID, and APPLE_MAPKIT_PRIVATE_KEY.');
  }

  // Fetch shelters from Apple MapKit
  const shelters = await appleMapKit.searchSheltersInCity(city, state);

  // Save to database
  const results = await appleMapKit.saveSheltersToDatabase(shelters);

  return {
    ...results,
    total: shelters.length,
    city,
    state,
  };
}

/**
 * Get shelters near a location from database
 */
export async function getSheltersNearLocation(latitude, longitude, radiusMiles = 25) {
  // Simple bounding box query (more efficient than Haversine in SQL)
  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / (69 * Math.cos(latitude * Math.PI / 180));

  const shelters = await prisma.shelter.findMany({
    where: {
      isActive: true,
      latitude: {
        gte: latitude - latDelta,
        lte: latitude + latDelta,
      },
      longitude: {
        gte: longitude - lngDelta,
        lte: longitude + lngDelta,
      },
    },
    orderBy: { name: 'asc' },
  });

  // Calculate actual distances and filter
  return shelters
    .map(s => ({
      ...s,
      distance: calculateDistance(latitude, longitude, s.latitude, s.longitude),
    }))
    .filter(s => s.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance);
}

export { petfinder, rescuegroups, appleMapKit };
