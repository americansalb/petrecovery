/**
 * SEO Utilities
 *
 * Schema.org structured data and meta tag generation
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://reunitepets.org';

/**
 * Generate Lost Pet schema.org JSON-LD
 */
export function generateLostPetSchema(missionData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LoseAction',
    agent: {
      '@type': 'Person',
      name: missionData.ownerName || 'Pet Owner',
    },
    object: {
      '@type': 'Thing',
      name: missionData.petName,
      description: missionData.petDescription,
      image: missionData.petPhotoUrl,
    },
    location: {
      '@type': 'Place',
      name: missionData.lastSeenAddress,
      geo: missionData.lastSeenLatitude ? {
        '@type': 'GeoCoordinates',
        latitude: missionData.lastSeenLatitude,
        longitude: missionData.lastSeenLongitude,
      } : undefined,
    },
    startTime: missionData.lastSeenAt,
  };
}

/**
 * Generate Organization schema.org JSON-LD
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ReunitePets.org',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'Community-powered pet recovery platform helping reunite lost pets with their families',
    sameAs: [
      'https://facebook.com/reunitepets',
      'https://twitter.com/reunitepets',
      'https://instagram.com/reunitepets',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@reunitepets.org',
    },
  };
}

/**
 * Generate Rescue Force (LocalBusiness) schema.org JSON-LD
 */
export function generateSquadSchema(force) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${BASE_URL}/rescue-forces/${force.id}`,
    name: force.name,
    description: force.description,
    url: `${BASE_URL}/rescue-forces/${force.id}`,
    areaServed: {
      '@type': 'City',
      name: force.city,
      containedInPlace: {
        '@type': 'State',
        name: force.state,
      },
    },
    aggregateRating: force.successfulReunions > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: Math.min(5, 4 + force.successfulReunions / 10),
      reviewCount: force.totalCasesCompleted,
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
  const fullTitle = title ? `${title} | ReunitePets.org` : 'ReunitePets.org - Find Lost Pets';
  const fullUrl = url ? `${BASE_URL}${url}` : BASE_URL;
  const fullImage = image || `${BASE_URL}/og-image.png`;

  return {
    title: fullTitle,
    description: description || 'Community-powered pet recovery platform. Report lost pets, join rescue forces, and help reunite pets with their families.',
    keywords: keywords || 'lost pet, found pet, missing dog, missing cat, pet recovery, rescue force',
    openGraph: {
      title: fullTitle,
      description,
      url: fullUrl,
      type,
      images: [{ url: fullImage }],
      siteName: 'ReunitePets.org',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [fullImage],
      site: '@reunitepets',
    },
    alternates: {
      canonical: fullUrl,
    },
  };
}

/**
 * Generate case-specific meta tags
 */
export function generateCaseMetaTags(missionData) {
  const title = `Lost ${missionData.petSpecies}: ${missionData.petName} - ${missionData.lastSeenAddress}`;
  const description = `Help find ${missionData.petName}! ${missionData.petDescription?.substring(0, 150)}... Last seen: ${missionData.lastSeenAddress}`;

  return generateMetaTags({
    title,
    description,
    image: missionData.petPhotoUrl,
    url: `/missions/${missionData.missionNumber}`,
    type: 'article',
    keywords: `lost ${missionData.petSpecies?.toLowerCase()}, ${missionData.petBreed}, ${missionData.lastSeenAddress}, missing pet`,
  });
}

/**
 * Generate force-specific meta tags
 */
export function generateSquadMetaTags(force) {
  const title = `${force.name} - Pet Rescue Force in ${force.city}, ${force.state}`;
  const description = `Join ${force.name} and help find lost pets in ${force.city}. ${force.successfulReunions} successful reunions. ${force._count?.members || 0} active members.`;

  return generateMetaTags({
    title,
    description,
    url: `/rescue-forces/${force.id}`,
    type: 'profile',
    keywords: `pet rescue ${force.city}, lost pet ${force.state}, volunteer pet search`,
  });
}
