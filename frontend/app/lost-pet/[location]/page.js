/**
 * Location landing page - Server Component with share metadata
 *
 * SEO surface: /lost-pet/austin-tx. No DB needed - the card is built
 * from the slug itself, and these pages SHOULD rank, so index: true.
 *
 * The slug is parsed, not looked up, so ANY string used to render a fully
 * indexable page: /lost-pet/asdfghjkl-qq returned 200 with
 * "Lost & Found Pets in Asdfghjkl, QQ" and index:true. That is an unbounded
 * doorway-page space anyone can spam links into. The state half is now checked
 * against the real list: a slug that fails gets noindex metadata AND is sent to
 * the national board, so there is nothing for a crawler to index and a human
 * still lands somewhere useful.
 */

import { redirect } from 'next/navigation';
import { formatLocationSlug } from '@/app/lib/utils';
import { US_STATES } from '@/app/lib/usStates';
import { SITE_NAME, buildShareMetadata, genericShareMetadata } from '@/app/lib/shareMetadata';
import LocationPageClient from './LocationPageClient';

/** A slug is servable only if it parses to a city and a real US state code. */
function isServableLocation(location) {
  return Boolean(location?.city) && US_STATES.includes(location?.state);
}

export async function generateMetadata({ params }) {
  const location = formatLocationSlug(params.location);
  if (!isServableLocation(location)) return genericShareMetadata();

  return buildShareMetadata({
    title: `Lost & Found Pets in ${location.display} | ${SITE_NAME}`,
    description: `Report a lost pet, browse found pets, and join your local Rescue Force in ${location.display}. Free, community-powered pet recovery.`,
    canonical: `/lost-pet/${params.location}`,
    index: true,
    keywords: ['lost pet', 'found pet', location.city, location.state, 'pet recovery', 'lost dog', 'lost cat'],
  });
}

export default function LocationLandingPage({ params }) {
  if (!isServableLocation(formatLocationSlug(params.location))) {
    redirect('/lost-and-found');
  }
  return <LocationPageClient />;
}
