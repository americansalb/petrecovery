/**
 * Shared auth guard for pet-scoped API routes (medications, etc.).
 * Resolves the session user and verifies they own the pet.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * Returns { user, pet } on success, or { error, status } to bubble up.
 */
export async function requirePetOwner(petId) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: 'Unauthorized', status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return { error: 'User not found', status: 404 };
  }

  const pet = await prisma.pet.findUnique({
    where: { id: petId, isDeleted: false },
    select: { id: true, ownerId: true, name: true, species: true, primaryPhotoUrl: true },
  });
  if (!pet) {
    return { error: 'Pet not found', status: 404 };
  }
  if (pet.ownerId !== user.id) {
    return { error: 'Unauthorized', status: 403 };
  }

  return { user, pet };
}
