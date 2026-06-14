'use client';

/**
 * /care is two pages in one. Signed out (and for crawlers, since SSR
 * has no session) it renders the marketing landing passed as children,
 * so the public pitch stays server-rendered and indexed. Signed in, it
 * becomes your Health Books dashboard: no pitch, no "sign in," just
 * your pets. This is why a member never gets asked to sign in here.
 */

import { useSession } from 'next-auth/react';
import MembersDashboard from './MembersDashboard';

export default function CareGate({ children }) {
  const { status } = useSession();
  if (status === 'authenticated') return <MembersDashboard />;
  return children;
}
