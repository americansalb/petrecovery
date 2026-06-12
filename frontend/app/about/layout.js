/**
 * Static share metadata for /about (see docs/LINK_PREVIEWS.md).
 * Pure passthrough otherwise; entity pages below this segment override
 * the card with their own generateMetadata.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: "About | ReunitePets",
  description: "Why ReunitePets exists: free, community-powered pet recovery for every family.",
  index: true,
});

export default function AboutLayout({ children }) {
  return children;
}
