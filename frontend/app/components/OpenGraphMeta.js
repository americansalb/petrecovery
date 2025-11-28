'use client';

import { useEffect } from 'react';
import Head from 'next/head';

/**
 * OpenGraphMeta Component
 *
 * Dynamically sets OpenGraph meta tags for social sharing.
 * Note: For proper SSR support, these should also be set in page metadata.
 */
export default function OpenGraphMeta({
  title,
  description,
  imageUrl,
  url,
  type = 'article',
  siteName = 'PetRecovery.org',
  twitterCard = 'summary_large_image',
  twitterSite = '@PetRecoveryOrg'
}) {
  useEffect(() => {
    // Update document title
    if (title) {
      document.title = title;
    }

    // Update or create meta tags
    const updateMetaTag = (property, content, isName = false) => {
      const attr = isName ? 'name' : 'property';
      let tag = document.querySelector(`meta[${attr}="${property}"]`);

      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, property);
        document.head.appendChild(tag);
      }

      tag.setAttribute('content', content);
    };

    // OpenGraph tags
    if (title) updateMetaTag('og:title', title);
    if (description) updateMetaTag('og:description', description);
    if (imageUrl) updateMetaTag('og:image', imageUrl);
    if (url) updateMetaTag('og:url', url);
    if (type) updateMetaTag('og:type', type);
    if (siteName) updateMetaTag('og:site_name', siteName);

    // Twitter Card tags
    if (twitterCard) updateMetaTag('twitter:card', twitterCard, true);
    if (twitterSite) updateMetaTag('twitter:site', twitterSite, true);
    if (title) updateMetaTag('twitter:title', title, true);
    if (description) updateMetaTag('twitter:description', description, true);
    if (imageUrl) updateMetaTag('twitter:image', imageUrl, true);

    // Additional SEO tags
    if (description) updateMetaTag('description', description, true);

  }, [title, description, imageUrl, url, type, siteName, twitterCard, twitterSite]);

  return null;
}

/**
 * Generate metadata object for Next.js App Router
 * Use this in page.js files for SSR meta tags
 */
export function generateCaseMetadata(caseData) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://petrecovery.org';

  return {
    title: `Help Find ${caseData.petName}! - Missing ${caseData.petSpecies} | PetRecovery.org`,
    description: `${caseData.petSpecies} ${caseData.petBreed || ''} named ${caseData.petName} went missing near ${caseData.lastSeenAddress}. ${caseData.petDescription?.substring(0, 150)}...`,
    openGraph: {
      title: `Help Find ${caseData.petName}!`,
      description: `Missing ${caseData.petSpecies}: ${caseData.petName}. Last seen near ${caseData.lastSeenAddress}. Please share to help bring them home!`,
      url: `${baseUrl}/cases/${caseData.id}`,
      siteName: 'PetRecovery.org',
      images: caseData.petPhotoUrl ? [
        {
          url: caseData.petPhotoUrl,
          width: 1200,
          height: 630,
          alt: `Photo of ${caseData.petName}`,
        }
      ] : [],
      locale: 'en_US',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Help Find ${caseData.petName}!`,
      description: `Missing ${caseData.petSpecies}: ${caseData.petName}. Last seen near ${caseData.lastSeenAddress}.`,
      images: caseData.petPhotoUrl ? [caseData.petPhotoUrl] : [],
    },
    robots: {
      index: caseData.isPublic,
      follow: true,
    },
    alternates: {
      canonical: `${baseUrl}/cases/${caseData.id}`,
    },
  };
}

/**
 * Generate JSON-LD structured data for lost pets
 */
export function generateCaseStructuredData(caseData) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://petrecovery.org';

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Help Find ${caseData.petName}!`,
    description: `Missing ${caseData.petSpecies}: ${caseData.petName}. Last seen near ${caseData.lastSeenAddress}.`,
    image: caseData.petPhotoUrl || undefined,
    datePublished: caseData.createdAt,
    dateModified: caseData.updatedAt,
    author: {
      '@type': 'Organization',
      name: 'PetRecovery.org'
    },
    publisher: {
      '@type': 'Organization',
      name: 'PetRecovery.org',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/cases/${caseData.id}`
    }
  };
}

/**
 * StructuredData Component
 * Renders JSON-LD script tag
 */
export function StructuredData({ data }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
