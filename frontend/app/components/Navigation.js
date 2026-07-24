'use client';

/**
 * Navigation Component - Universal Nav Bar
 *
 * THE one top bar, identical on every route: same h-16 height, same links,
 * same Report CTA — content and size never change from page to page. It
 * only adapts to auth STATE (guests get Sign in/Join, members get their
 * menu), never to the route; the sole exception is the immersive-route
 * list in app/lib/navChrome.js (Mission Control ships its own chrome).
 * While the session is resolving, a fixed-size placeholder holds the
 * right-side slot so the bar never reflows after load.
 * Enforced by __tests__/global-chrome.test.js.
 */

import { useSession, signOut } from 'next-auth/react';
import AccountModeSwitcher from './AccountModeSwitcher';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Home,
  PawPrint,
  ClipboardList,
  Search,
  Users,
  Shield,
  MapPin,
  BarChart3,
  Bell,
  CheckCircle,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Settings,
  Building2,
  Database,
  Sparkles,
  LogIn,
  UserPlus,
  Megaphone,
  Heart,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { LOGO_ICON } from '@/lib/brandAssets';
import { isImmersiveRoute } from '@/app/lib/navChrome';

export default function Navigation() {
  const { data: session, status: sessionStatus } = useSession();
  const pathname = usePathname();
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

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      const isDropdownButton = e.target.closest('[data-dropdown]');
      if (!isDropdownButton && activeDropdown) {
        setActiveDropdown(null);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
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

  // The bar renders everywhere except intentional immersive takeovers
  // (shared policy in app/lib/navChrome.js) — auth pages included, so the
  // chrome never blinks in and out while moving through the site.
  if (isImmersiveRoute(pathname)) return null;

  const toggleDropdown = (name) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-midnight-900 border-b border-midnight-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Logo — explicit box so the bar never reflows while the CDN image
                loads; wordmark only where the full link set still fits */}
            <Link href="/" className="flex items-center gap-2.5 text-white font-bold text-xl shrink-0">
              <img src={LOGO_ICON} alt="ReunitePets" width={56} height={56} className="h-14 w-14 object-contain" />
              <span className="hidden sm:inline lg:hidden xl:inline">Reunite<span className="text-flash-400">Pets</span></span>
            </Link>

            {/* Desktop Navigation: one home per domain, same for guests and members */}
            <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
              {/* My Pets is daily life (medications, profiles): first-class, always */}
              {session && (
                <NavLink href="/pets" active={pathname.startsWith('/pets')}>
                  <PawPrint className="w-4 h-4" />
                  My Pets
                </NavLink>
              )}

              {/* The everyday door, a peer of Lost & Found and visible to all:
                  this is how a first-time visitor learns the Health Book exists */}
              <NavLink href="/care" active={pathname.startsWith('/care')}>
                <Heart className="w-4 h-4" />
                Pet Care
              </NavLink>

              <NavLink href="/lost-and-found" active={pathname.startsWith('/lost-and-found') || pathname.startsWith('/cases')}>
                <Search className="w-4 h-4" />
                Lost &amp; Found
              </NavLink>

              {/* Always the same trigger — the user's squads only change what's
                  INSIDE the dropdown, never the size or shape of the bar */}
              <NavDropdown
                label="Rescue Forces"
                icon={Shield}
                active={pathname.startsWith('/rescue-forces') || pathname.startsWith('/divisions')}
                isOpen={activeDropdown === 'squads'}
                onToggle={() => toggleDropdown('squads')}
              >
                {userSquads.length > 0 && (
                  <>
                    <div className="max-h-64 overflow-y-auto">
                      {userSquads.map(squad => (
                        <Link
                          key={squad.id}
                          href={`/rescue-forces/${squad.id}`}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-midnight-50 transition"
                        >
                          <div className="w-8 h-8 rounded-lg bg-midnight-900 text-white flex items-center justify-center text-sm font-bold">
                            {squad.name?.[0] || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-midnight-900 truncate">{squad.name}</div>
                            <div className="text-xs text-midnight-500">{squad.city}, {squad.state}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <DropdownDivider />
                  </>
                )}
                <DropdownLink href="/rescue-forces/search" icon={Search} title="Find rescue forces" description="Every neighborhood needs one" />
                <DropdownLink href="/rescue-forces/create" icon={Shield} title="Start a rescue force" description="Organize your city's searchers" />
              </NavDropdown>

              <NavLink href="/hub" active={pathname.startsWith('/hub')}>
                <Sparkles className="w-4 h-4" />
                Hub
              </NavLink>

              {/* Admin tooling lives in the user menu, not the bar: the
                  bar's link set is identical for every role */}
            </div>

            {/* Right Side — CTA first so it never moves; everything that
                depends on the session renders to its right */}
            <div className="flex items-center gap-2">
              {/* Report Pet CTA - on every page, always the same size */}
              <div className="hidden md:block relative" data-dropdown="report">
                <button
                  onClick={() => toggleDropdown('report')}
                  aria-haspopup="true"
                  aria-expanded={activeDropdown === 'report'}
                  className="flex items-center gap-2 px-4 py-2 bg-flash-400 hover:bg-flash-500 text-midnight-900 font-bold text-sm rounded-xl transition-all whitespace-nowrap"
                >
                  <Megaphone className="w-4 h-4" />
                  Report Pet
                  <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'report' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'report' && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-midnight-100 py-2 z-50">
                    <Link href="/report/new" className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition">
                      <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                        <Megaphone className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-red-600">Report Lost Pet</div>
                        <div className="text-xs text-midnight-500">Get help finding your pet</div>
                      </div>
                    </Link>
                    <Link href="/report/found" className="flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-green-600">Report Found Pet</div>
                        <div className="text-xs text-midnight-500">Help reunite a pet</div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>

              {sessionStatus === 'loading' ? (
                /* Placeholder with the footprint of the bell + user chip so
                   the bar settles without shifting once the session resolves */
                <div className="hidden lg:block w-40 h-9 rounded-xl bg-midnight-800 animate-pulse" aria-hidden="true" />
              ) : session ? (
                <>
                  {/* Notifications bell - logged-in only */}
                  <NotificationBell active={pathname.startsWith('/notifications')} />

                  {/* User Menu - Desktop (logged in) */}
                  <div className="hidden lg:block relative" data-dropdown="user">
                    <button
                      onClick={() => toggleDropdown('user')}
                      aria-haspopup="true"
                      aria-expanded={activeDropdown === 'user'}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-midnight-800 hover:bg-midnight-700 transition"
                    >
                      <div className="w-8 h-8 rounded-lg bg-flash-400 flex items-center justify-center text-midnight-900 font-bold text-sm">
                        {session.user.firstName?.[0] || session.user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="hidden xl:inline text-white font-medium text-sm max-w-[100px] truncate">
                        {session.user.firstName || 'User'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-midnight-400 transition-transform ${activeDropdown === 'user' ? 'rotate-180' : ''}`} />
                    </button>
                    {activeDropdown === 'user' && (
                      <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-midnight-100 py-2 z-50 max-h-[calc(100vh-5rem)] overflow-y-auto">
                        <div className="px-4 py-3 border-b border-midnight-100">
                          <div className="font-semibold text-midnight-900">{session.user.firstName} {session.user.lastName}</div>
                          <div className="text-xs text-midnight-500 truncate">{session.user.email}</div>
                        </div>
                        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition">
                          <Home className="w-4 h-4" />
                          <span className="font-medium">Dashboard</span>
                        </Link>
                        <Link href="/pets" className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition">
                          <PawPrint className="w-4 h-4" />
                          <span className="font-medium">My Pets</span>
                        </Link>
                        {/* Messages hidden pre-launch: no conversation is created yet,
                            so the inbox would be a guaranteed-empty dead-end. */}
                        {/* Renders only for people who hold more than one
                            hat; everyone else sees an unchanged menu. */}
                        <AccountModeSwitcher current="owner" onNavigate={() => setActiveDropdown(null)} />
                        <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition">
                          <User className="w-4 h-4" />
                          <span className="font-medium">My Profile</span>
                        </Link>
                        <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition">
                          <Settings className="w-4 h-4" />
                          <span className="font-medium">Settings</span>
                        </Link>
                        {session?.user?.role === 'ADMIN' && (
                          <>
                            <div className="border-t border-midnight-100 my-1" />
                            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-midnight-500 uppercase tracking-wider">
                              Admin
                            </div>
                            <Link href="/admin" className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition">
                              <BarChart3 className="w-4 h-4" />
                              <span className="font-medium">Admin Dashboard</span>
                            </Link>
                            <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition">
                              <Users className="w-4 h-4" />
                              <span className="font-medium">Users</span>
                            </Link>
                            <Link href="/admin/missions" className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition">
                              <ClipboardList className="w-4 h-4" />
                              <span className="font-medium">Missions</span>
                            </Link>
                            <Link href="/admin/rescue-forces" className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition">
                              <Shield className="w-4 h-4" />
                              <span className="font-medium">Rescue Forces</span>
                            </Link>
                            <Link href="/admin/analytics" className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition">
                              <BarChart3 className="w-4 h-4" />
                              <span className="font-medium">Analytics</span>
                            </Link>
                          </>
                        )}
                        <div className="border-t border-midnight-100 my-1" />
                        <button
                          onClick={() => signOut({ callbackUrl: '/' })}
                          className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="font-medium">Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Guest: Sign in + Join */
                <div className="hidden lg:flex items-center gap-2">
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="text-white hover:bg-midnight-800 whitespace-nowrap">
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm" className="whitespace-nowrap">Join</Button>
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl bg-midnight-800 text-white hover:bg-midnight-700 transition"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-midnight-950/60 backdrop-blur-sm z-[100] lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div className={`fixed top-0 right-0 w-[300px] max-w-[85vw] h-full bg-white z-[110] transform transition-transform duration-300 ease-out lg:hidden ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
        {/* Mobile Header */}
        <div className="bg-midnight-900 p-4 text-white">
          {session ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-flash-400 flex items-center justify-center text-midnight-900 font-bold text-lg">
                {session.user.firstName?.[0] || session.user.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{session.user.firstName} {session.user.lastName}</div>
                <div className="text-sm text-midnight-400 truncate">{session.user.email}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src={LOGO_ICON} alt="ReunitePets" className="h-10 w-auto" />
                <span className="font-bold text-lg">Reunite<span className="text-flash-400">Pets</span></span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="p-1 rounded-lg hover:bg-midnight-800 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile Quick Actions - Always visible */}
        <div className="p-4 bg-midnight-50 border-b border-midnight-200">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/report/new"
              onClick={() => setMobileMenuOpen(false)}
              className="flex flex-col items-center gap-2 p-3 bg-red-700 text-white rounded-xl"
            >
              <Megaphone className="w-5 h-5" />
              <span className="text-xs font-semibold">Lost Pet</span>
            </Link>
            <Link
              href="/report/found"
              onClick={() => setMobileMenuOpen(false)}
              className="flex flex-col items-center gap-2 p-3 bg-green-700 text-white rounded-xl"
            >
              <CheckCircle className="w-5 h-5" />
              <span className="text-xs font-semibold">Found Pet</span>
            </Link>
          </div>
        </div>

        {/* Mobile Nav Links */}
        <div className="py-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {/* Browse section - Always visible */}
          <div className="px-4 py-2 text-xs font-semibold text-midnight-500 uppercase tracking-wider">
            Browse
          </div>
          <MobileNavLink href="/care" icon={Heart} label="Pet Care" active={pathname.startsWith('/care')} onClick={() => setMobileMenuOpen(false)} />
          <MobileNavLink href="/lost-and-found" icon={Search} label="Lost & Found" active={pathname.startsWith('/lost-and-found')} onClick={() => setMobileMenuOpen(false)} />
          <MobileNavLink href="/shelters" icon={Building2} label="Find Shelters" active={pathname === '/shelters'} onClick={() => setMobileMenuOpen(false)} />
          <MobileNavLink href="/rescue-forces/search" icon={Users} label="Find Rescue Forces" active={pathname === '/rescue-forces/search'} onClick={() => setMobileMenuOpen(false)} />

          <div className="border-t border-midnight-100 my-2" />
          <div className="px-4 py-2 text-xs font-semibold text-midnight-500 uppercase tracking-wider">
            Community
          </div>
          <MobileNavLink href="/hub" icon={Sparkles} label="Rescue Hub" active={pathname.startsWith('/hub')} onClick={() => setMobileMenuOpen(false)} />

          {/* Auth-only section */}
          {session && (
            <>
              <div className="border-t border-midnight-100 my-2" />
              <div className="px-4 py-2 text-xs font-semibold text-midnight-500 uppercase tracking-wider">
                My Account
              </div>
              <MobileNavLink href="/dashboard" icon={Home} label="Dashboard" active={pathname === '/dashboard'} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink href="/notifications" icon={Bell} label="Notifications" active={pathname.startsWith('/notifications')} onClick={() => setMobileMenuOpen(false)} />
              {/* Messages hidden pre-launch (guaranteed-empty until conversations are wired). */}
              <MobileNavLink href="/pets" icon={PawPrint} label="My Pets" active={pathname.startsWith('/pets')} onClick={() => setMobileMenuOpen(false)} />
              <AccountModeSwitcher current="owner" onNavigate={() => setMobileMenuOpen(false)} />
              <MobileNavLink href="/settings" icon={Settings} label="Settings" active={pathname.startsWith('/settings')} onClick={() => setMobileMenuOpen(false)} />

              {userSquads.length > 0 && (
                <>
                  <div className="border-t border-midnight-100 my-2" />
                  <div className="px-4 py-2 text-xs font-semibold text-midnight-500 uppercase tracking-wider">
                    My Rescue Forces
                  </div>
                  {userSquads.slice(0, 5).map(squad => (
                    <Link
                      key={squad.id}
                      href={`/rescue-forces/${squad.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-midnight-50"
                    >
                      <div className="w-8 h-8 rounded-lg bg-midnight-900 text-white flex items-center justify-center text-sm font-bold">
                        {squad.name?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-midnight-900 truncate text-sm">{squad.name}</div>
                        <div className="text-xs text-midnight-500">{squad.city}, {squad.state}</div>
                      </div>
                    </Link>
                  ))}
                </>
              )}

              {session?.user?.role === 'ADMIN' && (
                <>
                  <div className="border-t border-midnight-100 my-2" />
                  <div className="px-4 py-2 text-xs font-semibold text-midnight-500 uppercase tracking-wider">
                    Admin
                  </div>
                  <MobileNavLink href="/admin" icon={BarChart3} label="Admin Dashboard" active={pathname === '/admin'} onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/admin/users" icon={Users} label="Manage Users" active={pathname === '/admin/users'} onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/admin/pets" icon={PawPrint} label="Manage Pets" active={pathname === '/admin/pets'} onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/admin/rescue-forces" icon={Shield} label="Manage Rescue Forces" active={pathname === '/admin/rescue-forces'} onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/admin/divisions" icon={MapPin} label="Manage Divisions" active={pathname === '/admin/divisions'} onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/admin/missions" icon={ClipboardList} label="Manage Missions" active={pathname === '/admin/missions'} onClick={() => setMobileMenuOpen(false)} />
                </>
              )}
            </>
          )}
        </div>

        {/* Mobile Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-midnight-200 bg-midnight-50">
          {session ? (
            <>
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-100"
              >
                <User className="w-5 h-5" />
                <span className="font-medium">My Profile</span>
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut({ callbackUrl: '/' });
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </>
          ) : (
            <div className="p-4 flex gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-midnight-300 text-midnight-700 rounded-xl font-medium hover:bg-midnight-100 transition"
              >
                <LogIn className="w-4 h-4" />
                Login
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-flash-400 text-midnight-900 rounded-xl font-bold hover:bg-flash-500 transition"
              >
                <UserPlus className="w-4 h-4" />
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// --- Sub-components ---

function NotificationBell({ active }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/notifications?limit=1');
        if (res.ok) {
          const data = await res.json();
          if (alive) setUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        // The bell is decoration when offline; never let it throw
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      className={`relative p-2 rounded-xl transition ${active ? 'bg-midnight-800 text-white' : 'text-midnight-300 hover:bg-midnight-800 hover:text-white'}`}
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-flash-400 text-midnight-900 text-[10px] font-bold rounded-full flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

function NavLink({ href, active, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 px-3 xl:px-4 py-2 text-sm font-medium rounded-xl transition whitespace-nowrap ${active
        ? 'bg-midnight-800 text-white'
        : 'text-midnight-300 hover:bg-midnight-800 hover:text-white'
        }`}
    >
      {children}
    </Link>
  );
}

function NavDropdown({ label, icon: Icon, active, isOpen, onToggle, children }) {
  return (
    <div className="relative" data-dropdown={label.toLowerCase()}>
      <button
        onClick={onToggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex items-center gap-2 px-3 xl:px-4 py-2 text-sm font-medium rounded-xl transition whitespace-nowrap ${active
          ? 'bg-midnight-800 text-white'
          : 'text-midnight-300 hover:bg-midnight-800 hover:text-white'
          }`}
      >
        <Icon className="w-4 h-4" />
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-midnight-100 py-2 z-50">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownLink({ href, icon: Icon, title, description, iconBg = 'bg-midnight-100' }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-midnight-50 transition">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-midnight-600" />
      </div>
      <div>
        <div className="font-medium text-midnight-900">{title}</div>
        <div className="text-xs text-midnight-500">{description}</div>
      </div>
    </Link>
  );
}

function DropdownDivider() {
  return <div className="border-t border-midnight-100 my-2" />;
}

function MobileNavLink({ href, icon: Icon, label, active, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 px-4 py-3 transition ${active
        ? 'bg-flash-50 text-midnight-900 border-l-4 border-flash-400'
        : 'text-midnight-700 hover:bg-midnight-50 border-l-4 border-transparent'
        }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
