/**
 * Public Case Landing Page - Server Component with SEO Metadata
 *
 * This page generates dynamic SEO metadata for each lost pet case,
 * optimizing for social sharing and search visibility.
 */

import prisma from '@/app/lib/prisma';
import {
  missionShareSelect,
  missionShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import CasePageClient from './CasePageClient';

export async function generateMetadata({ params }) {
  const { caseNumber } = params;

  try {
    const caseData = await prisma.case.findUnique({
      where: { caseNumber },
      select: missionShareSelect,
    });

    if (!caseData) {
      return genericShareMetadata(
        'Case Not Found | ReunitePets',
        'This case may have been resolved or removed.'
      );
    }

    return missionShareMetadata(caseData, {
      canonicalPath: `/cases/${caseNumber}`,
      // The canonical case page is the one mission URL that should rank,
      // and only while the search is live
      index: caseData.status === 'ACTIVE' || caseData.status === 'IN_PROGRESS',
    });
  } catch (error) {
    console.error('Error generating metadata:', error);
    return genericShareMetadata(
      'Lost Pet Case | ReunitePets',
      'Help find lost pets and reunite them with their families.'
    );
  }
}

// Server component that renders the client component
export default function CasePage() {
  return <CasePageClient />;
}
