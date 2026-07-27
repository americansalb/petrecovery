/**
 * Static share metadata for /rescue-forces (see docs/LINK_PREVIEWS.md).
 * Pure passthrough otherwise; entity pages below this segment override
 * the card with their own generateMetadata.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: "Rescue Forces | ReunitePets",
  description: "Find your local Rescue Force - neighbors organized and ready to bring lost pets home.",
  index: true,
});

export default function RescueForcesLayout({ children }) {
  return children;
}
