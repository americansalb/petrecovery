'use client';

/**
 * Navigation Component - Redesigned
 *
 * Clean, modern navigation with easy access to all key features:
 * - Report Lost/Found Pet (prominent CTA)
 * - Find Rescue Squads
 * - My Pets
 * - My Squads
 * - Search Database
 */

import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [userSquads, setUserSquads] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  useEffect(() => {
    if (session?.user?.id) {
      loadUserSquads();
    }
  }, [session?.user?.id]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check if click is on a dropdown button (they have data-dropdown attribute)
      const isDropdownButton = e.target.closest('[data-dropdown]');
      if (!isDropdownButton && activeDropdown) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const loadUserSquads = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setUserSquads(data.squads || []);
      }
    } catch (err) {
      console.error('Error loading squads:', err);
    }
  };

  // Don't show nav on landing page
  if (pathname === '/') return null;

  // Hide nav on auth pages
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register') ||
                     pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password');
  if (isAuthPage) return null;

  // Guest Navigation
  if (!session) {
    return (
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 border-b-2 border-white/20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-black text-xl">
            <img src="https://petrescue.b-cdn.net/algogo.png" alt="PetRecovery" className="h-8 w-auto" />
            <span>PetRecovery</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/database" className="hidden sm:block px-4 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition">
              Search Pets
            </Link>
            <Link href="/rescue-squads/search" className="hidden sm:block px-4 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition">
              Find Squads
            </Link>
            <Link href="/login" className="px-4 py-2 text-white font-bold text-sm rounded-lg bg-white/15 border-2 border-white/30 hover:bg-white/25 transition">
              Login
            </Link>
            <Link href="/register" className="px-4 py-2 text-indigo-700 font-bold text-sm rounded-lg bg-white hover:bg-indigo-50 transition">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  const toggleDropdown = (name) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2 text-white font-black text-xl shrink-0">
              <img src="https://petrescue.b-cdn.net/algogo.png" alt="PetRecovery" className="h-8 w-auto" />
              <span className="hidden sm:inline">PetRecovery</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
              {/* Dashboard */}
              <Link
                href="/dashboard"
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                  pathname === '/dashboard'
                    ? 'bg-white/25 text-white'
                    : 'text-white/90 hover:bg-white/15 hover:text-white'
                }`}
              >
                Dashboard
              </Link>

              {/* My Pets Dropdown */}
              <div className="relative" data-dropdown="pets">
                <button
                  onClick={() => toggleDropdown('pets')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition flex items-center gap-1 ${
                    pathname.startsWith('/pets') || pathname.startsWith('/cases')
                      ? 'bg-white/25 text-white'
                      : 'text-white/90 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  My Pets
                  <svg className={`w-4 h-4 transition-transform ${activeDropdown === 'pets' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {activeDropdown === 'pets' && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50">
                    <Link href="/pets" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-indigo-50 transition">
                      <span className="text-xl">🏠</span>
                      <div>
                        <div className="font-semibold">My Pets</div>
                        <div className="text-xs text-gray-500">View all your pets</div>
                      </div>
                    </Link>
                    <Link href="/cases" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-indigo-50 transition">
                      <span className="text-xl">📋</span>
                      <div>
                        <div className="font-semibold">My Cases</div>
                        <div className="text-xs text-gray-500">Active lost/found reports</div>
                      </div>
                    </Link>
                    <div className="border-t border-gray-100 my-2" />
                    <Link href="/database" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-indigo-50 transition">
                      <span className="text-xl">🔍</span>
                      <div>
                        <div className="font-semibold">Search Database</div>
                        <div className="text-xs text-gray-500">Find lost & found pets</div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>

              {/* Squads Dropdown */}
              <div className="relative" data-dropdown="squads">
                <button
                  onClick={() => toggleDropdown('squads')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition flex items-center gap-1 ${
                    pathname.includes('/rescue-squads')
                      ? 'bg-white/25 text-white'
                      : 'text-white/90 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  Squads {userSquads.length > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">{userSquads.length}</span>}
                  <svg className={`w-4 h-4 transition-transform ${activeDropdown === 'squads' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {activeDropdown === 'squads' && (
                  <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50">
                    <Link href="/rescue-squads/search" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-indigo-50 transition">
                      <span className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg">🔍</span>
                      <div>
                        <div className="font-semibold">Find Rescue Squads</div>
                        <div className="text-xs text-gray-500">Join a squad near you</div>
                      </div>
                    </Link>

                    {userSquads.length > 0 && (
                      <>
                        <div className="border-t border-gray-100 my-2" />
                        <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">My Squads</div>
                        {userSquads.slice(0, 4).map(squad => (
                          <Link
                            key={squad.id}
                            href={`/rescue-squads/${squad.id}`}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition"
                          >
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                              {squad.name?.[0] || '?'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-800 truncate">{squad.name}</div>
                              <div className="text-xs text-gray-500">{squad.city}, {squad.state}</div>
                            </div>
                          </Link>
                        ))}
                        {userSquads.length > 4 && (
                          <div className="px-4 py-2 text-xs text-gray-500 text-center">
                            +{userSquads.length - 4} more squads
                          </div>
                        )}
                      </>
                    )}

                    {userSquads.length === 0 && (
                      <div className="px-4 py-4 text-center text-gray-500 text-sm">
                        <div className="mb-2">You haven't joined any squads yet</div>
                        <Link href="/rescue-squads/search" className="text-indigo-600 font-semibold hover:underline">
                          Find one near you →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Admin Dropdown */}
              {session?.user?.role === 'ADMIN' && (
                <div className="relative" data-dropdown="admin">
                  <button
                    onClick={() => toggleDropdown('admin')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/admin')
                        ? 'bg-white/25 text-white'
                        : 'text-white/90 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    Admin
                    <svg className={`w-4 h-4 transition-transform ${activeDropdown === 'admin' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {activeDropdown === 'admin' && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50">
                      <Link href="/admin" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-indigo-50 transition">
                        <span className="text-xl">📊</span>
                        <div>
                          <div className="font-semibold">Dashboard</div>
                          <div className="text-xs text-gray-500">Overview & stats</div>
                        </div>
                      </Link>
                      <Link href="/admin/rescue-squads" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-indigo-50 transition">
                        <span className="text-xl">🛡️</span>
                        <div>
                          <div className="font-semibold">Rescue Squads</div>
                          <div className="text-xs text-gray-500">Manage squads</div>
                        </div>
                      </Link>
                      <Link href="/admin/divisions" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-indigo-50 transition">
                        <span className="text-xl">📍</span>
                        <div>
                          <div className="font-semibold">Divisions</div>
                          <div className="text-xs text-gray-500">Geographic areas</div>
                        </div>
                      </Link>
                      <Link href="/admin/cases" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-indigo-50 transition">
                        <span className="text-xl">📋</span>
                        <div>
                          <div className="font-semibold">Cases</div>
                          <div className="text-xs text-gray-500">All lost/found cases</div>
                        </div>
                      </Link>
                      <div className="border-t border-gray-100 my-2" />
                      <Link href="/admin/analytics" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-indigo-50 transition">
                        <span className="text-xl">📈</span>
                        <div>
                          <div className="font-semibold">Analytics</div>
                          <div className="text-xs text-gray-500">Reports & metrics</div>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Side - Report Button & User Menu */}
            <div className="flex items-center gap-2">
              {/* Report Pet CTA - Desktop */}
              <div className="hidden md:block relative" data-dropdown="report">
                <button
                  onClick={() => toggleDropdown('report')}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
                >
                  <span>🆘</span>
                  Report Pet
                  <svg className={`w-4 h-4 transition-transform ${activeDropdown === 'report' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {activeDropdown === 'report' && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50">
                    <Link href="/report/new" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-red-50 transition">
                      <span className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white text-lg">😿</span>
                      <div>
                        <div className="font-bold text-red-600">Report Lost Pet</div>
                        <div className="text-xs text-gray-500">Get help finding your pet</div>
                      </div>
                    </Link>
                    <Link href="/found" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-emerald-50 transition">
                      <span className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg">🎉</span>
                      <div>
                        <div className="font-bold text-emerald-600">Report Found Pet</div>
                        <div className="text-xs text-gray-500">Help reunite a pet</div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>

              {/* User Menu - Desktop */}
              <div className="hidden lg:block relative" data-dropdown="user">
                <button
                  onClick={() => toggleDropdown('user')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/15 border-2 border-white/30 hover:bg-white/25 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                    {session.user.firstName?.[0] || session.user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-white font-semibold text-sm max-w-[100px] truncate">
                    {session.user.firstName || 'User'}
                  </span>
                  <svg className={`w-4 h-4 text-white transition-transform ${activeDropdown === 'user' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {activeDropdown === 'user' && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="font-bold text-gray-800">{session.user.firstName} {session.user.lastName}</div>
                      <div className="text-xs text-gray-500 truncate">{session.user.email}</div>
                    </div>
                    <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition">
                      <span>👤</span>
                      <span className="font-medium">My Profile</span>
                    </Link>
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition">
                      <span>📊</span>
                      <span className="font-medium">Dashboard</span>
                    </Link>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition"
                    >
                      <span>🚪</span>
                      <span className="font-medium">Sign Out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg bg-white/15 border-2 border-white/30 text-white"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div className={`fixed top-0 right-0 w-[300px] max-w-[85vw] h-full bg-white z-50 transform transition-transform duration-300 lg:hidden ${
        mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Mobile Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
              {session.user.firstName?.[0] || session.user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{session.user.firstName} {session.user.lastName}</div>
              <div className="text-sm opacity-80 truncate">{session.user.email}</div>
            </div>
          </div>
        </div>

        {/* Mobile Quick Actions */}
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/report/new"
              onClick={() => setMobileMenuOpen(false)}
              className="flex flex-col items-center gap-2 p-3 bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-xl shadow-lg"
            >
              <span className="text-2xl">😿</span>
              <span className="text-xs font-bold">Lost Pet</span>
            </Link>
            <Link
              href="/found"
              onClick={() => setMobileMenuOpen(false)}
              className="flex flex-col items-center gap-2 p-3 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl shadow-lg"
            >
              <span className="text-2xl">🎉</span>
              <span className="text-xs font-bold">Found Pet</span>
            </Link>
          </div>
        </div>

        {/* Mobile Nav Links */}
        <div className="py-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <MobileNavLink href="/dashboard" icon="📊" label="Dashboard" active={pathname === '/dashboard'} onClick={() => setMobileMenuOpen(false)} />
          <MobileNavLink href="/pets" icon="🏠" label="My Pets" active={pathname.startsWith('/pets')} onClick={() => setMobileMenuOpen(false)} />
          <MobileNavLink href="/cases" icon="📋" label="My Cases" active={pathname.startsWith('/cases')} onClick={() => setMobileMenuOpen(false)} />
          <MobileNavLink href="/database" icon="🔍" label="Search Database" active={pathname === '/database'} onClick={() => setMobileMenuOpen(false)} />

          <div className="border-t border-gray-100 my-2" />
          <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Rescue Squads</div>

          <MobileNavLink href="/rescue-squads/search" icon="🔎" label="Find Squads" active={pathname === '/rescue-squads/search'} onClick={() => setMobileMenuOpen(false)} />

          {userSquads.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">My Squads</div>
              {userSquads.slice(0, 5).map(squad => (
                <Link
                  key={squad.id}
                  href={`/rescue-squads/${squad.id}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                    {squad.name?.[0] || '?'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 truncate text-sm">{squad.name}</div>
                    <div className="text-xs text-gray-500">{squad.city}, {squad.state}</div>
                  </div>
                </Link>
              ))}
            </>
          )}

          {session?.user?.role === 'ADMIN' && (
            <>
              <div className="border-t border-gray-100 my-2" />
              <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Admin</div>
              <MobileNavLink href="/admin" icon="📊" label="Admin Dashboard" active={pathname === '/admin'} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink href="/admin/rescue-squads" icon="🛡️" label="Manage Squads" active={pathname === '/admin/rescue-squads'} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink href="/admin/divisions" icon="📍" label="Manage Divisions" active={pathname === '/admin/divisions'} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink href="/admin/cases" icon="📋" label="Manage Cases" active={pathname === '/admin/cases'} onClick={() => setMobileMenuOpen(false)} />
            </>
          )}
        </div>

        {/* Mobile Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-gray-50">
          <Link
            href="/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100"
          >
            <span>👤</span>
            <span className="font-medium">My Profile</span>
          </Link>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              signOut({ callbackUrl: '/' });
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50"
          >
            <span>🚪</span>
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
}

function MobileNavLink({ href, icon, label, active, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 transition ${
        active
          ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600'
          : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="font-semibold">{label}</span>
    </Link>
  );
}
