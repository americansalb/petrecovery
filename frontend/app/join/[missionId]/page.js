/**
 * Mission join invite - Server Component with share metadata
 *
 * This is THE link squads paste into group chats to recruit searchers,
 * so the preview is framed as the ask: "Join the search for Max".
 */

import prisma from '@/app/lib/prisma';
import {
  missionWhere,
  missionShareSelect,
  missionShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import { Suspense } from 'react';
import JoinPageClient from './JoinPageClient';

export async function generateMetadata({ params }) {
  try {
    const mission = await prisma.case.findFirst({
      where: missionWhere(params.missionId),
      select: missionShareSelect,
    });
    if (!mission) return genericShareMetadata();
    return missionShareMetadata(mission, { variant: 'join' });
  } catch (error) {
    console.error('Error generating join metadata:', error);
    return genericShareMetadata();
  }
}

// The client reads ?action= with useSearchParams, which needs a Suspense
// boundary above it or the build refuses to prerender the route.
export default function JoinMissionPage() {
  return (
    <Suspense fallback={null}>
      <JoinPageClient />
    </Suspense>
  );
}
