'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RescueSquadsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/rescue-squads/search');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-5xl mb-4">🚁</div>
        <div className="text-gray-500">Redirecting...</div>
      </div>
    </div>
  );
}
