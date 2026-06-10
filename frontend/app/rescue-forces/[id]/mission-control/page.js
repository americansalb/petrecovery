'use client';

/**
 * Redirect from /rescue-forces/[id]/mission-control to /rescue-forces/[id]
 *
 * Per spec: There are only TWO top-level pages:
 * 1. Squad Hub at /rescue-forces/[id] - city-level multi-case overview
 * 2. Mission Command Center at /cases/[missionNumber] - single case tactical page
 *
 * Mission control features should be accessed through:
 * - Squad Hub for city-level overview
 * - Mission Command Center for case-specific coordination
 *
 * This route is deprecated and redirects to the Squad Hub.
 */

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function MissionControlRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  useEffect(() => {
    // Redirect to the Squad Hub
    router.replace(`/rescue-forces/${id}`);
  }, [id, router]);

  // Show brief loading state during redirect
  return (
    <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-flash-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Taking you to the Squad...</p>
      </div>
    </div>
  );
}
