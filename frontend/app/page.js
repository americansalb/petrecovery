'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { theme } from './lib/theme';

export default function Home() {
  const { data: session } = useSession();

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: theme.fonts.sans,
      background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        padding: '1.5rem 2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            color: '#1e293b',
          }}>
            🐾 PetRecovery
          </h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link
              href="/patrol/join"
              style={{
                padding: '0.75rem 1.75rem',
                background: '#0ea5e9',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '0.95rem',
              }}
            >
              Join the Patrol
            </Link>
            {session ? (
              <Link
                href="/dashboard"
                style={{
                  padding: '0.75rem 1.75rem',
                  background: 'transparent',
                  color: '#64748b',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}
              >
                My Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                style={{
                  padding: '0.75rem 1.75rem',
                  background: 'transparent',
                  color: '#64748b',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        textAlign: 'center',
        padding: '5rem 2rem 3rem',
        maxWidth: '900px',
        margin: '0 auto',
      }}>
        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: '900',
          marginBottom: '1.5rem',
          color: '#0f172a',
          lineHeight: '1.1',
        }}>
          Reunite with Your Lost Pet
        </h1>
        <p style={{
          fontSize: '1.4rem',
          color: '#475569',
          maxWidth: '700px',
          margin: '0 auto 1rem',
          lineHeight: '1.5',
          fontWeight: '400',
        }}>
          Instant community alerts and proven recovery strategies to bring your pet home safely
        </p>
        <p style={{
          fontSize: '1.1rem',
          color: '#10b981',
          fontWeight: '700',
          margin: '0',
        }}>
          ✓ 847 pets reunited and counting
        </p>
      </div>

      {/* Database CTA Banner */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 3rem',
        padding: '0 2rem',
      }}>
        <Link
          href="/database"
          style={{
            display: 'block',
            background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
            borderRadius: '20px',
            padding: '2.5rem 3rem',
            textDecoration: 'none',
            boxShadow: '0 10px 30px rgba(14, 165, 233, 0.25)',
            border: '3px solid rgba(255, 255, 255, 0.3)',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(14, 165, 233, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 10px 30px rgba(14, 165, 233, 0.25)';
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2rem',
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h2 style={{
                fontSize: '2.25rem',
                fontWeight: '900',
                color: 'white',
                marginBottom: '0.75rem',
              }}>
                Search the Pet Database
              </h2>
              <p style={{
                fontSize: '1.15rem',
                color: 'rgba(255, 255, 255, 0.95)',
                lineHeight: '1.6',
                marginBottom: '0',
              }}>
                Browse all lost and found pets in your area. No signup required to search. Sign in to view contact information and help reunite pets with their families.
              </p>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '5rem',
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))',
            }}>
              🔍
            </div>
          </div>
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem 2rem',
            background: 'white',
            color: '#0284c7',
            borderRadius: '12px',
            fontWeight: '700',
            textAlign: 'center',
            fontSize: '1.1rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}>
            Browse Database Now →
          </div>
        </Link>
      </div>

      {/* Main 3 Options */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 2rem 3rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '2rem',
      }}>
        {/* Report Lost Pet */}
        <Link
          href="/report/new"
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '3rem 2.5rem',
            textDecoration: 'none',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
            border: '2px solid transparent',
            transition: 'all 0.2s ease',
            display: 'block',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#dc2626';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(220, 38, 38, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
          }}
        >
          <div style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            marginBottom: '1.5rem',
          }}>
            🚨
          </div>

          <h2 style={{
            fontSize: '2rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: '#0f172a',
          }}>
            Report Lost Pet
          </h2>

          <p style={{
            fontSize: '1.1rem',
            color: '#64748b',
            lineHeight: '1.6',
            marginBottom: '1.5rem',
          }}>
            Alert every neighbor in your area instantly. Get step-by-step recovery guidance customized for your pet and situation.
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}>
              <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span>
              <span style={{ color: '#475569', fontSize: '0.95rem' }}>Instant alerts to local patrol members</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}>
              <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span>
              <span style={{ color: '#475569', fontSize: '0.95rem' }}>Proven recovery strategies</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span>
              <span style={{ color: '#475569', fontSize: '0.95rem' }}>Track sightings in real-time</span>
            </div>
          </div>

          <div style={{
            padding: '1.25rem',
            background: '#dc2626',
            color: 'white',
            borderRadius: '10px',
            fontWeight: '700',
            textAlign: 'center',
            fontSize: '1.1rem',
          }}>
            Start Recovery Now →
          </div>
        </Link>

        {/* Report Found Pet */}
        <Link
          href="/report/found"
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '3rem 2.5rem',
            textDecoration: 'none',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
            border: '2px solid transparent',
            transition: 'all 0.2s ease',
            display: 'block',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#10b981';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(16, 185, 129, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
          }}
        >
          <div style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            background: '#d1fae5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            marginBottom: '1.5rem',
          }}>
            🎉
          </div>

          <h2 style={{
            fontSize: '2rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: '#0f172a',
          }}>
            Report Found Pet
          </h2>

          <p style={{
            fontSize: '1.1rem',
            color: '#64748b',
            lineHeight: '1.6',
            marginBottom: '1.5rem',
          }}>
            Found a lost pet? Help reunite them with their family. Your kindness could bring a pet home today.
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}>
              <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span>
              <span style={{ color: '#475569', fontSize: '0.95rem' }}>Alert nearby owners instantly</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}>
              <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span>
              <span style={{ color: '#475569', fontSize: '0.95rem' }}>Match with lost pet reports</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span>
              <span style={{ color: '#475569', fontSize: '0.95rem' }}>Safe reunion coordination</span>
            </div>
          </div>

          <div style={{
            padding: '1.25rem',
            background: '#10b981',
            color: 'white',
            borderRadius: '10px',
            fontWeight: '700',
            textAlign: 'center',
            fontSize: '1.1rem',
          }}>
            Report Found Pet →
          </div>
        </Link>

        {/* Browse Communities */}
        <Link
          href="/communities"
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '3rem 2.5rem',
            textDecoration: 'none',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
            border: '2px solid transparent',
            transition: 'all 0.2s ease',
            display: 'block',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#667eea';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(102, 126, 234, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
          }}
        >
          <div style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            background: '#ede9fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            marginBottom: '1.5rem',
          }}>
            🏘️
          </div>

          <h2 style={{
            fontSize: '2rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: '#0f172a',
          }}>
            Browse Communities
          </h2>

          <p style={{
            fontSize: '1.1rem',
            color: '#64748b',
            lineHeight: '1.6',
            marginBottom: '2rem',
          }}>
            Join local communities to organize pet recovery efforts with volunteers in your area.
          </p>

          <div style={{
            padding: '1.25rem',
            background: '#667eea',
            color: 'white',
            borderRadius: '10px',
            fontWeight: '700',
            textAlign: 'center',
            fontSize: '1.1rem',
          }}>
            Explore Communities →
          </div>
        </Link>
      </div>
    </div>
  );
}
