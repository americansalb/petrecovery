/**
 * Static share metadata for /rasuwa (see docs/LINK_PREVIEWS.md). This link
 * travels through family group chats; the card has to say what the page
 * does without loading it.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = {
  ...buildShareMetadata({
    title: 'Missing in the Rasuwa flood: write to your representatives',
    description:
      'For families of people missing in the August 26 flood in Nepal. Find your members of Congress, build a letter with your loved one\'s details, and get the phone numbers and forms to deliver it.',
    // A dedicated card image (scripts/build-rasuwa-share-image.js): the
    // pet-site logo fallback read as a wrong link in family group chats.
    image: '/rasuwa-share.png',
    imageAlt: 'Missing in the Rasuwa flood: write to your representatives. rescueourfamily.org',
    index: true,
  }),
  // These pages, and therefore every rescueourfamily.org tab, carry
  // their own mark (scripts/build-rasuwa-icons.js), never the
  // ReunitePets dog: a pet-rescue logo on a missing-person page reads
  // as a wrong link. Overrides the root layout's icons and manifest;
  // middleware.js additionally rewrites the family domain's bare
  // /favicon.ico and /apple-touch-icon*.png requests here.
  icons: {
    icon: [{ url: '/rasuwa/icon-64.png', type: 'image/png', sizes: '64x64' }],
    shortcut: '/rasuwa/favicon.ico',
    apple: '/rasuwa/apple-icon-180.png',
  },
  manifest: '/rasuwa/manifest.json',
};

export default function RasuwaLayout({ children }) {
  return children;
}
