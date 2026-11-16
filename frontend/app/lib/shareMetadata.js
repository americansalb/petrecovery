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
import { getBaseUrl } from '@/app/lib/config';
import { wholeDays } from '@/app/lib/elapsed';
import { parsePlace } from '@/app/lib/placeLabel';
import { looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';
import { known } from '@/app/lib/caseLabels';
import { speciesLabel } from '@/app/lib/species';

export const SITE_NAME = 'ReunitePets';

// Sarama standing, served by the site itself (public/brand): the fallback
// when an entity has no photo, the same drawing as before, 185 KB instead of
// the CDN's 1.9 MB. A path here; fallbackShareImage() makes it absolute.
export const FALLBACK_SHARE_IMAGE = '/brand/sarama-1024.png';
export function fallbackShareImage() {
  return new URL(FALLBACK_SHARE_IMAGE, getBaseUrl()).toString();
}

/**
 * Absolute base for canonical URLs and relative images (messengers require
 * an absolute og:image). The built-in address from config.js: this used to
 * read NEXT_PUBLIC_BASE_URL, which production never set, so every case
 * page's canonical tag said http://localhost:3000.
 */
export function shareMetadataBase() {
  return new URL(getBaseUrl());
}

/** Entity photo → preview-safe URL (protocol fixed, logo fallback). */
export function shareImage(url) {
  return normalizePhotoUrl(url) || fallbackShareImage();
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
  const imageUrl = image || fallbackShareImage();
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
  // The kit's link-preview image (SOCIAL_OG, 1200×630: the photo, LOST, where and
  // when, what to do, the phone), once the cascade has drawn it.
  activation: {
    select: {
      assets: { where: { kind: 'SOCIAL_OG', status: 'ready' }, select: { url: true }, take: 1 },
    },
  },
};

/** The kit's link-preview image for a mission, or null until the cascade has drawn one. */
export function missionShareCard(mission) {
  const asset = (mission?.activation?.assets || []).find((a) => a && a.url);
  return asset ? asset.url : null;
}

const US_COUNTRY = /^(united states( of america)?|usa|u\.?s\.?a?\.?)$/i;

/**
 * Where the pet was lost or found, as a card names it: a town or a city,
 * never a postcode or a street number. This used to take the second-to-last
 * comma part of the address, which for a "Use my location" report is the
 * postcode ("LOST: Mia - 78701").
 *
 * A US address is read the way the pet's page reads it (parsePlace,
 * app/lib/placeLabel.js): "Austin, TX". Elsewhere there is no state to find,
 * so the card names the city or region the address ends in, before the
 * country: "Ciudad de México" from Nominatim's "Calle de Durango 200, Roma
 * Norte, Cuauhtémoc, Ciudad de México, 06700, México". A part with a digit
 * in it is a postcode or a house number and is never the place. Empty when
 * nothing is left: the card then names no place rather than a guess.
 */
export function missionPlace(address) {
  if (typeof address !== 'string' || !address.trim() || looksLikeCoordinates(address)) return '';
  const parsed = parsePlace(address);
  if (parsed?.country === 'US') return parsed.label;
  const all = address.split(',').map((p) => p.trim()).filter(Boolean);
  // A US address with no state in it: the town is the last plain name before the country.
  const us = all.length > 1 && US_COUNTRY.test(all[all.length - 1]);
  const parts = (us ? all.slice(0, -1) : all).filter((p) => !/\d/.test(p) && !(us && /\bcounty\b/i.test(p)));
  if (!parts.length) return '';
  if (us || parts.length < 3) return parts[parts.length - 1];
  return parts[parts.length - 2];
}

/**
 * The kind of animal, as a card says it: "Golden Retriever dog", or "cat"
 * when the report names no breed. The report form does not ask for a breed,
 * so most reports store "Unknown", which is a database value and never
 * shown ("a lost Unknown cat").
 */
export function missionKind(mission) {
  const species = speciesLabel(mission?.petSpecies).toLowerCase();
  const breed = known(mission?.petBreed);
  return breed ? `${breed} ${species}` : species;
}

/** "today", "yesterday", "3 days ago", or '' with no date. */
function missionTimeMissing(lastSeenAt) {
  if (!lastSeenAt) return '';
  // Whole days, as the pet's page counts them (app/lib/elapsed.js).
  const days = wholeDays(Date.now() - new Date(lastSeenAt).getTime());
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

const anOrA = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
/** The reporter's words, cut at 150 letters, ending as a sentence so the next one reads on. */
const clip = (text) => {
  const cut = text.length > 150 ? `${text.substring(0, 150).trimEnd()}...` : text;
  return /[.!?)]$/.test(cut) ? cut : `${cut}.`;
};

/**
 * Mission share card. variant:
 *  - 'lost'/'found' picked from reportType automatically
 *  - 'join' frames the same data as a volunteer ask ("Join the search…")
 */
export function missionShareMetadata(mission, { canonicalPath, index, variant } = {}) {
  const isFound = mission.reportType === 'FOUND';
  const species = speciesLabel(mission.petSpecies).toLowerCase();
  const name = known(mission.petName);
  const breed = known(mission.petBreed);
  const kind = missionKind(mission);
  const place = missionPlace(mission.lastSeenAddress);
  const inPlace = place ? ` in ${place}` : '';
  const timeMissing = missionTimeMissing(mission.lastSeenAt);
  const petDescription = String(mission.petDescription || '').trim();

  let title;
  let description;
  let ogTitle;
  let twitterTitle;
  let twitterDescription;
  if (variant === 'join') {
    const seen = timeMissing ? `, ${isFound ? 'found' : 'last seen'} ${timeMissing}` : '';
    title = `Join the search for ${name || `a ${isFound ? 'found' : 'lost'} ${species}`}${inPlace} | ${SITE_NAME}`;
    description = `${name ? `${name} is a` : 'A'} ${isFound ? 'found' : 'lost'} ${kind}${seen}. Volunteer a few minutes. Every searcher helps bring ${name || 'them'} home.`;
  } else if (isFound) {
    const found = [timeMissing, place && `in ${place}`].filter(Boolean).join(' ');
    title = `Found ${kind}${inPlace} - Is This Your Pet?`;
    ogTitle = `FOUND: ${kind}${inPlace}`;
    description = petDescription
      ? `${clip(petDescription)}${found ? ` Found ${found}.` : ''} Is this your pet?`
      : `${anOrA(kind) === 'an' ? 'An' : 'A'} ${kind} was found${found ? ` ${found}` : ''}. Is this your pet?`;
  } else {
    // Same copy the public case page has always served: descriptive page
    // <title> for search, urgent short og:title for chat cards
    const who = name || `this ${species}`;
    title = `Help Find ${who} - Lost ${kind}${inPlace}`;
    ogTitle = `LOST: ${who}${place ? ` - ${place}` : ''}`;
    twitterTitle = `Help Find ${who}!`;
    twitterDescription = `Lost ${kind}${inPlace}.${timeMissing ? ` Last seen ${timeMissing}.` : ''} Please share!`;
    description = petDescription
      ? `${clip(petDescription)}${timeMissing ? ` Last seen ${timeMissing}.` : ''} Help bring ${who} home!`
      : `${name ? `${name} is a` : 'A'} lost ${kind}${timeMissing ? ` last seen ${timeMissing}` : ''}${inPlace}. Help reunite them with their family!`;
  }

  // The kit's link-preview image when there is one (it is drawn for exactly this,
  // at the size messengers show); the pet's photo until the kit has drawn it.
  const card = missionShareCard(mission);
  return buildShareMetadata({
    title,
    description,
    ogTitle,
    twitterTitle,
    twitterDescription,
    image: card || shareImage(mission.petPhotoUrl),
    imageAlt: card
      ? `${isFound ? 'Found' : 'Lost'}: ${name || `a ${species}`}, with where and when and how to reach the family`
      : [name, `${isFound ? 'Found' : 'Lost'} ${species}`].filter(Boolean).join(' - '),
    canonical: canonicalPath,
    // Only the canonical case page should rank, and only while active
    index: index ?? false,
    keywords: [
      isFound ? 'found pet' : 'lost pet',
      `${isFound ? 'found' : 'lost'} ${species}`,
      name,
      breed,
      place,
      'missing pet',
      'pet finder',
      'pet recovery',
    ].filter(Boolean),
  });
}
