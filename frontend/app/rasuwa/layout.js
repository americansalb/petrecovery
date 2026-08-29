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
  index: true,
});

export default function RasuwaLayout({ children }) {
  return children;
}
