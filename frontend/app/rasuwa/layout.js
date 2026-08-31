/**
 * Static share metadata for /rasuwa (see docs/LINK_PREVIEWS.md). This link
 * travels through family group chats; the card has to say what the page
 * does without loading it.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: 'Missing in the Rasuwa flood: write to your representatives',
  description:
    'For families of people missing in the August 26 flood in Nepal. Find your members of Congress, build a letter with your loved one\'s details, and get the phone numbers and forms to deliver it.',
  // A dedicated card image (scripts/build-rasuwa-share-image.js): the
  // pet-site logo fallback read as a wrong link in family group chats.
  image: '/rasuwa-share.png',
  imageAlt: 'Missing in the Rasuwa flood: write to your representatives. rescueourfamily.org',
  index: true,
});

export default function RasuwaLayout({ children }) {
  return children;
}
