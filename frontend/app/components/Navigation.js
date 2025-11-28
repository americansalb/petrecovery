'use client';

/**
 * Navigation Component - Phase 2.1 Mobile Update
 *
 * Responsive navigation with hamburger menu for mobile
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
  const [showSquadsDropdown, setShowSquadsDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      loadUserSquads();
    }
  }, [session?.user?.id]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
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

  // Don't show nav on landing page (it has its own header)
  if (pathname === '/') {
    return null;
  }

  // Show simplified nav for guests on non-auth pages
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password');

  if (!session) {
    // Show minimal guest nav on non-auth pages
    if (isAuthPage) {
      return null;
    }

    return (
      <>
        <nav style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderBottom: '3px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '64px',
            gap: '1rem'
          }}>
            {/* Logo / Brand */}
            <Link href="/" style={{
              fontSize: '1.25rem',
              fontWeight: '900',
              color: 'white',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap'
            }}>
              <span>🐾 PetRecovery</span>
            </Link>

            {/* Guest Nav Items */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Link
                href="/database"
                style={{
                  padding: '0.5rem 1rem',
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  background: pathname === '/database' ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
                }}
              >
                Search
              </Link>
              <Link
                href="/rescue-squads/search"
                style={{
                  padding: '0.5rem 1rem',
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  background: pathname.includes('/rescue-squads') ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
                }}
              >
                Squads
              </Link>
              <Link
                href="/login"
                style={{
                  padding: '0.5rem 1rem',
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                Login
              </Link>
              <Link
                href="/register"
                style={{
                  padding: '0.5rem 1rem',
                  color: '#667eea',
                  textDecoration: 'none',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  background: 'white',
                }}
              >
                Sign Up
              </Link>
            </div>
          </div>
        </nav>
      </>
    );
  }

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', active: pathname === '/dashboard' },
    { label: 'Cases', href: '/cases', active: pathname.startsWith('/cases') && !pathname.includes('/report') },
    { label: 'My Pets', href: '/pets', active: pathname.startsWith('/pets') },
    { label: 'Report Lost', href: '/cases/report', active: pathname === '/cases/report' },
    { label: 'Found Pet', href: '/found', active: pathname === '/found' },
    { label: 'Squads', href: '/rescue-squads/search', active: pathname === '/rescue-squads/search' },
  ];

  // Add admin link for admin users
  if (session?.user?.role === 'ADMIN') {
    navItems.push({ label: 'Admin', href: '/admin/health', active: pathname.startsWith('/admin') });
  }

  return (
    <>
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderBottom: '3px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          gap: '1rem'
        }}>
          {/* Logo / Brand */}
          <Link href="/dashboard" style={{
            fontSize: '1.25rem',
            fontWeight: '900',
            color: 'white',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}>
            <span className="brand-text">PetRecovery</span>
          </Link>

          {/* Desktop Nav Items */}
          <div className="desktop-nav" style={{
            display: 'flex',
            gap: '0.25rem',
            flex: 1,
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            {navItems.slice(0, 4).map(item => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '0.5rem 0.75rem',
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  borderRadius: '8px',
                  background: item.active ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                {item.label}
              </Link>
            ))}

            {/* My Squads Dropdown (Desktop) */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSquadsDropdown(!showSquadsDropdown)}
                onBlur={() => setTimeout(() => setShowSquadsDropdown(false), 200)}
                style={{
                  padding: '0.5rem 0.75rem',
                  color: 'white',
                  background: pathname.includes('/rescue-squads/') && !pathname.includes('/search')
                    ? 'rgba(255, 255, 255, 0.25)'
                    : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                Squads ({userSquads.length}) {showSquadsDropdown ? '▲' : '▼'}
              </button>

              {showSquadsDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                  border: '2px solid #e2e8f0',
                  minWidth: '250px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  zIndex: 2000
                }}>
                  {userSquads.length === 0 ? (
                    <div style={{
                      padding: '1.5rem',
                      textAlign: 'center',
                      color: '#64748b'
                    }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                        No squads yet
                      </div>
                      <Link
                        href="/rescue-squads/search"
                        style={{
                          display: 'inline-block',
                          marginTop: '0.75rem',
                          padding: '0.5rem 1rem',
                          background: '#667eea',
                          color: 'white',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          fontSize: '0.85rem',
                          fontWeight: '700'
                        }}
                      >
                        Find Squads
                      </Link>
                    </div>
                  ) : (
                    <>
                      {userSquads.map(squad => (
                        <Link
                          key={squad.id}
                          href={`/rescue-squads/${squad.id}`}
                          style={{
                            display: 'block',
                            padding: '0.75rem 1rem',
                            textDecoration: 'none',
                            borderBottom: '1px solid #f1f5f9'
                          }}
                        >
                          <div style={{
                            fontWeight: '700',
                            color: '#0f172a',
                            marginBottom: '0.25rem',
                            fontSize: '0.95rem'
                          }}>
                            {squad.name}
                          </div>
                          <div style={{
                            fontSize: '0.8rem',
                            color: '#64748b'
                          }}>
                            {squad.city}, {squad.state} • {squad.role}
                          </div>
                        </Link>
                      ))}
                      <div style={{
                        padding: '0.75rem 1rem',
                        borderTop: '2px solid #e2e8f0',
                        background: '#f8fafc'
                      }}>
                        <Link
                          href="/rescue-squads/search"
                          style={{
                            display: 'block',
                            textAlign: 'center',
                            color: '#667eea',
                            textDecoration: 'none',
                            fontWeight: '700',
                            fontSize: '0.85rem'
                          }}
                        >
                          + Find More Squads
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Desktop User Menu */}
          <div className="desktop-nav" style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              onBlur={() => setTimeout(() => setShowUserMenu(false), 200)}
              style={{
                padding: '0.375rem 0.75rem',
                color: 'white',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '0.8rem'
              }}>
                {session.user.firstName?.[0] || session.user.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="user-name">{session.user.firstName || 'User'}</span>
              <span>{showUserMenu ? '▲' : '▼'}</span>
            </button>

            {showUserMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.5rem',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                border: '2px solid #e2e8f0',
                minWidth: '200px',
                zIndex: 2000
              }}>
                <Link
                  href="/profile"
                  style={{
                    display: 'block',
                    padding: '0.75rem 1rem',
                    textDecoration: 'none',
                    color: '#0f172a',
                    fontWeight: '600',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  My Profile
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    background: 'white',
                    border: 'none',
                    color: '#dc2626',
                    fontWeight: '600',
                    cursor: 'pointer',
                    borderRadius: '0 0 10px 10px'
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            style={{
              display: 'none',
              padding: '0.5rem',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.5rem',
              lineHeight: 1,
            }}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1001,
          }}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className="mobile-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: mobileMenuOpen ? 0 : '-100%',
          width: '280px',
          maxWidth: '85vw',
          height: '100vh',
          background: 'white',
          zIndex: 1002,
          transition: 'right 0.3s ease',
          overflowY: 'auto',
          boxShadow: mobileMenuOpen ? '-4px 0 20px rgba(0, 0, 0, 0.2)' : 'none',
        }}
      >
        {/* Mobile Menu Header */}
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '900',
              fontSize: '1.25rem'
            }}>
              {session.user.firstName?.[0] || session.user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '1rem' }}>
                {session.user.firstName} {session.user.lastName}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                {session.user.email}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Nav Items */}
        <div style={{ padding: '0.5rem 0' }}>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem 1.25rem',
                color: item.active ? '#667eea' : '#0f172a',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                background: item.active ? '#f1f5f9' : 'transparent',
                borderLeft: item.active ? '4px solid #667eea' : '4px solid transparent',
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Mobile Squads Section */}
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '0.5rem 0' }}>
          <div style={{
            padding: '0.75rem 1.25rem',
            color: '#64748b',
            fontWeight: '700',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            My Squads ({userSquads.length})
          </div>
          {userSquads.length === 0 ? (
            <div style={{ padding: '0.5rem 1.25rem', color: '#64748b', fontSize: '0.9rem' }}>
              No squads joined yet
            </div>
          ) : (
            userSquads.slice(0, 3).map(squad => (
              <Link
                key={squad.id}
                href={`/rescue-squads/${squad.id}`}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.75rem 1.25rem',
                  textDecoration: 'none',
                }}
              >
                <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.9rem' }}>
                  {squad.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {squad.city}, {squad.state}
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Mobile Menu Footer */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}>
          <Link
            href="/profile"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              color: '#0f172a',
              textDecoration: 'none',
              fontWeight: '600',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            My Profile
          </Link>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              signOut({ callbackUrl: '/' });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              padding: '1rem 1.25rem',
              background: 'transparent',
              border: 'none',
              color: '#dc2626',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Responsive Styles */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: block !important;
          }
          .brand-text {
            display: none;
          }
          .user-name {
            display: none;
          }
        }
        @media (min-width: 769px) {
          .mobile-overlay,
          .mobile-drawer {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
