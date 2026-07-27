/**
 * Static share metadata for /advice (see docs/LINK_PREVIEWS.md).
 * Pure passthrough otherwise; entity pages below this segment override
 * the card with their own generateMetadata.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: "Lost Pet Advice | ReunitePets",
  description: "What to do first when a pet goes missing - proven steps, species by species.",
  index: true,
});

export default function AdviceLayout({ children }) {
  return children;
}
