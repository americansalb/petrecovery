/**
 * Static share metadata for /geo (see docs/LINK_PREVIEWS.md). The share
 * page below overrides the card with the game's own result.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: 'Where on Earth | ReunitePets',
  description:
    'A street-level guessing game. You are dropped at a random spot with imagery, you place a pin, and points depend on how close you are.',
  index: false,
});

export default function GeoLayout({ children }) {
  return children;
}
