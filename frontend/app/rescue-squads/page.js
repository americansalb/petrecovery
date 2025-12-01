'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function RescueSquadsRedirect() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    // If authenticated, go to "my squads", otherwise go to search
    if (status === 'authenticated') {
      router.replace('/rescue-squads/my');
    } else if (status === 'unauthenticated') {
      router.replace('/rescue-squads/search');
    }
  }, [router, status]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="text-5xl mb-4">👥</div>
        <div className="text-slate-400">Loading squads...</div>
      </div>
    </div>
  );
}
