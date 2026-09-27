/**
 * A Rescue Force's share card, for each of its tabs (docs/LINK_PREVIEWS.md):
 * the force's photo, its name and town, and what it has done. The Pets
 * tab is the force's own address; the discussion is members-only, so it
 * is kept out of search results.
 */

import prisma from '@/app/lib/prisma';
import { SITE_NAME, shareImage, buildShareMetadata, genericShareMetadata } from '@/app/lib/shareMetadata';

const TAB_TITLE = { needs: 'Needs', discussion: 'Discussion' };

export async function forceMetadata(id, { tab } = {}) {
  try {
    const force = await prisma.rescueForce.findFirst({
      where: { id, isDeleted: false },
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
    const name = TAB_TITLE[tab] ? `${TAB_TITLE[tab]} · ${force.name}` : force.name;
    const title = `${name}${place ? ` - ${place}` : ''} | ${SITE_NAME}`;
    const reunions = force.successfulReunions
      ? ` ${force.successfulReunions} pet${force.successfulReunions === 1 ? '' : 's'} reunited.`
      : '';
    const description =
      (force.slogan || force.description || `Volunteers who search for lost pets${place ? ` in ${place}` : ''}.`) + reunions;

    return buildShareMetadata({
      title,
      description,
      image: shareImage(force.photoUrl || force.logoUrl),
      imageAlt: force.name,
      canonical: `/rescue-forces/${id}${tab ? `/${tab}` : ''}`,
      index: force.isActive && tab !== 'discussion',
    });
  } catch (error) {
    console.error('Error generating rescue force metadata:', error);
    return genericShareMetadata();
  }
}
