/**
 * Mission permalink - Server Component with share metadata
 *
 * The client component redirects humans to Mission Control, but link
 * preview bots never run that JS — they read the OG tags served here,
 * so a texted mission link unfurls with the actual pet.
 */

import prisma from '@/app/lib/prisma';
import {
  missionWhere,
  missionShareSelect,
  missionShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import MissionRedirectClient from './MissionRedirectClient';

export async function generateMetadata({ params }) {
  try {
    const mission = await prisma.case.findFirst({
      where: missionWhere(params.missionNumber),
      select: missionShareSelect,
    });
    if (!mission) return genericShareMetadata();
    return missionShareMetadata(mission, {
      canonicalPath: `/cases/${mission.caseNumber}`,
    });
  } catch (error) {
    console.error('Error generating mission metadata:', error);
    return genericShareMetadata();
  }
}

export default function MissionPage() {
  return <MissionRedirectClient />;
}
