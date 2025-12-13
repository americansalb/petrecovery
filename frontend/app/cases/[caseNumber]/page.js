'use client';

/**
 * Case Detail Page - Redirects to Mission Control
 *
 * Route: /cases/[caseNumber]
 * Redirects to /mission-control?mission=[caseNumber]
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
      router.replace(`/mission-control?mission=${caseNumber}`);
    }
  }, [caseNumber, router]);

  return <PageLoading message="Opening case..." />;
}
