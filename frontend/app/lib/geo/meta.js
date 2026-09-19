/**
 * Link-preview metadata for the game's shareable pages.
 *
 * The game owns this so that nothing under app/geo imports the pet
 * site's share helpers (docs/PROBABLY_EARTH_SPLIT.md, phase 1.3). The
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

/**
 * og:site_name for the game's pages. The game's own, not the pet
 * site's: it is a site of its own on probablyearth.com, and a preview
 * that says ReunitePets makes it look like somebody else's section.
 */
export const SITE_NAME = process.env.NEXT_PUBLIC_GEO_SITE_NAME || 'Probably Earth';

/**
 * The game's name, in one place. Renaming it once left the share card
 * painting the old one into every preview PNG for months, because that
 * was a literal in a JSX file nobody greps.
 */
export const GAME_NAME = 'Probably Earth';

/** The card a page falls back to when it has no image of its own. */
export const FALLBACK_SHARE_IMAGE =
  process.env.NEXT_PUBLIC_GEO_SHARE_IMAGE ||
  // The game draws its own cards (/api/geo/og); this is the one for a
  // page with nothing of its own to show. A pet rescue logo on a
  // geography game was the old answer and it was the wrong one.
  //
  // PNG, not the SVG it is drawn from: Facebook, Slack, iMessage,
  // WhatsApp, X and LinkedIn all decline an SVG og:image, so pointing
  // here at geo-card.svg unfurled the lobby - the URL people actually
  // paste - with no picture at all. scripts/build-geo-card.js renders
  // it; __tests__/link-previews.test.js keeps it from sliding back.
  '/geo-card.png';

/**
 * The game's own home, which is what its cards must point at.
 *
 * NEXT_PUBLIC_BASE_URL is one value for a deployment that serves two
 * sites, so it cannot answer this: the pet site is www.reunitepets.org
 * and the game is probablyearth.com. Falling through to it, or to the
 * localhost default behind it, is what put
 * `og:image="http://localhost:3000/geo-card.png"` on the live
 * /geo/script, /geo/leaderboard and /geo/rooms. Every one of those
 * links unfurled with no picture, on every platform, while /geo looked
 * right because its page hardcoded the domain itself.
 *
 * So the canonical origin lives here, once, overridable per deployment.
 */
const GEO_HOME_DEFAULT = 'https://probablyearth.com';

/** A literal fallback, so a malformed override cannot poison it too. */
function validOrigin(value, fallback) {
  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

export const GEO_HOME_URL = validOrigin(
  process.env.NEXT_PUBLIC_GEO_HOME_URL || GEO_HOME_DEFAULT,
  GEO_HOME_DEFAULT
);

/**
 * Absolute base for resolving relative images. Messengers reject a
 * relative og:image, so every card needs one of these behind it.
 * A request-aware version, for pages served on the game's own domain,
 * is geoMetadataBase in server/siteBase.js. This one is the static
 * fallback, and it has to be the game's home rather than the pet
 * site's: it is what every statically rendered game page inherits, and
 * those pages stay static precisely because they do not read the
 * request.
 */
export function shareMetadataBase() {
  if (process.env.NEXT_PUBLIC_GEO_HOME_URL) return new URL(GEO_HOME_URL);
  if (process.env.NODE_ENV === 'development') {
    return new URL(
      validOrigin(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000', 'http://localhost:3000')
    );
  }
  return new URL(GEO_HOME_URL);
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
  // The tab icon. The game's pages pass a globe; the pet site's own
  // pages never call this and keep theirs.
  icons,
}) {
  const imageUrl = image || FALLBACK_SHARE_IMAGE;
  return {
    metadataBase: shareMetadataBase(),
    title,
    description,
    ...(icons ? { icons } : {}),
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
