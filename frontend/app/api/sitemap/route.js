import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { US_STATES } from '@/app/lib/usStates';

// The canonical host. middleware.js 301s petrecovery.org here, so declaring the
// old domain in a sitemap meant every URL Google fetched was a redirect.
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.reunitepets.org';

export async function GET() {
  try {
    // Get active cases for sitemap (using Case model)
    const cases = await prisma.case.findMany({
      where: { status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] } },
      // lastSeenAddress is needed to derive the /lost-pet/[city] entries below.
      select: { caseNumber: true, updatedAt: true, lastSeenAddress: true },
      take: 1000,
    });

    // Placeholder for legacy missions (model no longer exists)
    const missions = [];

    // Get rescue forces
    const squads = await prisma.rescueForce.findMany({
      where: { isActive: true, isDeleted: false },
      select: { id: true, updatedAt: true },
      take: 500,
    });

    // Static pages. Three entries here pointed at URLs that do not serve:
    // /cases 404s (only /cases/[caseNumber] exists), and /database and /found
    // are redirect stubs. Declaring a redirect or a 404 in a sitemap spends
    // crawl budget and is a quality signal against the site.
    const staticPages = [
      { url: '/', priority: 1.0, changefreq: 'daily' },
      { url: '/lost-and-found', priority: 0.9, changefreq: 'hourly' },
      { url: '/rescue-forces/search', priority: 0.8, changefreq: 'daily' },
      { url: '/report/new', priority: 0.8, changefreq: 'monthly' },
      { url: '/report/found', priority: 0.8, changefreq: 'monthly' },
      { url: '/shelters', priority: 0.7, changefreq: 'daily' },
      { url: '/for-shelters', priority: 0.6, changefreq: 'monthly' },
      { url: '/care', priority: 0.6, changefreq: 'monthly' },
      { url: '/advice', priority: 0.6, changefreq: 'weekly' },
      { url: '/hub', priority: 0.5, changefreq: 'daily' },
      { url: '/about', priority: 0.5, changefreq: 'monthly' },
      { url: '/legal/terms', priority: 0.3, changefreq: 'yearly' },
      { url: '/privacy', priority: 0.3, changefreq: 'yearly' },
    ];

    // The /lost-pet/[city] pages are the designated SEO surface and not one of
    // them was in the sitemap. Derive the list from cities that actually have
    // cases, so every URL declared here serves real content.
    // Only emit a slug the page will actually serve: /lost-pet/[location]
    // validates the state half against US_STATES and redirects anything else,
    // so a sitemap entry that fails that check is a self-inflicted redirect.
    const citySlugs = [...new Set(
      cases
        .map((c) => {
          const parts = String(c.lastSeenAddress || '').split(',');
          if (parts.length < 3) return null;             // need street, city, state
          const city = (parts[parts.length - 2] || '').trim();
          const state = (parts[parts.length - 1] || '').trim().slice(0, 2).toUpperCase();
          if (city.length < 2 || !US_STATES.includes(state)) return null;
          const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          if (!citySlug) return null;
          return `${citySlug}-${state.toLowerCase()}`;
        })
        .filter(Boolean)
    )];
    for (const slug of citySlugs) {
      staticPages.push({ url: `/lost-pet/${slug}`, priority: 0.7, changefreq: 'daily' });
    }

    const xml = generateSitemapXML(staticPages, cases, missions, squads);

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return NextResponse.json({ error: 'Failed to generate sitemap' }, { status: 500 });
  }
}

function generateSitemapXML(staticPages, cases, missions, squads) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Static pages
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>\n`;
  }

  // Cases
  for (const c of cases) {
    xml += `  <url>
    <loc>${BASE_URL}/cases/${c.caseNumber}</loc>
    <lastmod>${c.updatedAt.toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  }

  // Lost pet cases
  for (const c of missions) {
    xml += `  <url>
    <loc>${BASE_URL}/database/${c.caseNumber}</loc>
    <lastmod>${c.updatedAt.toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  }

  // Squads
  for (const s of squads) {
    xml += `  <url>
    <loc>${BASE_URL}/rescue-forces/${s.id}</loc>
    <lastmod>${s.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
  }

  xml += '</urlset>';
  return xml;
}
