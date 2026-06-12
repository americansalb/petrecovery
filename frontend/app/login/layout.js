/**
 * Static share metadata for /login (see docs/LINK_PREVIEWS.md).
 * Pure passthrough otherwise; entity pages below this segment override
 * the card with their own generateMetadata.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: "Sign In | ReunitePets",
  description: "Sign in to your ReunitePets account.",
  index: true,
});

export default function LoginLayout({ children }) {
  return children;
}
