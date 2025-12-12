import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://petrecovery.org';

export async function GET() {
  try {
    // Get active cases for sitemap (using Case model)
    const cases = await prisma.case.findMany({
      where: { status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] } },
      select: { missionNumber: true, updatedAt: true },
      take: 1000,
    });

    // Placeholder for legacy missions (model no longer exists)
    const missions = [];

    // Get rescue squads
    const squads = await prisma.rescueSquad.findMany({
      where: { isActive: true, isDeleted: false },
      select: { id: true, updatedAt: true },
      take: 500,
    });

    // Static pages
    const staticPages = [
      { url: '/', priority: 1.0, changefreq: 'daily' },
      { url: '/cases', priority: 0.9, changefreq: 'hourly' },
      { url: '/rescue-squads', priority: 0.8, changefreq: 'daily' },
      { url: '/database', priority: 0.7, changefreq: 'daily' },
      { url: '/advice', priority: 0.6, changefreq: 'weekly' },
      { url: '/about', priority: 0.5, changefreq: 'monthly' },
      { url: '/found', priority: 0.8, changefreq: 'daily' },
    ];

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
    <loc>${BASE_URL}/cases/${c.missionNumber}</loc>
    <lastmod>${c.updatedAt.toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  }

  // Lost pet cases
  for (const c of missions) {
    xml += `  <url>
    <loc>${BASE_URL}/database/${c.missionNumber}</loc>
    <lastmod>${c.updatedAt.toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  }

  // Squads
  for (const s of squads) {
    xml += `  <url>
    <loc>${BASE_URL}/rescue-squads/${s.id}</loc>
    <lastmod>${s.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
  }

  xml += '</urlset>';
  return xml;
}
