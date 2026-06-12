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
import { normalizePhotoUrl } from '@/app/lib/utils';
import ViewPageClient from './ViewPageClient';

const FALLBACK_IMAGE = 'https://petrescue.b-cdn.net/ReunitePets%20Official%20Logo%20Final%202025%20(1).png';

const GENERIC_METADATA = {
  title: 'Pet Care | ReunitePets',
  description: 'Follow a pet’s care and medication schedule on ReunitePets.',
  robots: { index: false, follow: false },
};

export async function generateMetadata({ params }) {
  const { token } = params;

  // Same validity rule as the API route; invalid tokens get the generic card
  if (!token || token.length < 16) {
    return GENERIC_METADATA;
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
      return GENERIC_METADATA;
    }

    const species = pet.species ? pet.species.toLowerCase() : 'pet';
    const title = `${pet.name}’s Care Page | ReunitePets`;
    const description = pet.owner?.firstName
      ? `${pet.owner.firstName} shared ${pet.name}’s care and medication schedule with you. ${pet.breed ? pet.breed + ' · ' : ''}Read-only, no account needed.`
      : `Follow ${pet.name} the ${species}’s care and medication schedule. Read-only, no account needed.`;
    const imageUrl = normalizePhotoUrl(pet.primaryPhotoUrl) || FALLBACK_IMAGE;

    return {
      // Resolves relative photo paths to absolute URLs, which messengers
      // require for og:image (CDN photos are already absolute)
      metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
      title,
      description,
      openGraph: {
        title,
        description,
        images: [
          {
            url: imageUrl,
            alt: `${pet.name} the ${species}`,
          },
        ],
        type: 'website',
        siteName: 'ReunitePets',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
      // Tokenized link: previews yes, search engines no
      robots: { index: false, follow: false },
    };
  } catch (error) {
    console.error('Error generating pet view metadata:', error);
    return GENERIC_METADATA;
  }
}

export default function PublicPetViewPage() {
  return <ViewPageClient />;
}
