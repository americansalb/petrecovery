/**
 * Emergency Response System
 *
 * Special features for natural disasters and mass evacuations
 */

// Emergency status levels
export const EMERGENCY_LEVELS = {
  NORMAL: 'NORMAL',
  WATCH: 'WATCH',       // Potential emergency in area
  WARNING: 'WARNING',   // Emergency imminent
  ACTIVE: 'ACTIVE',     // Active emergency
  RECOVERY: 'RECOVERY', // Post-emergency recovery
};

// Emergency types
export const EMERGENCY_TYPES = {
  WILDFIRE: { name: 'Wildfire', icon: '🔥', color: '#ef4444' },
  HURRICANE: { name: 'Hurricane', icon: '🌀', color: '#3b82f6' },
  FLOOD: { name: 'Flood', icon: '🌊', color: '#0ea5e9' },
  TORNADO: { name: 'Tornado', icon: '🌪️', color: '#6b7280' },
  EARTHQUAKE: { name: 'Earthquake', icon: '🏚️', color: '#78716c' },
  EVACUATION: { name: 'Evacuation', icon: '🚨', color: '#f59e0b' },
  OTHER: { name: 'Other Emergency', icon: '⚠️', color: '#eab308' },
};

/**
 * Activate disaster mode for an area
 */
export async function activateDisasterMode(prisma, options) {
  const {
    type,
    level,
    affectedArea, // GeoJSON polygon or center + radius
    name,
    description,
    startTime,
    estimatedEndTime,
    evacuationRoutes,
    shelterLocations,
    activatedById,
  } = options;

  // Create emergency event
  const emergency = await prisma.emergencyEvent.create({
    data: {
      type,
      level,
      name,
      description,
      affectedArea: JSON.stringify(affectedArea),
      startTime: startTime || new Date(),
      estimatedEndTime,
      evacuationRoutes: evacuationRoutes ? JSON.stringify(evacuationRoutes) : null,
      shelterLocations: shelterLocations ? JSON.stringify(shelterLocations) : null,
      activatedById,
      isActive: true,
    },
  });

  // Find all active cases in affected area
  const affectedCases = await findCasesInArea(prisma, affectedArea);

  // Update cases with emergency flag
  if (affectedCases.length > 0) {
    await prisma.case.updateMany({
      where: {
        id: { in: affectedCases.map(c => c.id) },
      },
      data: {
        emergencyEventId: emergency.id,
        priority: 'URGENT',
      },
    });
  }

  // Notify affected users
  await notifyAffectedUsers(prisma, emergency, affectedCases);

  return {
    emergency,
    affectedCasesCount: affectedCases.length,
  };
}

/**
 * Find cases within an affected area
 */
async function findCasesInArea(prisma, affectedArea) {
  let latMin, latMax, lngMin, lngMax;

  if (affectedArea.center && affectedArea.radius) {
    // Circle area
    const radiusDeg = affectedArea.radius / 69; // miles to degrees
    latMin = affectedArea.center.lat - radiusDeg;
    latMax = affectedArea.center.lat + radiusDeg;
    lngMin = affectedArea.center.lng - radiusDeg;
    lngMax = affectedArea.center.lng + radiusDeg;
  } else if (affectedArea.bounds) {
    // Bounding box
    latMin = affectedArea.bounds.south;
    latMax = affectedArea.bounds.north;
    lngMin = affectedArea.bounds.west;
    lngMax = affectedArea.bounds.east;
  }

  return prisma.case.findMany({
    where: {
      status: { in: ['ACTIVE', 'IN_PROGRESS'] },
      lastSeenLatitude: { gte: latMin, lte: latMax },
      lastSeenLongitude: { gte: lngMin, lte: lngMax },
    },
    select: {
      id: true,
      caseNumber: true,
      petName: true,
      reporterId: true,
    },
  });
}

/**
 * Notify users affected by emergency
 */
