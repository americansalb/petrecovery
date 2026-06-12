/**
 * Static share metadata for /hub (see docs/LINK_PREVIEWS.md).
 * Pure passthrough otherwise; entity pages below this segment override
 * the card with their own generateMetadata.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: "Rescue Hub | ReunitePets",
  description: "Community forum for lost pet help, success stories, and everything pets.",
  index: true,
});

export default function HubLayout({ children }) {
  return children;
}
