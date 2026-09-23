/**
 * The pet site's own address, for everything that has to be absolute:
 * links in emails and texts, flyer QR codes, canonical and OpenGraph
 * tags, the sitemap, and NextAuth's redirects and cookies (auth.js hands
 * it to NextAuth).
 *
 * It is built in, not configured. The address is a fact about the
 * product, not about the machine it runs on, and reading it from the
 * environment went wrong both ways before launch. NEXTAUTH_URL was set
 * to the Render hostname, so every password reset, sighting alert and
 * flyer QR code pointed at petrecovery.onrender.com, and signing out sent
 * people there. NEXT_PUBLIC_BASE_URL was never set, so every canonical
 * tag told search engines the real page was http://localhost:3000. The
 * game does the same for its own domain (app/lib/geo/meta.js).
 *
 * `next dev` is the one exception, so a link in a development email
 * opens the development server: http://localhost:3000, or NEXTAUTH_URL
 * for a developer on another port. Production, tests and a local
 * production build all get the real address.
 *
 * Enforced by __tests__/site-address.test.js.
 */

import { SITE_URL } from '@/app/lib/brand';

const DEV_ORIGIN = 'http://localhost:3000';

/**
 * The pet site's origin, with no trailing slash.
 *
 * @returns {string}
 */
export function getBaseUrl() {
  if (process.env.NODE_ENV !== 'development') return SITE_URL;
  try {
    return new URL(process.env.NEXTAUTH_URL || DEV_ORIGIN).origin;
  } catch {
    return DEV_ORIGIN;
  }
}

/**
 * The same address. Kept under this name because the routes that send
 * email import it, and their tests mock it by name.
 *
 * @returns {string}
 */
export function getEmailBaseUrl() {
  return getBaseUrl();
}
