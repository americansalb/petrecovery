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
  siteName = 'ReunitePets.org',
  twitterCard = 'summary_large_image',
  twitterSite = '@ReunitePetsOrg'
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
export function generateCaseMetadata(missionData) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.reunitepets.org';

  return {
    title: `Help Find ${missionData.petName}! - Missing ${missionData.petSpecies} | ReunitePets.org`,
    description: `${missionData.petSpecies} ${missionData.petBreed || ''} named ${missionData.petName} went missing near ${missionData.lastSeenAddress}. ${missionData.petDescription?.substring(0, 150)}...`,
    openGraph: {
      title: `Help Find ${missionData.petName}!`,
      description: `Missing ${missionData.petSpecies}: ${missionData.petName}. Last seen near ${missionData.lastSeenAddress}. Please share to help bring them home!`,
      url: `${baseUrl}/cases/${missionData.caseNumber}`,
      siteName: 'ReunitePets.org',
      images: missionData.petPhotoUrl ? [
        {
          url: missionData.petPhotoUrl,
          width: 1200,
          height: 630,
          alt: `Photo of ${missionData.petName}`,
        }
      ] : [],
      locale: 'en_US',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Help Find ${missionData.petName}!`,
      description: `Missing ${missionData.petSpecies}: ${missionData.petName}. Last seen near ${missionData.lastSeenAddress}.`,
      images: missionData.petPhotoUrl ? [missionData.petPhotoUrl] : [],
    },
    robots: {
      index: missionData.isPublic,
      follow: true,
    },
    alternates: {
      canonical: `${baseUrl}/cases/${missionData.caseNumber}`,
    },
  };
}

/**
 * Generate JSON-LD structured data for lost pets
 */
export function generateCaseStructuredData(missionData) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.reunitepets.org';

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Help Find ${missionData.petName}!`,
    description: `Missing ${missionData.petSpecies}: ${missionData.petName}. Last seen near ${missionData.lastSeenAddress}.`,
    image: missionData.petPhotoUrl || undefined,
    datePublished: missionData.createdAt,
    dateModified: missionData.updatedAt,
    author: {
      '@type': 'Organization',
      name: 'ReunitePets.org'
    },
    publisher: {
      '@type': 'Organization',
      name: 'ReunitePets.org',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/cases/${missionData.caseNumber}`
    }
  };
}

/**
 * StructuredData Component
 * Renders JSON-LD script tag
 */
export function StructuredData({ data }) {
  // SECURITY: JSON.stringify escapes " and \ but NOT < > & or the JS line
  // separators, so user-controlled fields (petName, address) could inject a
  // literal </script> and break out of this inline script (stored XSS on the
  // public case page). Escape the breakout chars to \uXXXX - still valid JSON,
  // no longer parseable as an HTML tag boundary.
  const safeJson = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  );
}
