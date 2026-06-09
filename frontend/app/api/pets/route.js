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

// GET /api/pets - List user's pets
export async function GET(request) {
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

    const pets = await prisma.pet.findMany({
      where: { ownerId: user.id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
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
      }
    });

    // Parse JSON fields
    const petsWithParsedFields = pets.map(pet => ({
      ...pet,
      photos: JSON.parse(pet.photos || '[]'),
      personality: JSON.parse(pet.personality || '[]'),
    }));

    return NextResponse.json({ pets: petsWithParsedFields });
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

    // Create pet
    const pet = await prisma.pet.create({
      data: {
        ownerId: user.id,
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
