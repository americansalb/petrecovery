'use client';

/**
 * Redirect from old case URL to Mission Control
 *
 * This page provides backward compatibility by redirecting
 * /cases/[caseNumber] → /mission-control?mission=[caseNumber]
 */

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PageLoading } from '@/components/LoadingSkeleton';

export default function CaseRedirect() {
  const router = useRouter();
  const params = useParams();
  const caseNumber = params.caseNumber;

  useEffect(() => {
    if (caseNumber) {
      // Redirect to Mission Control with the case number
      router.replace(`/mission-control?mission=${caseNumber}`);
    }
  }, [caseNumber, router]);

  return <PageLoading message="Opening mission..." />;
}
