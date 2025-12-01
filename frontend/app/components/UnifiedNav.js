'use client';

/**
 * Unified Navigation Component
 *
 * Provides consistent navigation across all pages with:
 * - Clear breadcrumbs showing where you are
 * - Quick access to main sections
 * - Context-aware actions
 */

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function UnifiedNav({
  currentPage = 'dashboard',
  breadcrumbs = [],
  actions = []
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);

  // Determine active section from pathname
  const getActiveSection = () => {
    if (pathname?.includes('/cases/')) return 'cases';
    if (pathname?.includes('/rescue-squads/') || pathname?.includes('/squad')) return 'squads';
    if (pathname?.includes('/dashboard')) return 'dashboard';
    if (pathname?.includes('/report')) return 'report';
    return 'dashboard';
  };

  const activeSection = getActiveSection();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: '🏠' },
    { id: 'squads', label: 'My Squads', href: '/rescue-squads/my', icon: '👥' },
    { id: 'cases', label: 'Cases', href: '/cases', icon: '🔍' },
    { id: 'report', label: 'Report Lost Pet', href: '/report/create', icon: '🆘', highlight: true },
  ];

  if (!session) {
    return (
      <nav className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-bold text-lg">
            <img src="https://petrescue.b-cdn.net/Untitled%20design%20(12).svg" alt="" className="h-8" />
            PetRecovery
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-slate-300 hover:text-white transition">
              Login
            </Link>
            <Link href="/register" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-500 transition">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        {/* Main Nav Row */}
        <div className="flex items-center justify-between h-14">
          {/* Logo + Main Nav */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 text-white font-bold">
              <img src="https://petrescue.b-cdn.net/Untitled%20design%20(12).svg" alt="" className="h-7" />
              <span className="hidden sm:inline">PetRecovery</span>
            </Link>

            {/* Desktop Nav Items */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                    item.highlight
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : activeSection === item.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Side - User Menu */}
          <div className="flex items-center gap-3">
            {/* Quick Actions */}
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  action.primary
                    ? 'bg-cyan-500 text-white hover:bg-cyan-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {action.icon && <span>{action.icon}</span>}
                {action.label}
              </button>
            ))}

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                  {session.user?.name?.[0] || session.user?.email?.[0] || '?'}
                </div>
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-xl shadow-xl border border-slate-700 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-700">
                      <p className="text-white font-medium truncate">{session.user?.name || 'User'}</p>
                      <p className="text-slate-400 text-sm truncate">{session.user?.email}</p>
                    </div>
                    <Link href="/profile" className="block px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-white">
                      Profile Settings
                    </Link>
                    <Link href="/rescue-squads/my" className="block px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-white">
                      My Squads
                    </Link>
                    {session.user?.role === 'ADMIN' && (
                      <Link href="/admin" className="block px-4 py-2 text-amber-400 hover:bg-slate-700">
                        Admin Panel
                      </Link>
                    )}
                    <div className="border-t border-slate-700 mt-2 pt-2">
                      <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="w-full text-left px-4 py-2 text-red-400 hover:bg-slate-700"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="md:hidden p-2 text-slate-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Breadcrumbs Row (if provided) */}
        {breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 py-2 text-sm overflow-x-auto">
            {breadcrumbs.map((crumb, i) => (
              <div key={i} className="flex items-center gap-2 shrink-0">
                {i > 0 && <span className="text-slate-600">/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className="text-slate-400 hover:text-white transition">
                    {crumb.icon && <span className="mr-1">{crumb.icon}</span>}
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-white font-medium">
                    {crumb.icon && <span className="mr-1">{crumb.icon}</span>}
                    {crumb.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Nav Menu */}
      {showMenu && (
        <div className="md:hidden border-t border-slate-800 py-2">
          {navItems.map(item => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setShowMenu(false)}
              className={`flex items-center gap-3 px-4 py-3 ${
                activeSection === item.id ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

/**
 * Quick Nav Bar - Floating bottom nav for mobile
 * Shows on mobile when in Command Center or case pages
 */
export function QuickNavBar({
  showBack = true,
  onBack,
  centerContent,
  rightActions = []
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-4 py-3 z-40 safe-area-bottom md:hidden">
      <div className="flex items-center justify-between">
        {showBack && (
          <button
            onClick={onBack || (() => window.history.back())}
            className="p-2 text-slate-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {centerContent && (
          <div className="flex-1 text-center">
            {centerContent}
          </div>
        )}

        <div className="flex items-center gap-2">
          {rightActions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className={`p-2 rounded-xl ${
                action.primary
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {action.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Page Container - Wraps pages with consistent nav
 */
export function PageContainer({
  children,
  breadcrumbs = [],
  actions = [],
  className = ''
}) {
  return (
    <div className="min-h-screen bg-slate-950">
      <UnifiedNav breadcrumbs={breadcrumbs} actions={actions} />
      <main className={className}>
        {children}
      </main>
    </div>
  );
}
