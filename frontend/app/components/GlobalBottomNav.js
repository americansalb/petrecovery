'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, PawPrint, Search, Users, Menu } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/pets', icon: PawPrint, label: 'My Pets' },
  { href: '/database', icon: Search, label: 'Search' },
  { href: '/rescue-squads/search', icon: Users, label: 'Squads' },
  { href: '/settings', icon: Menu, label: 'More' },
];

export default function GlobalBottomNav() {
  const pathname = usePathname();

  // Don't show on these routes
  const hideOnRoutes = [
    '/',           // Homepage
    '/login',
    '/register',
    '/mission-control', // Has its own nav
  ];

  const shouldHide = hideOnRoutes.some(route =>
    pathname === route || pathname.startsWith('/mission-control')
  );

  if (shouldHide) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 lg:hidden">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-blue-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area padding for phones with home indicators */}
      <div className="h-safe-area-inset-bottom bg-white" />
    </nav>
  );
}
