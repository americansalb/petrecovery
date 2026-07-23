/**
 * Per-request portal context, deduped with React cache() so the layout
 * and the page share one set of queries. Pages call requirePortal();
 * the layout already redirected non-holders, but each page re-derives
 * (App Router layouts can't pass props down) and the cache makes that
 * free.
 */

import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { redirect } from 'next/navigation';
import { getShelterForUser } from '@/app/lib/shelterAuth';

export const getPortalContext = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const membership = await getShelterForUser(session.user.id, session.user.email);
  if (!membership) return null;
  const shelter = await prisma.shelter.findUnique({
    where: { id: membership.shelterId },
    select: { id: true, name: true, city: true, state: true, isVerified: true, isActive: true },
  });
  if (!shelter) return null;
  return { session, membership, shelter };
});

export async function requirePortal() {
  const ctx = await getPortalContext();
  if (!ctx) redirect('/shelter/dashboard');
  return ctx;
}
