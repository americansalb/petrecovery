/**
 * Static share metadata for /register (see docs/LINK_PREVIEWS.md).
 * Pure passthrough otherwise; entity pages below this segment override
 * the card with their own generateMetadata.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: "Join ReunitePets",
  description: "Create a free account to report, search, and help reunite lost pets.",
  index: true,
});

export default function RegisterLayout({ children }) {
  return children;
}
