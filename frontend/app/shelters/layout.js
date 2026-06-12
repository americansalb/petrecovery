/**
 * Static share metadata for /shelters (see docs/LINK_PREVIEWS.md).
 * Pure passthrough otherwise; entity pages below this segment override
 * the card with their own generateMetadata.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: "Shelters & Rescues | ReunitePets",
  description: "Find animal shelters and rescues near you and check their intakes for your pet.",
  index: true,
});

export default function SheltersLayout({ children }) {
  return children;
}
