/**
 * Public pet care page (view link) - Server Component with share metadata
 *
 * Link previews (iMessage, WhatsApp, Slack...) read OpenGraph tags from
 * the initial HTML, so the pet lookup has to happen server-side here;
 * without it every shared care link previews as the generic site logo.
 * Mirrors the /cases/[caseNumber] pattern: generateMetadata + Prisma,
 * rendering the existing client page.
 */

import prisma from '@/app/lib/prisma';
import {
  SITE_NAME,
  shareImage,
  buildShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import ViewPageClient from './ViewPageClient';

const GENERIC_CARE_METADATA = () =>
  genericShareMetadata(
    `Pet Care | ${SITE_NAME}`,
    'Follow a pet’s care and medication schedule on ReunitePets.'
  );

export async function generateMetadata({ params }) {
  const { token } = params;

  // Same validity rule as the API route; invalid tokens get the generic card
  if (!token || token.length < 16) {
    return GENERIC_CARE_METADATA();
  }

  try {
    const pet = await prisma.pet.findFirst({
      where: { publicViewToken: token, isDeleted: false },
      select: {
        name: true,
        species: true,
        breed: true,
        primaryPhotoUrl: true,
        owner: { select: { firstName: true } },
      },
    });

    if (!pet) {
      return GENERIC_CARE_METADATA();
    }

    const species = pet.species ? pet.species.toLowerCase() : 'pet';
    const title = `${pet.name}’s Care Page | ${SITE_NAME}`;
    const description = pet.owner?.firstName
      ? `${pet.owner.firstName} shared ${pet.name}’s care and medication schedule with you. ${pet.breed ? pet.breed + ' · ' : ''}Read-only, no account needed.`
      : `Follow ${pet.name} the ${species}’s care and medication schedule. Read-only, no account needed.`;

    // Tokenized link: previews yes, search engines no (index defaults false)
    return buildShareMetadata({
      title,
      description,
      image: shareImage(pet.primaryPhotoUrl),
      imageAlt: `${pet.name} the ${species}`,
    });
  } catch (error) {
    console.error('Error generating pet view metadata:', error);
    return GENERIC_CARE_METADATA();
  }
}

export default function PublicPetViewPage() {
  return <ViewPageClient />;
}
