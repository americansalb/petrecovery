'use client';

/**
 * Arriving on a page.
 *
 * Next re-mounts a template on every navigation and keeps the layout,
 * so the game's bar holds still (it lives in layout.js) and only what
 * is under it arrives. Before this, every move between the game's pages
 * was a hard swap: measured frame by frame on the live site, the new
 * page was simply there on the next frame, with nothing in between.
 *
 * The round and the room are `fixed inset-0`, and a transform on an
 * ancestor becomes the containing block for fixed descendants - for as
 * long as it runs, it would shrink the whole game screen to the height
 * of this wrapper. So those fade and never move (motion.css, rule 2).
 * Every other page rises into place.
 */

import { usePathname } from 'next/navigation';
import { isGameTakeover } from '@/app/lib/geo/site';

export default function GeoTemplate({ children }) {
  const pathname = usePathname() || '';
  return (
    <div className={isGameTakeover(pathname) ? 'pe-page-enter--takeover' : 'pe-page-enter'}>
      {children}
    </div>
  );
}
