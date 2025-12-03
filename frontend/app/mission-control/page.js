'use client';

/**
 * Mission Control Page - V2 Redesign
 *
 * Now using the new panel-based layout with always-visible map
 */

import { Suspense } from 'react';
import { PageLoading } from '@/components/LoadingSkeleton';
import MissionControlV2 from './MissionControlV2';

export default function MissionControlPage() {
  return (
    <Suspense fallback={<PageLoading message="Loading Mission Control..." />}>
      <MissionControlV2 />
    </Suspense>
  );
}
