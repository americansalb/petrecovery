/**
 * Public Case Landing Page - Server Component with SEO Metadata
 *
 * This page generates dynamic SEO metadata for each lost pet case,
 * optimizing for social sharing and search visibility.
 */

import prisma from '@/app/lib/prisma';
import { normalizePhotoUrl } from '@/app/lib/utils';
import CasePageClient from './CasePageClient';

// Generate dynamic metadata for SEO and social sharing
export async function generateMetadata({ params }) {
  const { caseNumber } = params;

  try {
    const caseData = await prisma.case.findUnique({
      where: { caseNumber },
      select: {
        petName: true,
        petSpecies: true,
        petBreed: true,
        petPhotoUrl: true,
        petDescription: true,
        lastSeenAddress: true,
        lastSeenAt: true,
        status: true,
        priority: true,
      }
    });

    if (!caseData) {
      return {
        title: 'Case Not Found | ReunitePets',
        description: 'This case may have been resolved or removed.',
      };
    }

    // Extract city from address
    let city = 'Unknown Location';
    if (caseData.lastSeenAddress) {
      const parts = caseData.lastSeenAddress.split(',');
      if (parts.length >= 2) {
        city = parts[parts.length - 2]?.trim() || 'Unknown Location';
      }
    }

    // Format time missing
    const lastSeen = caseData.lastSeenAt ? new Date(caseData.lastSeenAt) : null;
    const daysMissing = lastSeen
      ? Math.floor((new Date() - lastSeen) / (1000 * 60 * 60 * 24))
      : null;

    const timeMissing = daysMissing !== null
      ? daysMissing === 0 ? 'today'
      : daysMissing === 1 ? 'yesterday'
      : `${daysMissing} days ago`
      : '';

    // Build title and description
    const petName = caseData.petName || 'Unknown Pet';
    const species = caseData.petSpecies?.toLowerCase() || 'pet';
    const breed = caseData.petBreed || '';

    const title = `Help Find ${petName} - Lost ${breed ? breed + ' ' : ''}${species} in ${city}`;
    const description = caseData.petDescription
      ? `${caseData.petDescription.substring(0, 150)}${caseData.petDescription.length > 150 ? '...' : ''} Last seen ${timeMissing}. Help bring ${petName} home!`
      : `${petName} is a lost ${breed ? breed + ' ' : ''}${species} last seen ${timeMissing} in ${city}. Help reunite them with their family!`;

    // Get photo URL
    const imageUrl = caseData.petPhotoUrl
      ? normalizePhotoUrl(caseData.petPhotoUrl)
      : '/images/default-pet.png';

    return {
      title,
      description,
      keywords: [
        'lost pet',
        `lost ${species}`,
        petName,
        breed,
        city,
        'missing pet',
        'pet finder',
        'pet recovery'
      ].filter(Boolean),
      openGraph: {
        title: `LOST: ${petName} - ${city}`,
        description,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: `${petName} - Lost ${species}`,
          }
        ],
        type: 'website',
        siteName: 'ReunitePets',
      },
      twitter: {
        card: 'summary_large_image',
        title: `Help Find ${petName}!`,
        description: `Lost ${breed ? breed + ' ' : ''}${species} in ${city}. Last seen ${timeMissing}. Please share!`,
        images: [imageUrl],
      },
      robots: {
        index: caseData.status === 'ACTIVE' || caseData.status === 'IN_PROGRESS',
        follow: true,
      },
      alternates: {
        canonical: `/cases/${caseNumber}`,
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Lost Pet Case | ReunitePets',
      description: 'Help find lost pets and reunite them with their families.',
    };
  }
}

// Server component that renders the client component
export default function CasePage() {
  return <CasePageClient />;
}
