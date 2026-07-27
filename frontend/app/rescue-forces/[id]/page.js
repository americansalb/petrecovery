/**
 * Rescue Force profile - Server Component with share metadata
 *
 * Squad links get shared to recruit neighbors; the preview shows the
 * squad's own name, photo, and record instead of the site logo.
 */

import prisma from '@/app/lib/prisma';
import {
  SITE_NAME,
  shareImage,
  buildShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import SquadPageClient from './SquadPageClient';

export async function generateMetadata({ params }) {
  try {
    const force = await prisma.rescueForce.findFirst({
      where: { id: params.id, isDeleted: false },
      select: {
        name: true,
        description: true,
        slogan: true,
        photoUrl: true,
        logoUrl: true,
        city: true,
        state: true,
        successfulReunions: true,
        isActive: true,
      },
    });
    if (!force) return genericShareMetadata();

    const place = [force.city, force.state].filter(Boolean).join(', ');
    const title = `${force.name}${place ? ` - ${place}` : ''} | ${SITE_NAME}`;
    const reunions = force.successfulReunions
      ? ` ${force.successfulReunions} successful reunion${force.successfulReunions === 1 ? '' : 's'} and counting.`
      : '';
    const description =
      (force.slogan || force.description || `Neighbors organized to bring lost pets home${place ? ` in ${place}` : ''}.`) +
      reunions;

    return buildShareMetadata({
      title,
      description,
      image: shareImage(force.photoUrl || force.logoUrl),
      imageAlt: force.name,
      canonical: `/rescue-forces/${params.id}`,
      index: force.isActive,
    });
  } catch (error) {
    console.error('Error generating rescue force metadata:', error);
    return genericShareMetadata();
  }
}

export default function SquadPage() {
  return <SquadPageClient />;
}
