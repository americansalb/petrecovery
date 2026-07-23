/**
 * The shelter portal: a hat-gated immersive takeover (registered in
 * app/lib/navChrome.js) with its own chrome. Same account system, its
 * own world: whoever manages a shelter (claimer or ACTIVE seat) works
 * here; everyone else is redirected to the public shelter surfaces.
 * The consumer site's universal navbar deliberately does not render.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { redirect } from 'next/navigation';
import { getPortalContext } from './lib';
import PortalShell from './PortalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shelter Portal — ReunitePets.org',
  description: 'Your shelter workspace on ReunitePets.org.',
};

export default async function MyShelterLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/my-shelter');
  }

  const ctx = await getPortalContext();
  if (!ctx) {
    // No shelter hat: the pre-portal surface explains how to get one
    // (application status, seat invite, or the start wizard).
    redirect('/shelter/dashboard');
  }

  const pendingMatches = await prisma.shelterStrayMatch.count({
    where: { shelterId: ctx.shelter.id, status: 'PENDING' },
  });

  return (
    <PortalShell
      shelter={ctx.shelter}
      role={ctx.membership.role}
      pendingMatches={pendingMatches}
      userName={session.user.firstName || session.user.name || ''}
    >
      {children}
    </PortalShell>
  );
}
