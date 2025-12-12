'use client';

/**
 * Redirect from /cases/[missionNumber]/coordinate to /cases/[missionNumber]
 *
 * Per spec: The Mission Command Center at /cases/[missionNumber] IS the coordination page.
 * This route is deprecated and redirects to the main case page.
 */

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CoordinateRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const { missionNumber } = params;

  useEffect(() => {
    // Redirect to the main case page (which is now the Command Center)
    router.replace(`/missions/${missionNumber}`);
  }, [missionNumber, router]);

  // Show brief loading state during redirect
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Redirecting to Mission Command Center...</p>
      </div>
    </div>
  );
}
