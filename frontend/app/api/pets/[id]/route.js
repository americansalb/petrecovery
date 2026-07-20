/**
 * Pet Detail API Routes - Phase 1.3
 *
 * GET /api/pets/[id] - Get pet details
 * PATCH /api/pets/[id] - Update pet
 * DELETE /api/pets/[id] - Delete pet
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { requirePetAccess } from '@/app/lib/petOwnership';
import { isShelterStatus, isIntakeType } from '@/app/lib/shelterStatuses';
import { enqueueStrayIntakeMatch } from '@/app/lib/shelterMatching';
import { userManagesShelter } from '@/app/lib/shelterAuth';

// GET /api/pets/[id] - Get pet details
// Read access follows the standard tiers (VIEWER < CAREGIVER < OWNER), so a
// care-team member sees the same profile the owner shares with them; without
// this, the shell and Overview render broken for shared pets while the
// anonymous view link works. Writes below stay owner-only.
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const gate = await requirePetAccess(id, 'VIEWER');
    if (gate.error) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

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

    return NextResponse.json({
      access: gate.access,
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

    const { id } = await params;

    const existingPet = await prisma.pet.findUnique({
      where: { id, isDeleted: false }
    });

    if (!existingPet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    // Owner, or shelter staff for roster animals (claimer + ACTIVE members)
    const canEdit =
      existingPet.ownerId === user.id ||
      (existingPet.managedByShelterId &&
        (await userManagesShelter(user.id, user.email, existingPet.managedByShelterId)));
    if (!canEdit) {
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
      vetName,
      vetClinic,
      vetPhone,
      shelterStatus,
      intakeDate,
      intakeType,
      intakeFoundAddress,
      intakeFoundLatitude,
      intakeFoundLongitude,
    } = body;

    // Build update data (only include provided fields)
    const updateData = {};

    // Shelter intake fields: only meaningful on roster animals. Status on a
    // non-managed pet is a caller bug (400); the rest are silently ignored.
    if (shelterStatus !== undefined) {
      if (!existingPet.managedByShelterId) {
        return NextResponse.json(
          { error: 'Only shelter roster animals have a shelter status' },
          { status: 400 }
        );
      }
      if (!isShelterStatus(shelterStatus)) {
        return NextResponse.json({ error: 'Invalid shelter status' }, { status: 400 });
      }
      updateData.shelterStatus = shelterStatus;
    }
    if (existingPet.managedByShelterId) {
      if (intakeType !== undefined) {
        if (intakeType && !isIntakeType(intakeType)) {
          return NextResponse.json({ error: 'Invalid intake type' }, { status: 400 });
        }
        updateData.intakeType = intakeType || null;
      }
      if (intakeDate !== undefined) {
        const parsed = intakeDate ? new Date(intakeDate) : null;
        updateData.intakeDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
      }
      if (intakeFoundAddress !== undefined) {
        updateData.intakeFoundAddress = intakeFoundAddress?.trim() || null;
      }
      if (intakeFoundLatitude !== undefined) {
        const lat = parseFloat(intakeFoundLatitude);
        updateData.intakeFoundLatitude = Number.isFinite(lat) ? lat : null;
      }
      if (intakeFoundLongitude !== undefined) {
        const lng = parseFloat(intakeFoundLongitude);
        updateData.intakeFoundLongitude = Number.isFinite(lng) ? lng : null;
      }
    }

    // Health Book vet card: free-text contact fields, length-capped
    if (vetName !== undefined) updateData.vetName = (vetName || '').trim().slice(0, 80) || null;
    if (vetClinic !== undefined) updateData.vetClinic = (vetClinic || '').trim().slice(0, 80) || null;
    if (vetPhone !== undefined) updateData.vetPhone = (vetPhone || '').trim().slice(0, 30) || null;

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

    // An edit that turns a roster animal into a STRAY intake kicks off
    // matching against open lost reports, post-response.
    if (pet.managedByShelterId && updateData.intakeType === 'STRAY' && existingPet.intakeType !== 'STRAY') {
      enqueueStrayIntakeMatch(pet.id);
    }

    // Fire-and-forget: logging must never fail the request.
    logEvent({
      event_type: 'pet.updated',
      resource_type: 'pet',
      resource_id: pet.id,
      action: 'update',
      result: 'success',
      actor_user_id: user.id,
      metadata: {
        petName: pet.name,
        updatedFields: Object.keys(updateData),
      }
    }).catch(() => {});

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
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { id } = await params;
    const isAdmin = user.role === 'ADMIN';

    const existingPet = await prisma.pet.findUnique({
      where: { id, isDeleted: false },
      include: {
        cases: {
          where: {
            status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] }
          }
        }
      }
    });

    if (!existingPet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    // Check ownership (admins can delete any pet; shelter staff can
    // delete roster animals)
    const canDelete =
      existingPet.ownerId === user.id ||
      isAdmin ||
      (existingPet.managedByShelterId &&
        (await userManagesShelter(user.id, user.email, existingPet.managedByShelterId)));
    if (!canDelete) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check for active cases (admins can bypass this)
    if (existingPet.cases.length > 0 && !isAdmin) {
      return NextResponse.json({
        error: 'Cannot delete pet with active cases. Please close active cases first.'
      }, { status: 400 });
    }

    // If admin is force-deleting a pet with active cases, close those cases first
    if (existingPet.cases.length > 0 && isAdmin) {
      await prisma.case.updateMany({
        where: { petId: id, status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] } },
        data: {
          status: 'CLOSED_OTHER',
          resolution: 'SEARCH_CEASED',
          resolutionNotes: 'Closed by admin when deleting pet',
          resolvedAt: new Date(),
        }
      });
    }

    // Soft delete - set isDeleted flag instead of hard delete
    await prisma.pet.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      }
    });

    // Fire-and-forget: logging must never fail the request.
    logEvent({
      event_type: 'pet.deleted',
      resource_type: 'pet',
      resource_id: id,
      action: 'delete',
      result: 'success',
      actor_user_id: user.id,
      metadata: {
        petName: existingPet.name,
        softDelete: true,
        deletedByAdmin: isAdmin && existingPet.ownerId !== user.id,
      }
    }).catch(() => {});

    return NextResponse.json({ message: 'Pet profile deleted successfully' });
  } catch (error) {
    console.error('[PETS API] Error deleting pet:', error);
    return NextResponse.json(
      { error: 'Failed to delete pet profile' },
      { status: 500 }
    );
  }
}
