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
        }}>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            color: '#1e293b',
          }}>
            🐾 PetRecovery
          </h1>
          {session ? (
            <Link
              href="/dashboard"
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

      {/* Main 2 Options */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '0 2rem 3rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
        gap: '2.5rem',
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
          {/* FREE Badge */}
          <div style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            padding: '0.5rem 1rem',
            background: '#10b981',
            color: 'white',
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: '800',
            letterSpacing: '0.5px',
          }}>
            100% FREE
          </div>

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

        {/* Join Pet Patrol */}
        <Link
          href="/patrol/join"
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '3rem 2.5rem',
            textDecoration: 'none',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
            border: '2px solid transparent',
            transition: 'all 0.2s ease',
            display: 'block',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#0ea5e9';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(14, 165, 233, 0.15)';
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
            background: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            marginBottom: '1.5rem',
          }}>
            🦸
          </div>

          <h2 style={{
            fontSize: '2rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: '#0f172a',
          }}>
            Join Pet Patrol
          </h2>

          <p style={{
            fontSize: '1.1rem',
            color: '#64748b',
            lineHeight: '1.6',
            marginBottom: '1.5rem',
          }}>
            Be a hero without leaving your routine. Get alerts for lost pets in your neighborhood—just keep an eye out.
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}>
              <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span>
              <span style={{ color: '#475569', fontSize: '0.95rem' }}>5 minutes to sign up</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}>
              <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span>
              <span style={{ color: '#475569', fontSize: '0.95rem' }}>No active searching required</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span>
              <span style={{ color: '#475569', fontSize: '0.95rem' }}>Help reunite families</span>
            </div>
          </div>

          <div style={{
            padding: '1.25rem',
            background: '#0ea5e9',
            color: 'white',
            borderRadius: '10px',
            fontWeight: '700',
            textAlign: 'center',
            fontSize: '1.1rem',
          }}>
            Become a Patrol Hero →
          </div>
        </Link>
      </div>

      {/* Divider */}
      <div style={{
        maxWidth: '1100px',
        margin: '2rem auto',
        padding: '0 2rem',
      }}>
        <div style={{
          height: '1px',
          background: '#e2e8f0',
        }}></div>
      </div>

      {/* Secondary Option - Advice */}
      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        padding: '0 2rem 4rem',
      }}>
        <Link
          href="/advice"
          style={{
            background: '#f8fafc',
            borderRadius: '12px',
            padding: '2rem',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            border: '1px solid #e2e8f0',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f8fafc';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            flexShrink: 0,
          }}>
            💡
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontSize: '1.4rem',
              fontWeight: '700',
              marginBottom: '0.5rem',
              color: '#0f172a',
            }}>
              Not ready to report? Get recovery advice
            </h3>
            <p style={{
              fontSize: '0.95rem',
              color: '#64748b',
              margin: 0,
            }}>
              Learn proven strategies for finding your lost pet—no account needed
            </p>
          </div>
          <div style={{
            color: '#8b5cf6',
            fontSize: '1.5rem',
            fontWeight: '700',
          }}>
            →
          </div>
        </Link>
      </div>

      {/* Social Proof */}
      <div style={{
        background: 'white',
        borderTop: '1px solid #f1f5f9',
        borderBottom: '1px solid #f1f5f9',
        padding: '3rem 2rem',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '3rem',
          textAlign: 'center',
        }}>
          <div>
            <div style={{
              fontSize: '3.5rem',
              fontWeight: '800',
              color: '#10b981',
              marginBottom: '0.5rem',
            }}>
              847
            </div>
            <div style={{ color: '#64748b', fontWeight: '600', fontSize: '1.05rem' }}>
              Happy Reunions
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '3.5rem',
              fontWeight: '800',
              color: '#0ea5e9',
              marginBottom: '0.5rem',
            }}>
              2,345
            </div>
            <div style={{ color: '#64748b', fontWeight: '600', fontSize: '1.05rem' }}>
              Active Patrol Heroes
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '3.5rem',
              fontWeight: '800',
              color: '#f59e0b',
              marginBottom: '0.5rem',
            }}>
              94%
            </div>
            <div style={{ color: '#64748b', fontWeight: '600', fontSize: '1.05rem' }}>
              Found Within 7 Days
            </div>
          </div>
        </div>
      </div>

      {/* Testimonial */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '4rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{
          background: '#f8fafc',
          borderRadius: '12px',
          padding: '2.5rem',
          border: '1px solid #e2e8f0',
        }}>
          <p style={{
            fontSize: '1.3rem',
            fontStyle: 'italic',
            color: '#475569',
            lineHeight: '1.6',
            marginBottom: '1.5rem',
          }}>
            "Max was found 2 miles away thanks to a patrol member who saw the alert. We were reunited in less than 6 hours. This service saved our family."
          </p>
          <div style={{
            color: '#0f172a',
            fontWeight: '600',
          }}>
            — Sarah M., Chicago
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        background: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        padding: '2rem',
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '0.9rem',
      }}>
        <p>© 2025 PetRecovery - Every pet deserves to come home</p>
      </div>
    </div>
  );
}