async function notifyAffectedUsers(prisma, emergency, affectedCases) {
  const userIds = new Set(affectedCases.map(c => c.reporterId));

  // Also get users who live in the area
  const areaUsers = await prisma.userProfile.findMany({
    where: {
      latitude: { not: null },
      // Similar location filter as cases
    },
    select: { userId: true },
  });

  areaUsers.forEach(u => userIds.add(u.userId));

  // Create notifications
  const notifications = Array.from(userIds).map(userId => ({
    userId,
    type: 'EMERGENCY',
    title: `${EMERGENCY_TYPES[emergency.type]?.icon || '⚠️'} ${emergency.name}`,
    message: emergency.description || `An emergency has been declared in your area.`,
    data: JSON.stringify({ emergencyId: emergency.id }),
    actionUrl: `/emergency/${emergency.id}`,
  }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  return notifications.length;
}

/**
 * Register pet evacuation
 */
export async function registerEvacuation(prisma, options) {
  const {
    emergencyEventId,
    petId,
    ownerId,
    evacuationLocation, // Where pet is being taken
    currentLocation,
    status, // WITH_OWNER, AT_SHELTER, SEPARATED, MISSING
    notes,
    transportMethod,
    contactInfo,
  } = options;

  const evacuation = await prisma.petEvacuation.create({
    data: {
      emergencyEventId,
      petId,
      ownerId,
      evacuationLocation: evacuationLocation ? JSON.stringify(evacuationLocation) : null,
      currentLocation: currentLocation ? JSON.stringify(currentLocation) : null,
      status,
      notes,
      transportMethod,
      contactInfo,
    },
  });

  return evacuation;
}

/**
 * Update evacuation status
 */
export async function updateEvacuationStatus(prisma, evacuationId, updates) {
  const { status, currentLocation, notes } = updates;

  const evacuation = await prisma.petEvacuation.update({
    where: { id: evacuationId },
    data: {
      status,
      currentLocation: currentLocation ? JSON.stringify(currentLocation) : undefined,
      notes,
      updatedAt: new Date(),
    },
  });

  // If pet became separated, create a case
  if (status === 'SEPARATED' || status === 'MISSING') {
    const pet = await prisma.pet.findUnique({
      where: { id: evacuation.petId },
      include: { owner: true },
    });

    if (pet) {
      await prisma.case.create({
        data: {
          petId: pet.id,
          petName: pet.name,
          petSpecies: pet.species,
          petBreed: pet.breed,
          petColor: pet.color,
          petSize: pet.size,
          petPhotoUrl: pet.primaryPhotoUrl,
          petDescription: `Separated during ${evacuation.emergencyEvent?.name || 'emergency'}. ${notes || ''}`,
          reporterId: pet.ownerId,
          ownerName: `${pet.owner.firstName} ${pet.owner.lastName || ''}`,
          ownerPhone: pet.owner.phone || '',
          ownerEmail: pet.owner.email,
          reportType: 'LOST',
          status: 'ACTIVE',
          priority: 'URGENT',
          lastSeenAt: new Date(),
          lastSeenLatitude: currentLocation?.lat,
          lastSeenLongitude: currentLocation?.lng,
          lastSeenAddress: currentLocation?.address || 'Unknown - emergency evacuation',
          emergencyEventId: evacuation.emergencyEventId,
          caseNumber: await generateCaseNumber(prisma),
        },
      });
    }
  }

  return evacuation;
}

/**
 * Find reunification opportunities
 */
export async function findReunificationOpportunities(prisma, emergencyEventId) {
  // Find separated pets
  const separatedPets = await prisma.petEvacuation.findMany({
    where: {
      emergencyEventId,
      status: { in: ['SEPARATED', 'MISSING', 'AT_SHELTER'] },
    },
    include: {
      pet: true,
      owner: true,
    },
  });

  // Find pets at shelters
  const shelterPets = await prisma.shelterIntake.findMany({
    where: {
      intakeDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
    },
    include: {
      shelter: true,
    },
  });

  // Match separated pets with shelter intakes
  const matches = [];

  for (const evacuation of separatedPets) {
    for (const intake of shelterPets) {
      const score = calculateMatchScore(evacuation.pet, intake);
      if (score >= 0.6) {
        matches.push({
          evacuationId: evacuation.id,
          pet: evacuation.pet,
          owner: evacuation.owner,
          intake,
          matchScore: score,
        });
      }
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

function calculateMatchScore(pet, intake) {
  let score = 0;
  let factors = 0;

  // Species
  if (pet.species.toLowerCase() === intake.species?.toLowerCase()) {
    score += 3;
  }
  factors += 3;

  // Breed
  if (pet.breed && intake.breed && pet.breed.toLowerCase() === intake.breed.toLowerCase()) {
    score += 2;
  }
  factors += 2;

  // Color
  if (pet.color && intake.color && pet.color.toLowerCase().includes(intake.color.toLowerCase())) {
    score += 2;
  }
  factors += 2;

  // Size
  if (pet.size === intake.size) {
    score += 1;
  }
  factors += 1;

  return score / factors;
}

/**
 * Get emergency dashboard data
 */
export async function getEmergencyDashboard(prisma, emergencyEventId) {
  const emergency = await prisma.emergencyEvent.findUnique({
    where: { id: emergencyEventId },
  });

  if (!emergency) return null;

  const [evacuations, cases, shelterStats] = await Promise.all([
    prisma.petEvacuation.groupBy({
      by: ['status'],
      where: { emergencyEventId },
      _count: true,
    }),
    prisma.case.count({
      where: { emergencyEventId },
    }),
    prisma.petEvacuation.count({
      where: {
        emergencyEventId,
        status: 'AT_SHELTER',
      },
    }),
  ]);

  const statusCounts = {
    WITH_OWNER: 0,
    AT_SHELTER: 0,
    SEPARATED: 0,
    MISSING: 0,
    REUNITED: 0,
  };

  evacuations.forEach(e => {
    statusCounts[e.status] = e._count;
  });

  return {
    emergency,
    stats: {
      totalEvacuations: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      ...statusCounts,
      activeCases: cases,
    },
    shelterLocations: emergency.shelterLocations ? JSON.parse(emergency.shelterLocations) : [],
    evacuationRoutes: emergency.evacuationRoutes ? JSON.parse(emergency.evacuationRoutes) : [],
  };
}

/**
 * Generate case number
 */
async function generateCaseNumber(prisma) {
  const today = new Date();
  const prefix = `EMG-${today.getFullYear()}`;

  const lastCase = await prisma.case.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
  });

  let sequence = 1;
  if (lastCase) {
    const lastSeq = parseInt(lastCase.caseNumber.split('-').pop(), 10);
    sequence = lastSeq + 1;
  }

  return `${prefix}-${sequence.toString().padStart(5, '0')}`;
}

/**
 * Deactivate emergency mode
 */
export async function deactivateDisasterMode(prisma, emergencyEventId, closureNotes) {
  const emergency = await prisma.emergencyEvent.update({
    where: { id: emergencyEventId },
    data: {
      isActive: false,
      level: EMERGENCY_LEVELS.RECOVERY,
      endTime: new Date(),
      closureNotes,
    },
  });

  // Reset case priorities
  await prisma.case.updateMany({
    where: { emergencyEventId },
    data: { priority: 'NORMAL' },
  });

  return emergency;
}
