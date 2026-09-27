'use client';

/**
 * An old mission link (/missions/[missionNumber], still in push alerts)
 * opens the pet's page, where everyone helping with the pet meets. The
 * search map is one tap from there ("Search on the map").
 */

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PageLoading } from '@/components/LoadingSkeleton';

export default function CaseRedirect() {
  const router = useRouter();
  const params = useParams();
  const missionNumber = params.missionNumber;

  useEffect(() => {
    if (missionNumber) router.replace(`/cases/${encodeURIComponent(missionNumber)}`);
  }, [missionNumber, router]);

  return <PageLoading message="Opening..." />;
}
