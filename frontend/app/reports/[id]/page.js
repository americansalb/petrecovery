/**
 * Legacy report permalink - Server Component with share metadata
 *
 * The client resolves the id and forwards to /cases/[caseNumber];
 * preview bots don't run that JS, so the pet card is served here.
 */

import prisma from '@/app/lib/prisma';
import {
  missionWhere,
  missionShareSelect,
  missionShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import ReportRedirectClient from './ReportRedirectClient';

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
    console.error('Error generating report metadata:', error);
    return genericShareMetadata();
  }
}

export default function ReportPage() {
  return <ReportRedirectClient />;
}
