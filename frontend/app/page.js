'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function Home() {
  const { data: session } = useSession();

  return (
    <main style={{
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(to bottom, #f0f9ff, #e0f2fe)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: '#1e40af',
        }}>
          PetRecovery.org
        </h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {session ? (
            <Link
              href="/dashboard"
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: '#2563eb',
                  border: '2px solid #2563eb',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                }}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                }}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: '#1e40af',
          maxWidth: '900px',
        }}>
          Lost Your Pet? Get Help From Your Community
        </h1>

        <p style={{
          fontSize: '1.25rem',
          color: '#4b5563',
          marginBottom: '2rem',
          maxWidth: '700px',
        }}>
          Real-time alerts, expert advice, and a network of neighbors ready to help reunite you with your pet.
        </p>

        <div style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          <Link
            href="/report/new"
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              fontSize: '1.25rem',
              fontWeight: '600',
              padding: '1rem 2rem',
              borderRadius: '0.75rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            🚨 Report Lost Pet
          </Link>

          <Link
            href="/alerts"
            style={{
              backgroundColor: 'white',
              color: '#2563eb',
              fontSize: '1.25rem',
              fontWeight: '600',
              padding: '1rem 2rem',
              borderRadius: '0.75rem',
              border: '2px solid #2563eb',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            📍 View Active Alerts
          </Link>
        </div>
      </div>

      {/* Features */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '2rem',
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '1rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤖</div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '0.5rem',
          }}>
            AI-Powered Advice
          </h3>
          <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
            Get immediate, expert recovery strategies tailored to your specific situation and pet type.
          </p>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '1rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '0.5rem',
          }}>
            Community Network
          </h3>
          <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
            Instantly alert nearby community members who can keep an eye out during their daily routines.
          </p>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '1rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '0.5rem',
          }}>
            Real-Time Updates
          </h3>
          <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
            Track sightings, coordinate search efforts, and get notifications when someone spots your pet.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        backgroundColor: '#1e40af',
        color: 'white',
        padding: '3rem 2rem',
        marginTop: '3rem',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2rem',
          textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              847
            </div>
            <div style={{ fontSize: '1rem', opacity: 0.9 }}>
              Pets Reunited
            </div>
          </div>
          <div>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              2,345
            </div>
            <div style={{ fontSize: '1rem', opacity: 0.9 }}>
              Active Members
            </div>
          </div>
          <div>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              5,621
            </div>
            <div style={{ fontSize: '1rem', opacity: 0.9 }}>
              Sightings Reported
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{
        padding: '4rem 2rem',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '1rem',
        }}>
          Join the Neighborhood Watch for Pets
        </h2>
        <p style={{
          fontSize: '1.125rem',
          color: '#6b7280',
          marginBottom: '2rem',
          maxWidth: '600px',
          margin: '0 auto 2rem',
        }}>
          Get alerts when pets go missing nearby and help reunite them with their families - no active searching required.
        </p>
        <Link
          href="/patrol/join"
          style={{
            backgroundColor: '#8b5cf6',
            color: 'white',
            fontSize: '1.125rem',
            fontWeight: '600',
            padding: '1rem 2rem',
            borderRadius: '0.75rem',
            textDecoration: 'none',
            display: 'inline-block',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          🔔 Join the Watch
        </Link>
      </div>

      {/* Footer */}
      <div style={{
        backgroundColor: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
        padding: '2rem',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '0.875rem',
      }}>
        <p>© 2025 PetRecovery.org - Helping reunite lost pets with their families</p>
      </div>
    </main>
  );
}
