'use client';

/**
 * Redirect from old case URL to Mission Control
 *
 * This page provides backward compatibility by redirecting
 * /cases/[missionNumber] → /mission-control?mission=[missionNumber]
 */

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PageLoading } from '@/components/LoadingSkeleton';

export default function CaseRedirect() {
  const router = useRouter();
  const params = useParams();
  const missionNumber = params.missionNumber;

  useEffect(() => {
    if (missionNumber) {
      // Redirect to Mission Control with the case number
      router.replace(`/mission-control?mission=${missionNumber}`);
    }
  }, [missionNumber, router]);

  return <PageLoading message="Opening mission..." />;
}
