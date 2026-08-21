'use client';

/**
 * The site footer.
 *
 * There was no footer on any page but the homepage: app/page.js renders a
 * FooterCta of its own and app/layout.js had nothing, so every other route
 * - the legal pages included - ended with no Privacy, no Terms, no way to
 * get in touch. That is the one place a visitor looks for those, and on a
 * service that asks people for their address and their phone number it is
 * not optional.
 *
 * Deliberately plain, and deliberately not a second navbar: the links a
 * person goes looking for at the bottom of a page, and nothing else.
 * Hidden inside immersive takeovers, which own the whole screen and ship
 * their own way out (app/lib/navChrome.js).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isImmersiveRoute } from '@/app/lib/navChrome';
import { SUPPORT_EMAIL } from '@/app/lib/brand';

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/lost-and-found', label: 'Lost & Found' },
  { href: '/shelters', label: 'Shelters' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/contact', label: 'Contact' },
];

export default function SiteFooter() {
  const pathname = usePathname();
  if (isImmersiveRoute(pathname)) return null;

  return (
    <footer className="border-t border-midnight-200 bg-white">
      {/* pb clears the fixed mobile tab bar, as <main> does */}
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24 lg:pb-8">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-midnight-600 hover:text-midnight-900 no-underline"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-midnight-500">
          <span className="font-semibold text-midnight-700">ReunitePets</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-midnight-900">
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}
