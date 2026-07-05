'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Search, Shield, PawPrint, Plus } from 'lucide-react';
import { hidesBottomNav } from '@/app/lib/navChrome';

const leftItems = [
  { href: '/dashboard', icon: Home, label: 'Home', exact: true },
  { href: '/pets', icon: PawPrint, label: 'My Pets' },
];

const rightItems = [
  { href: '/lost-and-found', icon: Search, label: 'Lost & Found', alsoActive: ['/cases'] },
  { href: '/rescue-forces/search', icon: Shield, label: 'Forces', alsoActive: ['/rescue-forces'] },
];

export default function GlobalBottomNav() {
  const pathname = usePathname();

  // Shared chrome policy (app/lib/navChrome.js): hidden only inside
  // immersive takeovers and focused flows whose own fixed bars would
  // collide with this one. Everywhere else this bar is always present.
  if (hidesBottomNav(pathname)) return null;

  const renderItem = (item) => {
    const isActive = item.exact
      ? pathname === item.href
      : pathname.startsWith(item.href) || (item.alsoActive || []).some((p) => pathname.startsWith(p));
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
          isActive ? 'text-midnight-900' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
        <span className={`text-[11px] mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 lg:hidden">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {leftItems.map(renderItem)}

        {/* Report: the one action that matters most, front and center */}
        <Link
          href="/report/new"
          aria-label="Report a pet"
          className="flex flex-col items-center justify-center flex-1 h-full -mt-6"
        >
          <span className="w-14 h-14 rounded-full bg-flash-400 border-4 border-white shadow-lg shadow-flash-400/40 flex items-center justify-center text-midnight-900 active:scale-95 transition-transform">
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </span>
          <span className="text-[11px] mt-0.5 font-semibold text-midnight-900">Report</span>
        </Link>

        {rightItems.map(renderItem)}
      </div>
      {/* Safe area padding for phones with home indicators */}
      <div className="h-safe-area-inset-bottom bg-white" />
    </nav>
  );
}
