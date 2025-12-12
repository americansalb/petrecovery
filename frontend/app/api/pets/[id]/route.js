/**
 * Pet Detail API Routes - Phase 1.3
 *
 * GET /api/pets/[id] - Get pet details
 * PATCH /api/pets/[id] - Update pet
 * DELETE /api/pets/[id] - Delete pet
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// GET /api/pets/[id] - Get pet details
export async function GET(request, { params }) {
  try {
    const session = await getServerSession();

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

    const { id } = await params;

    const pet = await prisma.pet.findUnique({
      where: { id, isDeleted: false },
      include: {
        cases: {
          select: {
            id: true,
            caseNumber: true,
            status: true,
            createdAt: true,
            resolvedAt: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    // Check ownership
    if (pet.ownerId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
      pet: {
        ...pet,
        photos: JSON.parse(pet.photos || '[]'),
        personality: JSON.parse(pet.personality || '[]'),
      }
    });
  } catch (error) {
    console.error('[PETS API] Error fetching pet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pet' },
      { status: 500 }
    );
  }
}

// PATCH /api/pets/[id] - Update pet
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession();

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

    const { id } = await params;

    const existingPet = await prisma.pet.findUnique({
      where: { id, isDeleted: false }
    });

    if (!existingPet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    if (existingPet.ownerId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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

    // Build update data (only include provided fields)
    const updateData = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: 'Pet name is required' }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (species !== undefined) {
      const validSpecies = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'];
      if (!validSpecies.includes(species)) {
        return NextResponse.json({ error: 'Invalid species' }, { status: 400 });
      }
      updateData.species = species;
    }

    if (color !== undefined) {
      if (!color.trim()) {
        return NextResponse.json({ error: 'Color is required' }, { status: 400 });
      }
      updateData.color = color.trim();
    }

    if (size !== undefined) {
      const validSizes = ['TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT'];
      if (!validSizes.includes(size)) {
        return NextResponse.json({ error: 'Invalid size' }, { status: 400 });
      }
      updateData.size = size;
    }

    if (sex !== undefined) {
      const validSex = ['MALE', 'FEMALE', 'UNKNOWN', null];
      if (sex && !['MALE', 'FEMALE', 'UNKNOWN'].includes(sex)) {
        return NextResponse.json({ error: 'Invalid sex' }, { status: 400 });
      }
      updateData.sex = sex || null;
    }

    if (breed !== undefined) updateData.breed = breed?.trim() || null;
    if (age !== undefined) updateData.age = age ? parseInt(age) : null;
    if (isNeutered !== undefined) updateData.isNeutered = isNeutered;
    if (weight !== undefined) updateData.weight = weight ? parseFloat(weight) : null;
    if (distinctiveMarks !== undefined) updateData.distinctiveMarks = distinctiveMarks?.trim() || null;
    if (microchipId !== undefined) updateData.microchipId = microchipId?.trim() || null;
    if (collarInfo !== undefined) updateData.collarInfo = collarInfo?.trim() || null;
    if (personality !== undefined) updateData.personality = JSON.stringify(personality || []);
    if (medicalConditions !== undefined) updateData.medicalConditions = medicalConditions?.trim() || null;
    if (photos !== undefined) updateData.photos = JSON.stringify(photos || []);
    if (primaryPhotoUrl !== undefined) updateData.primaryPhotoUrl = primaryPhotoUrl || '';

    const pet = await prisma.pet.update({
      where: { id },
      data: updateData
    });

    await logEvent({
      type: 'PET_UPDATED',
      userId: user.id,
      metadata: {
        petId: pet.id,
        petName: pet.name,
        updatedFields: Object.keys(updateData),
      }
    });

    return NextResponse.json({
      pet: {
        ...pet,
        photos: JSON.parse(pet.photos),
        personality: JSON.parse(pet.personality),
      },
      message: 'Pet profile updated successfully'
    });
  } catch (error) {
    console.error('[PETS API] Error updating pet:', error);
    return NextResponse.json(
      { error: 'Failed to update pet profile' },
      { status: 500 }
    );
  }
}

// DELETE /api/pets/[id] - Delete pet
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession();

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

    const { id } = await params;

    const existingPet = await prisma.pet.findUnique({
      where: { id, isDeleted: false },
      include: {
        cases: {
          where: {
            status: { in: ['OPEN', 'ACTIVE_SEARCH'] }
          }
        }
      }
    });

    if (!existingPet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    if (existingPet.ownerId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check for active cases
    if (existingPet.cases.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete pet with active cases. Please close active cases first.'
      }, { status: 400 });
    }

    // Soft delete - set isDeleted flag instead of hard delete
    await prisma.pet.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      }
    });

    await logEvent({
      type: 'PET_DELETED',
      userId: user.id,
      metadata: {
        petId: id,
        petName: existingPet.name,
        softDelete: true,
      }
    });

    return NextResponse.json({ message: 'Pet profile deleted successfully' });
  } catch (error) {
    console.error('[PETS API] Error deleting pet:', error);
    return NextResponse.json(
      { error: 'Failed to delete pet profile' },
      { status: 500 }
    );
  }
}
