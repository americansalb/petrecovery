/**
 * Link-preview metadata for the game's shareable pages.
 *
 * The game owns this so that nothing under app/geo imports the pet
 * site's share helpers (docs/WANDERGUESSER_SPLIT.md, phase 1.3). The
 * shape is the same one every route on the pet site uses, minus the
 * parts that only make sense for a pet: there is no photo to normalize
 * here, so there is no shareImage.
 *
 * The two defaults below are today's values, so nothing about the cards
 * changes until they are set. Phase 4 changes the defaults when the
 * game gets its own name and its own logo.
 *
 *   NEXT_PUBLIC_GEO_SITE_NAME    og:site_name for the game's pages
 *   NEXT_PUBLIC_GEO_SHARE_IMAGE  the card shown when a page has none
 *   NEXT_PUBLIC_BASE_URL         absolute base for relative images
 *
 * The rule this file serves is in docs/LINK_PREVIEWS.md and is enforced
 * by __tests__/link-previews.test.js.
 */

export const SITE_NAME = process.env.NEXT_PUBLIC_GEO_SITE_NAME || 'ReunitePets';

/**
 * The game's name, in one place. Renaming it once left the share card
 * painting the old one into every preview PNG for months, because that
 * was a literal in a JSX file nobody greps.
 */
export const GAME_NAME = 'WanderGuesser';

/** The card a page falls back to when it has no image of its own. */
export const FALLBACK_SHARE_IMAGE =
  process.env.NEXT_PUBLIC_GEO_SHARE_IMAGE ||
  'https://petrescue.b-cdn.net/ReunitePets%20Official%20Logo%20Final%202025%20(1).png';

/**
 * Absolute base for resolving relative images. Messengers reject a
 * relative og:image, so every card needs one of these behind it.
 * A request-aware version, for pages served on the game's own domain,
 * is geoMetadataBase in server/siteBase.js.
 */
export function shareMetadataBase() {
  try {
    return new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

/**
 * The one card shape the game's pages use.
 *
 * index defaults to false: a shared result links to one game somebody
 * played, which should preview richly and stay out of search results.
 * The lobby passes index: true.
 */
export function buildShareMetadata({
  title,
  description,
  image,
  imageAlt,
  canonical,
  index = false,
  keywords,
  // Optional per-surface copy; the defaults keep all three in step.
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

/** The card for a share code that does not resolve. Never says whether it existed. */
export function genericShareMetadata(title, description) {
  return buildShareMetadata({ title, description });
}
