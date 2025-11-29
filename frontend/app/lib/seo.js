/**
 * SEO Utilities
 *
 * Schema.org structured data and meta tag generation
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://petrecovery.org';

/**
 * Generate Lost Pet schema.org JSON-LD
 */
export function generateLostPetSchema(caseData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LoseAction',
    agent: {
      '@type': 'Person',
      name: caseData.ownerName || 'Pet Owner',
    },
    object: {
      '@type': 'Thing',
      name: caseData.petName,
      description: caseData.petDescription,
      image: caseData.petPhotoUrl,
    },
    location: {
      '@type': 'Place',
      name: caseData.lastSeenAddress,
      geo: caseData.lastSeenLatitude ? {
        '@type': 'GeoCoordinates',
        latitude: caseData.lastSeenLatitude,
        longitude: caseData.lastSeenLongitude,
      } : undefined,
    },
    startTime: caseData.lastSeenAt,
  };
}

/**
 * Generate Organization schema.org JSON-LD
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'PetRecovery.org',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'Community-powered pet recovery platform helping reunite lost pets with their families',
    sameAs: [
      'https://facebook.com/petrecovery',
      'https://twitter.com/petrecovery',
      'https://instagram.com/petrecovery',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@petrecovery.org',
    },
  };
}

/**
 * Generate Rescue Squad (LocalBusiness) schema.org JSON-LD
 */
export function generateSquadSchema(squad) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${BASE_URL}/rescue-squads/${squad.id}`,
    name: squad.name,
    description: squad.description,
    url: `${BASE_URL}/rescue-squads/${squad.id}`,
    areaServed: {
      '@type': 'City',
      name: squad.city,
      containedInPlace: {
        '@type': 'State',
        name: squad.state,
      },
    },
    aggregateRating: squad.successfulReunions > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: Math.min(5, 4 + squad.successfulReunions / 10),
      reviewCount: squad.totalCasesCompleted,
    } : undefined,
  };
}

/**
 * Generate FAQ schema.org JSON-LD
 */
export function generateFAQSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate BreadcrumbList schema.org JSON-LD
 */
export function generateBreadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.url}`,
    })),
  };
}

/**
 * Generate meta tags for a page
 */
export function generateMetaTags({
  title,
  description,
  image,
  url,
  type = 'website',
  keywords,
}) {
  const fullTitle = title ? `${title} | PetRecovery.org` : 'PetRecovery.org - Find Lost Pets';
  const fullUrl = url ? `${BASE_URL}${url}` : BASE_URL;
  const fullImage = image || `${BASE_URL}/og-image.png`;

  return {
    title: fullTitle,
    description: description || 'Community-powered pet recovery platform. Report lost pets, join rescue squads, and help reunite pets with their families.',
    keywords: keywords || 'lost pet, found pet, missing dog, missing cat, pet recovery, rescue squad',
    openGraph: {
      title: fullTitle,
      description,
      url: fullUrl,
      type,
      images: [{ url: fullImage }],
      siteName: 'PetRecovery.org',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [fullImage],
      site: '@petrecovery',
    },
    alternates: {
      canonical: fullUrl,
    },
  };
}

/**
 * Generate case-specific meta tags
 */
export function generateCaseMetaTags(caseData) {
  const title = `Lost ${caseData.petSpecies}: ${caseData.petName} - ${caseData.lastSeenAddress}`;
  const description = `Help find ${caseData.petName}! ${caseData.petDescription?.substring(0, 150)}... Last seen: ${caseData.lastSeenAddress}`;

  return generateMetaTags({
    title,
    description,
    image: caseData.petPhotoUrl,
    url: `/cases/${caseData.caseNumber}`,
    type: 'article',
    keywords: `lost ${caseData.petSpecies?.toLowerCase()}, ${caseData.petBreed}, ${caseData.lastSeenAddress}, missing pet`,
  });
}

/**
 * Generate squad-specific meta tags
 */
export function generateSquadMetaTags(squad) {
  const title = `${squad.name} - Pet Rescue Squad in ${squad.city}, ${squad.state}`;
  const description = `Join ${squad.name} and help find lost pets in ${squad.city}. ${squad.successfulReunions} successful reunions. ${squad._count?.members || 0} active members.`;

  return generateMetaTags({
    title,
    description,
    url: `/rescue-squads/${squad.id}`,
    type: 'profile',
    keywords: `pet rescue ${squad.city}, lost pet ${squad.state}, volunteer pet search`,
  });
}
