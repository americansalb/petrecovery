/**
 * The game site's footer (NEXT_PUBLIC_SITE=geo only): where the pictures
 * and the country outlines come from, and the way back to ReunitePets.
 * On reunitepets.org the site's own footer follows the game's pages.
 */

import { isGameSite } from '@/app/lib/geo/site';

const HOME_URL = process.env.NEXT_PUBLIC_GEO_HOME_URL || 'https://www.reunitepets.org';

export default function GeoFooter() {
  if (!isGameSite()) return null;
  return (
    <footer className="border-t border-midnight-200 bg-midnight-50 text-xs text-midnight-500">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4">
        <p>Imagery from Google Street View and Apple Look Around, shown under their own terms. Country outlines from Natural Earth.</p>
        <a href={HOME_URL} className="font-semibold text-midnight-700 hover:underline">
          Made by ReunitePets
        </a>
      </div>
    </footer>
  );
}
