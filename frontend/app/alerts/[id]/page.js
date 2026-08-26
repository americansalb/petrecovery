/**
 * Alert permalink - Server Component with share metadata
 *
 * Alert links go out by email/SMS and get forwarded; the OG tags here
 * make them unfurl with the pet being searched for.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/app/lib/prisma';
import {
  missionWhere,
  missionShareSelect,
  missionShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import AlertPageClient from './AlertPageClient';

// Session-dependent - never statically rendered.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  try {
    const mission = await prisma.case.findFirst({
      where: missionWhere(params.id),
      select: missionShareSelect,
    });
    if (!mission) return genericShareMetadata();
    return missionShareMetadata(mission, {
      canonicalPath: `/cases/${mission.caseNumber}`,
    });
  } catch (error) {
    console.error('Error generating alert metadata:', error);
    return genericShareMetadata();
  }
}

export default async function AlertPage({ params }) {
  // These links go out by SMS and email and get opened signed out. A login
  // wall with no pet on it is the wrong landing for that tap: the public
  // case page already shows the photo, the map, and sighting doors that
  // work without an account, so send strangers there. Signed-in people
  // keep the alert detail view (tabs, owner edit).
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    let caseNumber = null;
    try {
      const mission = await prisma.case.findFirst({
        where: missionWhere(params.id),
        select: { caseNumber: true },
      });
      caseNumber = mission?.caseNumber || null;
    } catch (error) {
      console.error('Error resolving alert case for guest redirect:', error);
    }
    // Unknown ids still go to /cases, whose not-found state names the
    // problem; signing in would not resurrect a dead link.
    redirect(`/cases/${caseNumber || params.id}`);
  }
  return <AlertPageClient />;
}
