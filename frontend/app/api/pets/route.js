/**
 * Pet API Routes - Phase 1.3
 *
 * GET /api/pets - List user's pets
 * POST /api/pets - Create new pet
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { isIntakeType } from '@/app/lib/shelterStatuses';
import { enqueueStrayIntakeMatch } from '@/app/lib/shelterMatching';
import { userManagesShelter } from '@/app/lib/shelterAuth';

// GET /api/pets - List user's pets
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const caseInclude = {
      cases: {
        select: {
          id: true,
          caseNumber: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    };

    // Own pets + pets shared with me + invites awaiting my response, in one trip.
    //
    // `managedByShelterId: null` is what keeps the hats apart. A shelter's
    // roster animals carry the claimer's user id in ownerId (they created the
    // record), but they are the SHELTER's animals and live in the shelter
    // portal, not in this person's pet list. Adoption clears the field (see
    // api/pets/transfer/[token]), so an adopted animal correctly reappears
    // here as the adopter's own pet.
    const [pets, myShares] = await Promise.all([
      prisma.pet.findMany({
        where: { ownerId: user.id, isDeleted: false, managedByShelterId: null },
        orderBy: { createdAt: 'desc' },
        include: caseInclude,
      }),
      prisma.petShare.findMany({
        where: {
          OR: [{ userId: user.id }, { email: user.email }],
          pet: { isDeleted: false },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          pet: { include: caseInclude },
          invitedBy: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const parsePet = (pet) => ({
      ...pet,
      photos: JSON.parse(pet.photos || '[]'),
      personality: JSON.parse(pet.personality || '[]'),
    });

    const shareView = (share) => ({
      shareId: share.id,
      role: share.role,
      ownerName: [share.invitedBy?.firstName, share.invitedBy?.lastName].filter(Boolean).join(' ') || 'A pet owner',
      pet: parsePet(share.pet),
    });

    return NextResponse.json({
      pets: pets.map(parsePet),
      sharedPets: myShares.filter((s) => s.status === 'ACTIVE').map(shareView),
      pendingInvites: myShares.filter((s) => s.status === 'PENDING').map(shareView),
    });
  } catch (error) {
    console.error('[PETS API] Error fetching pets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pets' },
      { status: 500 }
    );
  }
}

// POST /api/pets - Create new pet
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      species,
      breed,
      age,
      sex,
      isNeutered,
      color,
      size,
      weight,
      distinctiveMarks,
      microchipId,
      collarInfo,
      personality,
      medicalConditions,
      photos,
      primaryPhotoUrl,
      shelterId,
      intakeDate,
      intakeType,
      intakeFoundAddress,
      intakeFoundLatitude,
      intakeFoundLongitude,
    } = body;

    // Validation
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Pet name is required' }, { status: 400 });
    }
    if (!species) {
      return NextResponse.json({ error: 'Species is required' }, { status: 400 });
    }
    if (!color?.trim()) {
      return NextResponse.json({ error: 'Color is required' }, { status: 400 });
    }
    if (!size) {
      return NextResponse.json({ error: 'Size is required' }, { status: 400 });
    }

    // Valid enum values
    const validSpecies = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'];
    const validSizes = ['TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT'];
    const validSex = ['MALE', 'FEMALE', 'UNKNOWN'];

    if (!validSpecies.includes(species)) {
      return NextResponse.json({ error: 'Invalid species' }, { status: 400 });
    }
    if (!validSizes.includes(size)) {
      return NextResponse.json({ error: 'Invalid size' }, { status: 400 });
    }
    if (sex && !validSex.includes(sex)) {
      return NextResponse.json({ error: 'Invalid sex' }, { status: 400 });
    }

    // Shelter accounts: whoever manages the shelter (claimer or ACTIVE
    // staff member) may tag the record onto its roster; anyone else gets
    // a 403, so rosters can't be polluted by strangers.
    let managedByShelterId = null;
    // Intake details ride along only on shelter creates; personal pets
    // never carry them (fields silently ignored without shelterId).
    let intake = {};
    if (shelterId) {
      const manages = await userManagesShelter(user.id, session.user.email, shelterId);
      if (!manages) {
        return NextResponse.json(
          { error: 'You don\'t manage that shelter' },
          { status: 403 }
        );
      }
      managedByShelterId = shelterId;

      if (intakeType && !isIntakeType(intakeType)) {
        return NextResponse.json({ error: 'Invalid intake type' }, { status: 400 });
      }
      const parsedIntakeDate = intakeDate ? new Date(intakeDate) : new Date();
      const lat = parseFloat(intakeFoundLatitude);
      const lng = parseFloat(intakeFoundLongitude);
      intake = {
        shelterStatus: 'AVAILABLE',
        intakeDate: Number.isNaN(parsedIntakeDate.getTime()) ? new Date() : parsedIntakeDate,
        intakeType: intakeType || null,
        intakeFoundAddress: intakeFoundAddress?.trim() || null,
        intakeFoundLatitude: Number.isFinite(lat) ? lat : null,
        intakeFoundLongitude: Number.isFinite(lng) ? lng : null,
      };
    }

    // Create pet
    const pet = await prisma.pet.create({
      data: {
        ownerId: user.id,
        managedByShelterId,
        ...intake,
        name: name.trim(),
        species,
        breed: breed?.trim() || null,
        age: age ? parseInt(age) : null,
        sex: sex || null,
        isNeutered: isNeutered || false,
        color: color.trim(),
        size,
        weight: weight ? parseFloat(weight) : null,
        distinctiveMarks: distinctiveMarks?.trim() || null,
        microchipId: microchipId?.trim() || null,
        collarInfo: collarInfo?.trim() || null,
        personality: JSON.stringify(personality || []),
        medicalConditions: medicalConditions?.trim() || null,
        photos: JSON.stringify(photos || []),
        primaryPhotoUrl: primaryPhotoUrl || (photos?.[0] || ''),
      }
    });

    // A new stray on a shelter roster kicks off matching against open
    // lost reports, post-response; the create never waits on it.
    if (pet.managedByShelterId && pet.intakeType === 'STRAY') {
      enqueueStrayIntakeMatch(pet.id);
    }

    // Fire-and-forget: logging must never fail the request.
    logEvent({
      event_type: 'pet.created',
      resource_type: 'pet',
      resource_id: pet.id,
      action: 'create',
      result: 'success',
      actor_user_id: user.id,
      metadata: {
        petName: pet.name,
        species: pet.species,
      }
    }).catch(() => {});

    return NextResponse.json({
      pet: {
        ...pet,
        photos: JSON.parse(pet.photos),
        personality: JSON.parse(pet.personality),
      },
      message: 'Pet profile created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('[PETS API] Error creating pet:', error);
    return NextResponse.json(
      { error: 'Failed to create pet profile' },
      { status: 500 }
    );
  }
}
