/**
 * The base URL for the game's link previews, from the request's host.
 * The site-wide base is reunitepets.org; the game can also be served on
 * a domain of its own (docs/GEO.md), and a share card built there must
 * point back at that domain. Server only.
 */

import { headers } from 'next/headers';
import { shareMetadataBase } from '@/app/lib/shareMetadata';

export function geoMetadataBase() {
  try {
    const h = headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return shareMetadataBase();
    const proto = h.get('x-forwarded-proto') || (/^(localhost|127\.0\.0\.1)/.test(host) ? 'http' : 'https');
    return new URL(`${proto}://${host}`);
  } catch {
    return shareMetadataBase();
  }
}
