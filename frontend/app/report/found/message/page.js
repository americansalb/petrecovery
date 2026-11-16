/**
 * /report/found/message?case=<case number>: write to the person who found a
 * pet. The owner's match email and bell link here; the message goes to the
 * finder by email or text without either side seeing the other's address
 * (app/lib/finderMessage.js). A form, not a page to share: it is kept out
 * of search results.
 */

import { Suspense } from 'react';
import { buildShareMetadata } from '@/app/lib/shareMetadata';
import MessageFinderPage from './MessageFinderPage';

export const metadata = buildShareMetadata({
  title: 'Write to the finder | ReunitePets',
  description: 'Send a message to the person who found a pet.',
  index: false,
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MessageFinderPage />
    </Suspense>
  );
}
