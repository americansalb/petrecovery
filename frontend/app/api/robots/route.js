import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://petrecovery.org';

export async function GET() {
  const robotsTxt = `# PetRecovery.org Robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /auth/
Disallow: /dashboard
Disallow: /profile
Disallow: /settings/

# Crawl delay
Crawl-delay: 1

# Sitemaps
Sitemap: ${BASE_URL}/api/sitemap
Sitemap: ${BASE_URL}/sitemap.xml
`;

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
