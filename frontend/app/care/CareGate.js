'use client';

/**
 * /care is the daily product's public front door. Signed out (and for
 * crawlers, since SSR has no session) it renders the marketing landing
 * passed as children, so the pitch stays server-rendered and indexed.
 * Signed in, there is exactly ONE dashboard for your pets - /pets - so
 * members are sent straight there instead of a second, stripped copy.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function CareGate({ children }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/pets');
  }, [status, router]);

  if (status === 'authenticated') {
    return <div className="min-h-[40vh]" aria-hidden="true" />;
  }
  return children;
}
