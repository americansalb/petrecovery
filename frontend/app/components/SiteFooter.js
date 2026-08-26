'use client';

/**
 * The site footer - the one footer, everywhere.
 *
 * History: the homepage rendered its own dark three-column footer and this
 * global one stacked directly beneath it, so scrolling to the bottom of /
 * showed two footers with different link sets. The richer design won and
 * lives here now; the homepage's local copy is gone.
 *
 * Deliberately not a second navbar: the links a person goes looking for at
 * the bottom of a page, and nothing else. Hidden inside immersive
 * takeovers, which own the whole screen and ship their own way out
 * (app/lib/navChrome.js).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isImmersiveRoute } from '@/app/lib/navChrome';
import { SUPPORT_EMAIL } from '@/app/lib/brand';

const DO_LINKS = [
  { href: '/report/new', label: 'Report a lost pet' },
  { href: '/report/found', label: 'Report a found pet' },
  { href: '/lost-and-found', label: 'Browse Lost & Found' },
  { href: '/rescue-forces/search', label: 'Find your Rescue Force' },
];

const EXPLORE_LINKS = [
  { href: '/care', label: 'Pet care & Health Book' },
  { href: '/shelters', label: 'Shelters' },
  { href: '/for-shelters', label: 'For shelters & rescues' },
  { href: '/hub', label: 'Rescue Hub' },
  { href: '/about', label: 'About' },
];

export default function SiteFooter() {
  const pathname = usePathname();
  if (isImmersiveRoute(pathname)) return null;

  return (
    <footer className="bg-midnight-950 border-t border-midnight-800">
      {/* pb clears the fixed mobile tab bar, as <main> does */}
      <div className="max-w-5xl mx-auto px-4 py-10 pb-24 lg:pb-10">
        <div className="grid sm:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="font-extrabold text-white text-lg mb-2">
              Reunite<span className="text-flash-400">Pets</span>
            </p>
            <p className="text-midnight-400 leading-relaxed">
              Coordinated search and rescue for lost pets, powered by
              neighbors. Free to use.
            </p>
          </div>
          <nav aria-label="Do something">
            <p className="font-bold text-midnight-200 mb-3">Do something</p>
            <ul className="space-y-2 text-midnight-400">
              {DO_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-flash-300 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Explore">
            <p className="font-bold text-midnight-200 mb-3">Explore</p>
            <ul className="space-y-2 text-midnight-400">
              {EXPLORE_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-flash-300 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="border-t border-midnight-800 mt-8 pt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-midnight-500">
          <span>&copy; {new Date().getFullYear()} ReunitePets.org</span>
          <span className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-midnight-300 transition-colors">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-midnight-300 transition-colors">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-midnight-300 transition-colors">
              Contact
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-midnight-300 transition-colors">
              {SUPPORT_EMAIL}
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
