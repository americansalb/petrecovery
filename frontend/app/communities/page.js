'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function CommunitiesPage() {
  const { data: session } = useSession();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '3rem',
          color: 'white'
        }}>
          <h1 style={{
            fontSize: '3.5rem',
            fontWeight: '900',
            marginBottom: '1rem'
          }}>
            Communities
          </h1>
          <p style={{
            fontSize: '1.3rem',
            opacity: 0.95,
            lineHeight: '1.6'
          }}>
            Organize pet recovery efforts in your local area
          </p>
        </div>

        {/* Main Actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          marginBottom: '3rem'
        }}>
          {/* Request Community */}
          <Link
            href="/communities/request"
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2.5rem',
              textDecoration: 'none',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              transition: 'transform 0.2s',
              display: 'block'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              fontSize: '3.5rem',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              🏘️
            </div>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '0.75rem',
              textAlign: 'center'
            }}>
              Request a Community
            </h2>
            <p style={{
              fontSize: '1rem',
              color: '#64748b',
              lineHeight: '1.6',
              textAlign: 'center'
            }}>
              Submit a request to create a new community for your area
            </p>
          </Link>

          {/* My Requests */}
          {session && (
            <Link
              href="/communities/my-requests"
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2.5rem',
                textDecoration: 'none',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                transition: 'transform 0.2s',
                display: 'block'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{
                fontSize: '3.5rem',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                📋
              </div>
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: '800',
                color: '#0f172a',
                marginBottom: '0.75rem',
                textAlign: 'center'
              }}>
                My Requests
              </h2>
              <p style={{
                fontSize: '1rem',
                color: '#64748b',
                lineHeight: '1.6',
                textAlign: 'center'
              }}>
                View the status of your community creation requests
              </p>
            </Link>
          )}
        </div>

        {/* Coming Soon Section */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          color: 'white',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            marginBottom: '1rem'
          }}>
            🚧 More Features Coming Soon
          </h3>
          <p style={{
            fontSize: '1.1rem',
            opacity: 0.9,
            lineHeight: '1.6',
            marginBottom: '1rem'
          }}>
            We're actively building the community system! Soon you'll be able to:
          </p>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            maxWidth: '500px',
            margin: '0 auto'
          }}>
            <li>✓ Browse all approved communities</li>
            <li>✓ Join communities in your area</li>
            <li>✓ Create and join recovery squads for lost pets</li>
            <li>✓ Coordinate search efforts with volunteers</li>
            <li>✓ Mark searched areas on a map</li>
            <li>✓ Level up through rescue achievements</li>
          </ul>
        </div>

        {/* Back to Home */}
        <div style={{
          marginTop: '3rem',
          textAlign: 'center'
        }}>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '1rem 2rem',
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '700',
              border: '2px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
