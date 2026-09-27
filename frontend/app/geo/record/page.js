'use client';

/**
 * /geo/record: read sentences aloud for Voices rounds
 * (components/record/RecordClient.js). The Suspense is for
 * useSearchParams, which carries the language.
 */

import { Suspense } from 'react';
import RecordClient from '../components/record/RecordClient';

export default function RecordPage() {
  return (
    <Suspense fallback={null}>
      <RecordClient />
    </Suspense>
  );
}
