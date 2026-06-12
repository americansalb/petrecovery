/**
 * Static share metadata for /contact (see docs/LINK_PREVIEWS.md).
 * Pure passthrough otherwise; entity pages below this segment override
 * the card with their own generateMetadata.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: "Contact | ReunitePets",
  description: "Get in touch with the ReunitePets team.",
  index: true,
});

export default function ContactLayout({ children }) {
  return children;
}
