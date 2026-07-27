/**
 * Link-preview (share card) metadata builders.
 *
 * Every publicly shareable route exports generateMetadata from a SERVER
 * page.js built on these helpers, so iMessage/WhatsApp/Slack/Facebook
 * unfurl the actual pet / mission / squad / thread instead of the
 * site-wide logo card from the root layout.
 *
 * The rule, the recipe, and the route checklist live in
 * docs/LINK_PREVIEWS.md and are enforced by
 * frontend/__tests__/link-previews.test.js.
 */

import { normalizePhotoUrl } from '@/app/lib/utils';

export const SITE_NAME = 'ReunitePets';

// Same logo the root layout uses - the fallback when an entity has no photo
export const FALLBACK_SHARE_IMAGE =
  'https://petrescue.b-cdn.net/ReunitePets%20Official%20Logo%20Final%202025%20(1).png';

/** Absolute base for resolving relative images (messengers require absolute og:image). */
export function shareMetadataBase() {
  try {
    return new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

/** Entity photo → preview-safe URL (protocol fixed, logo fallback). */
export function shareImage(url) {
  return normalizePhotoUrl(url) || FALLBACK_SHARE_IMAGE;
}

/**
 * The one card shape every route uses.
 *
 * index defaults to false: most shared links (tokenized pages, alert
 * permalinks, legacy redirect routes) should preview richly but stay
 * out of search engines. Pages meant to rank pass index: true.
 */
export function buildShareMetadata({
  title,
  description,
  image,
  imageAlt,
  canonical,
  index = false,
  keywords,
  // Optional per-surface copy; defaults keep all three in sync
  ogTitle,
  twitterTitle,
  twitterDescription,
}) {
  const imageUrl = image || FALLBACK_SHARE_IMAGE;
  return {
    metadataBase: shareMetadataBase(),
    title,
    description,
    ...(keywords ? { keywords } : {}),
    openGraph: {
      title: ogTitle || title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: imageAlt || title }],
      type: 'website',
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary_large_image',
      title: twitterTitle || ogTitle || title,
      description: twitterDescription || description,
      images: [imageUrl],
    },
    robots: { index, follow: index },
    ...(canonical ? { alternates: { canonical } } : {}),
  };
}

/** Not-found / invalid-token card: generic, never leaks whether the entity exists. */
export function genericShareMetadata(
  title = `Lost Pet Recovery | ${SITE_NAME}`,
  description = 'Community-powered pet recovery. Help reunite lost pets with their families.'
) {
  return buildShareMetadata({ title, description });
}

// ---------------------------------------------------------------------------
// Shelters - public shelter pages (/shelters/[id])
// ---------------------------------------------------------------------------

/**
 * Shelter share card. These pages should rank (index: true): a shelter's
 * ReunitePets page is often the only website it has.
 */
export function shelterShareMetadata(shelter, profile, { canonicalPath } = {}) {
  const place = [shelter.city, shelter.state].filter(Boolean).join(', ');
  const title = `${shelter.name} | Animal Shelter in ${place}`;
  const source = profile?.mission || profile?.about || '';
  const description = source
    ? `${source.substring(0, 150)}${source.length > 150 ? '...' : ''}`
    : `${shelter.name} in ${place}: adoptable animals, contact info, and hours on ${SITE_NAME}.`;

  return buildShareMetadata({
    title,
    description,
    image: shareImage(profile?.logoUrl || profile?.coverPhotoUrl),
    imageAlt: shelter.name,
    canonical: canonicalPath,
    index: true,
    keywords: ['animal shelter', 'pet adoption', shelter.name, shelter.city, shelter.state, 'adoptable pets'].filter(Boolean),
  });
}

// ---------------------------------------------------------------------------
// Missions (Case records) - shared by /cases, /missions, /reports, /alerts, /join
// ---------------------------------------------------------------------------

