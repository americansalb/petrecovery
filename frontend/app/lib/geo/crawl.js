/**
 * What the game's own domain tells crawlers: its robots.txt and its
 * sitemap. The pet site's routes serve these when the request is for one
 * of the game's hosts (GAME_HOSTNAMES in ./site.js), and they move out
 * with the game.
 *
 * Both were the pet site's before: robots.txt began "# ReunitePets
 * Robots.txt", pointed at sitemaps on reunitepets.org and disallowed
 * /api/, which covers the game's share-card image (/api/geo/og). X drops
 * a card whose image robots.txt blocks, so a shared game unfurled there
 * without its picture. The sitemap listed 57 reunitepets.org addresses
 * and none of the game's.
 */

import { GEO_HOME_URL } from './meta';

/**
 * An account page and the admin screen are not worth a crawler's time.
 * Rooms, share pages and play links are allowed on purpose: they are
 * built to unfurl in chat (probablyearth.com/daily, a challenge link),
 * the bots that draw those cards honour this file, and the pages' own
 * metadata already says noindex. Play links used to be disallowed here,
 * so a pasted daily had no card at all on those bots.
 */
export function gameRobotsTxt(origin = GEO_HOME_URL) {
  return `# Probably Earth
User-agent: *
Allow: /geo
Allow: /api/geo/og
Disallow: /api/
Disallow: /geo/me
Disallow: /geo/admin

Sitemap: ${origin}/sitemap.xml
`;
}

/**
 * The one page that asks to be indexed is the front door (app/geo/page.js).
 * Every other game page is noindex, and a sitemap that lists noindex
 * pages contradicts itself.
 */
export function gameSitemapXml(origin = GEO_HOME_URL) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/geo</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
}
