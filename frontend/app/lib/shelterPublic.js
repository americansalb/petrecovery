/**
 * Public shelter page data. A shelter gets a page ONLY when it is active
 * AND claimed (someone runs it); unclaimed directory entries never leak a
 * page, and callers 404 on null so existence stays non-probeable.
 *
 * The animal list is strictly public-safe: adoptable statuses only, no
 * medical data, no owner info, no roster internals.
 */

import prisma from '@/app/lib/prisma';

export async function getPublicShelter(id) {
  if (!id) return null;

  const shelter = await prisma.shelter.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      phone: true,
      email: true,
      website: true,
      isActive: true,
      isVerified: true,
    },
  });
  if (!shelter || !shelter.isActive) return null;

  const profile = await prisma.shelterProfile.findUnique({
    where: { shelterId: id },
    select: {
      about: true,
      mission: true,
      logoUrl: true,
      coverPhotoUrl: true,
      facebookUrl: true,
      instagramUrl: true,
      twitterUrl: true,
      claimedById: true,
    },
  });
  if (!profile?.claimedById) return null;

  const animals = await prisma.pet.findMany({
    where: {
      managedByShelterId: id,
      isDeleted: false,
      shelterStatus: { in: ['AVAILABLE', 'ADOPTION_PENDING'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: {
      id: true,
      name: true,
      species: true,
      breed: true,
      age: true,
      sex: true,
      size: true,
      color: true,
      primaryPhotoUrl: true,
      shelterStatus: true,
    },
  });

  const { claimedById, ...publicProfile } = profile;
  return { shelter, profile: publicProfile, animals };
}
