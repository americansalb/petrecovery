'use client';

/**
 * The shelter portal chrome: midnight sidebar on desktop, midnight top
 * bar + section tabs on mobile. This is a registered immersive takeover
 * (navChrome.js), so the universal consumer navbar does not render here
 * and this shell is the ONLY chrome. "Exit to ReunitePets" is the one
 * door back to the consumer site.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, PawPrint, Radar, Inbox, Users, Globe2, ArrowLeft,
  Building2, ShieldCheck,
} from 'lucide-react';

const NAV = [
  { href: '/my-shelter', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/my-shelter/animals', label: 'Animals', icon: PawPrint },
  { href: '/my-shelter/matches', label: 'Matches', icon: Radar, badge: 'matches' },
  { href: '/my-shelter/inquiries', label: 'Inquiries', icon: Inbox, badge: 'inquiries' },
  { href: '/my-shelter/team', label: 'Team', icon: Users },
  { href: '/my-shelter/site', label: 'Your page', icon: Globe2 },
];

const ROLE_LABELS = { OWNER: 'Owner', MANAGER: 'Manager', STAFF: 'Staff' };

function isActive(pathname, item) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export default function PortalShell({ shelter, role, pendingMatches, newInquiries = 0, userName, children }) {
  const pathname = usePathname();

  const badgeCounts = { matches: pendingMatches, inquiries: newInquiries };
  const items = NAV.map((item) => ({
    ...item,
    active: isActive(pathname, item),
    badgeCount: badgeCounts[item.badge] || 0,
  }));

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-gradient-to-b from-[#0a1526] via-midnight-900 to-[#0c1a30] text-white sticky top-0 h-screen">
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-flash-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-midnight-900" />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-[15px] leading-tight truncate">{shelter.name}</p>
              <p className="text-xs text-midnight-300 flex items-center gap-1">
                {shelter.city}, {shelter.state}
                {shelter.isVerified && <ShieldCheck className="w-3 h-3 text-blue-300" />}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map(({ href, label, icon: Icon, active, badgeCount }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                active
                  ? 'bg-flash-400 text-midnight-900'
                  : 'text-midnight-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className="flex-1">{label}</span>
              {badgeCount > 0 && (
                <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${active ? 'bg-midnight-900 text-flash-400' : 'bg-flash-400 text-midnight-900'}`}>
                  {badgeCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          {userName && (
            <p className="text-xs text-midnight-300 mb-2 truncate">
              {userName} · {ROLE_LABELS[role] || role}
            </p>
          )}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-midnight-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Exit to ReunitePets
          </Link>
        </div>
      </aside>

      {/* ---------- Mobile chrome ---------- */}
      <div className="lg:hidden sticky top-0 z-40">
        <div className="bg-midnight-900 text-white px-4 pt-3 pb-2 flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-flash-400 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-midnight-900" />
          </span>
          <p className="font-bold text-sm flex-1 truncate">{shelter.name}</p>
          <Link href="/" aria-label="Exit to ReunitePets" className="text-midnight-300 hover:text-white p-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
        <nav className="bg-midnight-900 border-b border-white/10 px-2 pb-2 flex gap-1 overflow-x-auto">
          {items.map(({ href, label, active, badgeCount }) => (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                active ? 'bg-flash-400 text-midnight-900' : 'text-midnight-200 hover:bg-white/10'
              }`}
            >
              {label}
              {badgeCount > 0 && <span className="ml-1.5 text-xs font-bold">({badgeCount})</span>}
            </Link>
          ))}
        </nav>
      </div>

      {/* ---------- Content ---------- */}
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 py-6 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
