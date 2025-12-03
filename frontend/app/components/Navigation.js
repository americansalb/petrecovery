'use client';

/**
 * Navigation Component - Phase 2 Redesign
 *
 * Clean, modern navigation using PetRecovery Design System:
 * - Midnight Blue background (solid, not gradient)
 * - Lucide icons instead of emojis
 * - Flashlight Yellow for CTAs
 * - Consistent with new UI component library
 */

import { useSession, signOut } from 'next-auth/react';
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
} from 'lucide-react';
import { Button, Badge, CountBadge } from '@/components/ui';

export default function Navigation() {
  const { data: session } = useSession();
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
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

  const toggleDropdown = (name) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  // Guest Navigation
  if (!session) {
    return (
      <nav className="sticky top-0 z-50 bg-midnight-900 border-b border-midnight-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-white font-bold text-xl">
            <img src="https://petrescue.b-cdn.net/Untitled%20design%20(12).svg" alt="PetRecovery" className="h-8 w-auto" />
            <span>PetRecovery</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/database" className="hidden sm:flex items-center gap-2 px-4 py-2 text-midnight-300 hover:text-white font-medium text-sm rounded-lg hover:bg-midnight-800 transition">
              <Search className="w-4 h-4" />
              Search Pets
            </Link>
            <Link href="/rescue-squads/search" className="hidden sm:flex items-center gap-2 px-4 py-2 text-midnight-300 hover:text-white font-medium text-sm rounded-lg hover:bg-midnight-800 transition">
              <Users className="w-4 h-4" />
              Find Squads
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-white hover:bg-midnight-800">
                Login
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Sign Up</Button>
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="sticky top-0 z-50 bg-midnight-900 border-b border-midnight-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2.5 text-white font-bold text-xl shrink-0">
              <img src="https://petrescue.b-cdn.net/Untitled%20design%20(12).svg" alt="PetRecovery" className="h-8 w-auto" />
              <span className="hidden sm:inline">PetRecovery</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
              {/* Dashboard */}
              <NavLink href="/dashboard" active={pathname === '/dashboard'}>
                <Home className="w-4 h-4" />
                Dashboard
              </NavLink>

              {/* My Pets Dropdown */}
              <NavDropdown
                label="My Pets"
                icon={PawPrint}
                active={pathname.startsWith('/pets') || pathname.startsWith('/cases')}
                isOpen={activeDropdown === 'pets'}
                onToggle={() => toggleDropdown('pets')}
              >
                <DropdownLink href="/pets" icon={PawPrint} title="My Pets" description="View all your pets" />
                <DropdownLink href="/cases" icon={ClipboardList} title="My Cases" description="Active lost/found reports" />
                <DropdownDivider />
                <DropdownLink href="/database" icon={Search} title="Search Database" description="Find lost & found pets" />
              </NavDropdown>

              {/* Squads Dropdown */}
              <NavDropdown
                label="Squads"
                icon={Shield}
                active={pathname.includes('/rescue-squads')}
                isOpen={activeDropdown === 'squads'}
                onToggle={() => toggleDropdown('squads')}
                badge={userSquads.length > 0 ? userSquads.length : null}
              >
                <DropdownLink
                  href="/rescue-squads/search"
                  icon={Search}
                  title="Find Rescue Squads"
                  description="Join a squad near you"
                  iconBg="bg-midnight-800"
                />

                {userSquads.length > 0 && (
                  <>
                    <DropdownDivider />
                    <div className="px-4 py-2 text-xs font-semibold text-midnight-400 uppercase tracking-wider">
                      My Squads
                    </div>
                    {userSquads.slice(0, 4).map(squad => (
                      <Link
                        key={squad.id}
                        href={`/rescue-squads/${squad.id}`}
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
                    {userSquads.length > 4 && (
                      <div className="px-4 py-2 text-xs text-midnight-500 text-center">
                        +{userSquads.length - 4} more squads
                      </div>
                    )}
                  </>
                )}

                {userSquads.length === 0 && (
                  <div className="px-4 py-4 text-center text-midnight-500 text-sm">
                    <div className="mb-2">You haven't joined any squads yet</div>
                    <Link href="/rescue-squads/search" className="text-midnight-900 font-semibold hover:text-flash-600">
                      Find one near you →
                    </Link>
                  </div>
                )}
              </NavDropdown>

              {/* Admin Dropdown */}
              {session?.user?.role === 'ADMIN' && (
                <NavDropdown
                  label="Admin"
                  icon={Settings}
                  active={pathname.startsWith('/admin')}
                  isOpen={activeDropdown === 'admin'}
                  onToggle={() => toggleDropdown('admin')}
                >
                  <DropdownLink href="/admin" icon={BarChart3} title="Dashboard" description="Overview & stats" />
                  <DropdownLink href="/admin/rescue-squads" icon={Shield} title="Rescue Squads" description="Manage squads" />
                  <DropdownLink href="/admin/divisions" icon={MapPin} title="Divisions" description="Geographic areas" />
                  <DropdownLink href="/admin/cases" icon={ClipboardList} title="Cases" description="All lost/found cases" />
                  <DropdownDivider />
                  <DropdownLink href="/admin/analytics" icon={BarChart3} title="Analytics" description="Reports & metrics" />
                </NavDropdown>
              )}
            </div>

            {/* Right Side - Report Button & User Menu */}
            <div className="flex items-center gap-2">
              {/* Report Pet CTA - Desktop */}
              <div className="hidden md:block relative" data-dropdown="report">
                <button
                  onClick={() => toggleDropdown('report')}
                  className="flex items-center gap-2 px-4 py-2 bg-flash-400 hover:bg-flash-500 text-midnight-900 font-bold text-sm rounded-xl transition-all"
                >
                  <Bell className="w-4 h-4" />
                  Report Pet
                  <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'report' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'report' && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-midnight-100 py-2 z-50">
                    <Link href="/report/new" className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition">
                      <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-red-600">Report Lost Pet</div>
                        <div className="text-xs text-midnight-500">Get help finding your pet</div>
                      </div>
                    </Link>
                    <Link href="/found" className="flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition">
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

              {/* User Menu - Desktop */}
              <div className="hidden lg:block relative" data-dropdown="user">
                <button
                  onClick={() => toggleDropdown('user')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-midnight-800 hover:bg-midnight-700 transition"
                >
                  <div className="w-8 h-8 rounded-lg bg-flash-400 flex items-center justify-center text-midnight-900 font-bold text-sm">
                    {session.user.firstName?.[0] || session.user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-white font-medium text-sm max-w-[100px] truncate">
                    {session.user.firstName || 'User'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-midnight-400 transition-transform ${activeDropdown === 'user' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'user' && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-midnight-100 py-2 z-50">
                    <div className="px-4 py-3 border-b border-midnight-100">
                      <div className="font-semibold text-midnight-900">{session.user.firstName} {session.user.lastName}</div>
                      <div className="text-xs text-midnight-500 truncate">{session.user.email}</div>
                    </div>
                    <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition">
                      <User className="w-4 h-4" />
                      <span className="font-medium">My Profile</span>
                    </Link>
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition">
                      <Home className="w-4 h-4" />
                      <span className="font-medium">Dashboard</span>
                    </Link>
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
      <div className={`fixed top-0 right-0 w-[300px] max-w-[85vw] h-full bg-white z-[110] transform transition-transform duration-300 ease-out lg:hidden ${
        mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Mobile Header */}
        <div className="bg-midnight-900 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-flash-400 flex items-center justify-center text-midnight-900 font-bold text-lg">
              {session.user.firstName?.[0] || session.user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{session.user.firstName} {session.user.lastName}</div>
              <div className="text-sm text-midnight-400 truncate">{session.user.email}</div>
            </div>
          </div>
        </div>

        {/* Mobile Quick Actions */}
        <div className="p-4 bg-midnight-50 border-b border-midnight-200">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/report/new"
              onClick={() => setMobileMenuOpen(false)}
              className="flex flex-col items-center gap-2 p-3 bg-red-600 text-white rounded-xl"
            >
              <Bell className="w-5 h-5" />
              <span className="text-xs font-semibold">Lost Pet</span>
            </Link>
            <Link
              href="/found"
              onClick={() => setMobileMenuOpen(false)}
              className="flex flex-col items-center gap-2 p-3 bg-green-600 text-white rounded-xl"
            >
              <CheckCircle className="w-5 h-5" />
              <span className="text-xs font-semibold">Found Pet</span>
            </Link>
          </div>
        </div>

        {/* Mobile Nav Links */}
        <div className="py-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <MobileNavLink href="/dashboard" icon={Home} label="Dashboard" active={pathname === '/dashboard'} onClick={() => setMobileMenuOpen(false)} />
          <MobileNavLink href="/pets" icon={PawPrint} label="My Pets" active={pathname.startsWith('/pets')} onClick={() => setMobileMenuOpen(false)} />
          <MobileNavLink href="/cases" icon={ClipboardList} label="My Cases" active={pathname.startsWith('/cases')} onClick={() => setMobileMenuOpen(false)} />
          <MobileNavLink href="/database" icon={Search} label="Search Database" active={pathname === '/database'} onClick={() => setMobileMenuOpen(false)} />

          <div className="border-t border-midnight-100 my-2" />
          <div className="px-4 py-2 text-xs font-semibold text-midnight-400 uppercase tracking-wider">
            Rescue Squads
          </div>

          <MobileNavLink href="/rescue-squads/search" icon={Search} label="Find Squads" active={pathname === '/rescue-squads/search'} onClick={() => setMobileMenuOpen(false)} />

          {userSquads.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-midnight-400 uppercase tracking-wider">
                My Squads
              </div>
              {userSquads.slice(0, 5).map(squad => (
                <Link
                  key={squad.id}
                  href={`/rescue-squads/${squad.id}`}
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
              <div className="px-4 py-2 text-xs font-semibold text-midnight-400 uppercase tracking-wider">
                Admin
              </div>
              <MobileNavLink href="/admin" icon={BarChart3} label="Admin Dashboard" active={pathname === '/admin'} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink href="/admin/rescue-squads" icon={Shield} label="Manage Squads" active={pathname === '/admin/rescue-squads'} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink href="/admin/divisions" icon={MapPin} label="Manage Divisions" active={pathname === '/admin/divisions'} onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink href="/admin/cases" icon={ClipboardList} label="Manage Cases" active={pathname === '/admin/cases'} onClick={() => setMobileMenuOpen(false)} />
            </>
          )}
        </div>

        {/* Mobile Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-midnight-200 bg-midnight-50">
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
        </div>
      </div>
    </>
  );
}

// --- Sub-components ---

function NavLink({ href, active, children }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition ${
        active
          ? 'bg-midnight-800 text-white'
          : 'text-midnight-300 hover:bg-midnight-800 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

function NavDropdown({ label, icon: Icon, active, isOpen, onToggle, badge, children }) {
  return (
    <div className="relative" data-dropdown={label.toLowerCase()}>
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition ${
          active
            ? 'bg-midnight-800 text-white'
            : 'text-midnight-300 hover:bg-midnight-800 hover:text-white'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
        {badge && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-flash-400 text-midnight-900 rounded-full font-semibold">
            {badge}
          </span>
        )}
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
      className={`flex items-center gap-3 px-4 py-3 transition ${
        active
          ? 'bg-flash-50 text-midnight-900 border-l-4 border-flash-400'
          : 'text-midnight-700 hover:bg-midnight-50 border-l-4 border-transparent'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
