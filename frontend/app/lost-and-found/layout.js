/**
 * Static share metadata for /lost-and-found (see docs/LINK_PREVIEWS.md).
 * Pure passthrough otherwise; entity pages below this segment override
 * the card with their own generateMetadata.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: "Lost & Found Pets | ReunitePets",
  description: "Browse active lost and found pet reports near you, report a sighting, and help bring pets home.",
  index: true,
});

export default function LostAndFoundLayout({ children }) {
  return children;
}
