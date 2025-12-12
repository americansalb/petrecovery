'use client';

/**
 * Redirect from /rescue-squads/[id]/command-center to /rescue-squads/[id]
 *
 * Per spec: There are only TWO top-level pages:
 * 1. Squad Hub at /rescue-squads/[id] - city-level multi-case overview
 * 2. Mission Command Center at /cases/[missionNumber] - single case tactical page
 *
 * There should be no third "command center" route at the squad level.
 * Squad-level coordination happens within the Squad Hub.
 * Case-level coordination happens within the Mission Command Center.
 *
 * This route is deprecated and redirects to the Squad Hub.
 */

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CommandCenterRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  useEffect(() => {
    // Redirect to the Squad Hub
    router.replace(`/rescue-squads/${id}`);
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
