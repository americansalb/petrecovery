'use client';

/**
 * The tabs under the navbar on a Rescue Force's pages, for its members only
 * (app/rescue-forces/[id]/layout.js decides). Overview is the public page;
 * the rest are members-only. Settings is for founders and leaders.
 *
 * Before these tabs, a regular member had no way to reach the force's chat
 * or posts at all: the only links were leaders' "Settings" and "Divisions".
 */

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ForceTabs({ forceId, isLeader }) {
  const pathname = usePathname() || '';
  const activeRef = useRef(null);
  const base = `/rescue-forces/${forceId}`;
  const tabs = [
    { href: base, label: 'Overview', exact: true },
    { href: `${base}/updates`, label: 'Updates' },
    { href: `${base}/chat`, label: 'Chat' },
    { href: `${base}/members`, label: 'Members' },
    { href: `${base}/divisions`, label: 'Divisions' },
    ...(isLeader ? [{ href: `${base}/settings`, label: 'Settings' }] : []),
  ];

  // On a phone the tabs scroll sideways; keep the current one in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  return (
    <nav aria-label="Rescue Force" className="sticky top-16 z-30 border-b border-midnight-200 bg-white">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 [scrollbar-width:none] sm:px-4">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              ref={active ? activeRef : undefined}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`relative inline-flex shrink-0 items-center px-2.5 text-sm font-semibold transition sm:px-3 ${
                active ? 'text-midnight-900' : 'text-midnight-500 hover:text-midnight-800'
              }`}
            >
              {t.label}
              {active && <span className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-flash-400 sm:inset-x-3" aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
