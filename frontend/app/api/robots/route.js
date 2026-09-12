import { NextResponse } from 'next/server';

// The canonical host. middleware.js 301s petrecovery.org here, so declaring the
// old domain in a sitemap meant every URL Google fetched was a redirect.
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.reunitepets.org';

export async function GET() {
  const robotsTxt = `# ReunitePets Robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /auth/
Disallow: /dashboard
Disallow: /profile
Disallow: /settings/
# WanderGuesser: the lobby and the boards are worth indexing, a live
# game and an account page are not. A room and a share page are not
# listed here on purpose: they are built to unfurl in chat, the bots
# that draw those cards honour this file, and their own metadata
# already says noindex.
Disallow: /geo/play
Disallow: /geo/script/play
Disallow: /geo/me

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
