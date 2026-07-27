/**
 * Location landing page - Server Component with share metadata
 *
 * SEO surface: /lost-pet/austin-tx. No DB needed - the card is built
 * from the slug itself, and these pages SHOULD rank, so index: true.
 */

import { formatLocationSlug } from '@/app/lib/utils';
import { SITE_NAME, buildShareMetadata, genericShareMetadata } from '@/app/lib/shareMetadata';
import LocationPageClient from './LocationPageClient';

export async function generateMetadata({ params }) {
  const location = formatLocationSlug(params.location);
  if (!location.city || !location.state) return genericShareMetadata();

  return buildShareMetadata({
    title: `Lost & Found Pets in ${location.display} | ${SITE_NAME}`,
    description: `Report a lost pet, browse found pets, and join your local Rescue Force in ${location.display}. Free, community-powered pet recovery.`,
    canonical: `/lost-pet/${params.location}`,
    index: true,
    keywords: ['lost pet', 'found pet', location.city, location.state, 'pet recovery', 'lost dog', 'lost cat'],
  });
}

export default function LocationLandingPage() {
  return <LocationPageClient />;
}
