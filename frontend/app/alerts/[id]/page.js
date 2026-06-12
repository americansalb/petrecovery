/**
 * Alert permalink - Server Component with share metadata
 *
 * Alert links go out by email/SMS and get forwarded; the OG tags here
 * make them unfurl with the pet being searched for.
 */

import prisma from '@/app/lib/prisma';
import {
  missionWhere,
  missionShareSelect,
  missionShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import AlertPageClient from './AlertPageClient';

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

export default function AlertPage() {
  return <AlertPageClient />;
}
