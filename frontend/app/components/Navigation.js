'use client';

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

  useEffect(() => {
    if (session?.user?.id) {
      loadUserSquads();
    }
  }, [session?.user?.id]);

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

  // Don't show nav on landing page or auth pages
  if (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return null;
  }

  if (!session) {
    return null;
  }

  const navItems = [
    { label: '🏠 Dashboard', href: '/dashboard', active: pathname === '/dashboard' },
    { label: '🔍 Browse Cases', href: '/cases', active: pathname.startsWith('/cases') },
    { label: '🚁 Find Squads', href: '/rescue-squads/search', active: pathname === '/rescue-squads/search' },
  ];

  return (
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
          fontSize: '1.5rem',
          fontWeight: '900',
          color: 'white',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          whiteSpace: 'nowrap'
        }}>
          🐾 PetRecovery
        </Link>

        {/* Main Nav Items */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flex: 1,
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '0.5rem 1rem',
                color: 'white',
                textDecoration: 'none',
                fontWeight: '700',
                fontSize: '0.95rem',
                borderRadius: '8px',
                background: item.active ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!item.active) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              }}
              onMouseLeave={(e) => {
                if (!item.active) e.currentTarget.style.background = 'transparent';
              }}
            >
              {item.label}
            </Link>
          ))}

          {/* My Squads Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSquadsDropdown(!showSquadsDropdown)}
              onBlur={() => setTimeout(() => setShowSquadsDropdown(false), 200)}
              style={{
                padding: '0.5rem 1rem',
                color: 'white',
                background: pathname.includes('/rescue-squads/') && !pathname.includes('/search')
                  ? 'rgba(255, 255, 255, 0.25)'
                  : 'transparent',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
              onMouseEnter={(e) => {
                if (!pathname.includes('/rescue-squads/')) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              }}
              onMouseLeave={(e) => {
                if (!pathname.includes('/rescue-squads/')) e.currentTarget.style.background = 'transparent';
              }}
            >
              🚁 My Squads ({userSquads.length}) {showSquadsDropdown ? '▲' : '▼'}
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
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚁</div>
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
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
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

        {/* User Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            onBlur={() => setTimeout(() => setShowUserMenu(false), 200)}
            style={{
              padding: '0.5rem 1rem',
              color: 'white',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '900',
              fontSize: '0.9rem'
            }}>
              {session.user.firstName?.[0] || session.user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <span style={{ display: 'inline-block' }}>
              {session.user.firstName || 'User'} {showUserMenu ? '▲' : '▼'}
            </span>
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
                  borderBottom: '1px solid #f1f5f9',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                👤 My Profile
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
                  borderRadius: '0 0 10px 10px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