/** Mission routes accept a case number OR a raw id (UUID/CUID), like the API. */
export function missionWhere(param) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
  const isCuid = /^c[a-z0-9]{24}$/i.test(param);
  return isUuid || isCuid ? { id: param } : { caseNumber: param };
}

/** Exactly the fields the mission card needs - keep lookups cheap. */
export const missionShareSelect = {
  caseNumber: true,
  reportType: true,
  petName: true,
  petSpecies: true,
  petBreed: true,
  petPhotoUrl: true,
  petDescription: true,
  lastSeenAddress: true,
  lastSeenAt: true,
  status: true,
};

function missionCity(address) {
  if (!address) return 'Unknown Location';
  const parts = address.split(',');
  return parts.length >= 2 ? parts[parts.length - 2]?.trim() || 'Unknown Location' : 'Unknown Location';
}

function missionTimeMissing(lastSeenAt) {
  if (!lastSeenAt) return '';
  const days = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/**
 * Mission share card. variant:
 *  - 'lost'/'found' picked from reportType automatically
 *  - 'join' frames the same data as a volunteer ask ("Join the search…")
 */
export function missionShareMetadata(mission, { canonicalPath, index, variant } = {}) {
  const petName = mission.petName || 'Unknown Pet';
  const species = mission.petSpecies?.toLowerCase() || 'pet';
  const breed = mission.petBreed || '';
  const breedSpecies = `${breed ? breed + ' ' : ''}${species}`;
  const city = missionCity(mission.lastSeenAddress);
  const timeMissing = missionTimeMissing(mission.lastSeenAt);
  const isFound = mission.reportType === 'FOUND';

  let title;
  let description;
  let ogTitle;
  let twitterTitle;
  let twitterDescription;
  if (variant === 'join') {
    title = `Join the search for ${petName} in ${city} | ${SITE_NAME}`;
    description = `${petName} is a ${isFound ? 'found' : 'lost'} ${breedSpecies}${timeMissing ? `, ${isFound ? 'found' : 'missing since'} ${timeMissing}` : ''}. Volunteer a few minutes. Every searcher helps bring ${petName} home.`;
  } else if (isFound) {
    title = `Found ${breedSpecies} in ${city} - Is This Your Pet?`;
    ogTitle = `FOUND: ${breedSpecies} in ${city}`;
    description = mission.petDescription
      ? `${mission.petDescription.substring(0, 150)}${mission.petDescription.length > 150 ? '...' : ''} Found ${timeMissing} in ${city}. Is this your pet?`
      : `A ${breedSpecies} was found ${timeMissing} in ${city}. Is this your pet?`;
  } else {
    // Same copy the public case page has always served: descriptive page
    // <title> for search, urgent short og:title for chat cards
    title = `Help Find ${petName} - Lost ${breedSpecies} in ${city}`;
    ogTitle = `LOST: ${petName} - ${city}`;
    twitterTitle = `Help Find ${petName}!`;
    twitterDescription = `Lost ${breedSpecies} in ${city}.${timeMissing ? ` Last seen ${timeMissing}.` : ''} Please share!`;
    description = mission.petDescription
      ? `${mission.petDescription.substring(0, 150)}${mission.petDescription.length > 150 ? '...' : ''} Last seen ${timeMissing}. Help bring ${petName} home!`
      : `${petName} is a lost ${breedSpecies} last seen ${timeMissing} in ${city}. Help reunite them with their family!`;
  }

  return buildShareMetadata({
    title,
    description,
    ogTitle,
    twitterTitle,
    twitterDescription,
    image: shareImage(mission.petPhotoUrl),
    imageAlt: `${petName} - ${isFound ? 'Found' : 'Lost'} ${species}`,
    canonical: canonicalPath,
    // Only the canonical case page should rank, and only while active
    index: index ?? false,
    keywords: [
      isFound ? 'found pet' : 'lost pet',
      `${isFound ? 'found' : 'lost'} ${species}`,
      petName,
      breed,
      city,
      'missing pet',
      'pet finder',
      'pet recovery',
    ].filter(Boolean),
  });
}
