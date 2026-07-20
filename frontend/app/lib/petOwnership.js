/**
 * Shared auth guards for pet-scoped API routes.
 *
 * Access levels (low → high): VIEWER < CAREGIVER < OWNER.
 *  - OWNER:     the Pet.ownerId user — everything, incl. sharing + pet edit
 *  - CAREGIVER: shared user — view pet, manage + log medications
 *  - VIEWER:    shared user — read-only
 *
 * Shelter accounts: when a pet sits on a shelter roster
 * (managedByShelterId), anyone who manages that shelter (claimer or
 * ACTIVE ShelterMember) gets OWNER access. Pet.ownerId stays whoever
 * created the record; authority flows through the shelter. Adoption
 * transfer clears the roster tag, which severs staff access at once.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { userManagesShelter } from '@/app/lib/shelterAuth';

const LEVELS = { VIEWER: 1, CAREGIVER: 2, OWNER: 3 };

/**
 * Resolve the session user's access to a pet.
 * Returns { user, pet, access } on success (access ∈ OWNER|CAREGIVER|VIEWER),
 * or { error, status } to bubble up.
 */
export async function requirePetAccess(petId, minAccess = 'VIEWER') {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: 'Unauthorized', status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true },
  });
  if (!user) {
    return { error: 'User not found', status: 404 };
  }

  const pet = await prisma.pet.findUnique({
    where: { id: petId, isDeleted: false },
    select: { id: true, ownerId: true, name: true, species: true, primaryPhotoUrl: true, managedByShelterId: true },
  });
  if (!pet) {
    return { error: 'Pet not found', status: 404 };
  }

  let access = null;
  if (pet.ownerId === user.id) {
    access = 'OWNER';
  } else if (
    pet.managedByShelterId &&
    (await userManagesShelter(user.id, user.email, pet.managedByShelterId))
  ) {
    // Shelter staff get full authority over roster animals
    access = 'OWNER';
  } else {
    // Match by linked userId or by email (covers invites accepted pre-link)
    const share = await prisma.petShare.findFirst({
      where: {
        petId,
        status: 'ACTIVE',
        OR: [{ userId: user.id }, { email: user.email }],
      },
      select: { role: true },
    });
    if (share) access = share.role; // CAREGIVER | VIEWER
  }

  // 404 (not 403) for strangers so pet ids aren't probeable.
  if (!access) {
    return { error: 'Pet not found', status: 404 };
  }
  if (LEVELS[access] < LEVELS[minAccess]) {
    return { error: 'You don\'t have permission to do that for this pet', status: 403 };
  }

  return { user, pet, access };
}

/**
 * Owner-only guard (pet edit/delete, sharing management).
 * Kept as the strict variant of requirePetAccess.
 */
export async function requirePetOwner(petId) {
  return requirePetAccess(petId, 'OWNER');
}
