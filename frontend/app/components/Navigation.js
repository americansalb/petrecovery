'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Don't show navigation on login/signup pages
  if (pathname === '/login' || pathname === '/signup' || pathname === '/') {
    return null;
  }

  // Loading state
  if (status === 'loading') {
    return null;
  }

  // Not authenticated
  if (!session) {
    return null;
  }

  return (
    <nav style={{
      background: 'white',
      borderBottom: '2px solid #e2e8f0',
      padding: '1rem 2rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '2rem',
        flexWrap: 'wrap',
      }}>
        {/* Logo/Brand */}
        <Link
          href="/dashboard"
          style={{
            fontSize: '1.5rem',
            fontWeight: '800',
            color: '#0f172a',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          🐾 PetRecovery
        </Link>

        {/* Navigation Links */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          flex: 1,
          justifyContent: 'flex-end',
        }}>
          <Link
            href="/dashboard"
            style={{
              padding: '0.75rem 1.25rem',
              background: pathname === '/dashboard' ? '#667eea' : 'transparent',
              color: pathname === '/dashboard' ? 'white' : '#64748b',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '0.95rem',
              transition: 'all 0.2s',
            }}
          >
            Dashboard
          </Link>

          <Link
            href="/rescue-squads/search"
            style={{
              padding: '0.75rem 1.25rem',
              background: pathname?.startsWith('/rescue-squads') ? '#667eea' : 'transparent',
              color: pathname?.startsWith('/rescue-squads') ? 'white' : '#64748b',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '0.95rem',
              transition: 'all 0.2s',
            }}
          >
            🚁 Rescue Squads
          </Link>

          {/* Admin Link - only show for admin users */}
          {session?.user?.role === 'ADMIN' && (
            <Link
              href="/admin/rescue-squads"
              style={{
                padding: '0.75rem 1.25rem',
                background: pathname?.startsWith('/admin') ? '#dc2626' : 'transparent',
                color: pathname?.startsWith('/admin') ? 'white' : '#dc2626',
                border: pathname?.startsWith('/admin') ? 'none' : '2px solid #dc2626',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700',
                fontSize: '0.95rem',
                transition: 'all 0.2s',
              }}
            >
              ⚙️ Admin
            </Link>
          )}

          {/* User Menu */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginLeft: '0.5rem',
            paddingLeft: '0.75rem',
            borderLeft: '2px solid #e2e8f0',
          }}>
            <span style={{
              fontSize: '0.9rem',
              color: '#64748b',
              fontWeight: '600',
            }}>
              {session.user?.name || session.user?.email?.split('@')[0]}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              style={{
                padding: '0.75rem 1.25rem',
                background: '#f1f5f9',
                color: '#64748b',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem',
                transition: 'all 0.2s',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
