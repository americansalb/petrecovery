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
      background: theme.gradients.sky,
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '1.5rem 2rem',
        boxShadow: theme.shadows.sm,
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
            background: theme.gradients.sunset,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            PetRecovery.org
          </h1>
          {session ? (
            <Link
              href="/dashboard"
              style={{
                padding: '0.75rem 1.5rem',
                background: theme.gradients.ocean,
                color: 'white',
                borderRadius: theme.radius.full,
                textDecoration: 'none',
                fontWeight: '700',
                boxShadow: theme.shadows.sm,
              }}
            >
              My Dashboard
            </Link>
          ) : (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link
                href="/login"
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  color: theme.colors.gray[700],
                  border: `2px solid ${theme.colors.gray[300]}`,
                  borderRadius: theme.radius.full,
                  textDecoration: 'none',
                  fontWeight: '600',
                }}
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{
        textAlign: 'center',
        padding: '4rem 2rem 2rem',
        maxWidth: '900px',
        margin: '0 auto',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🐾</div>
        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4rem)',
          fontWeight: '900',
          marginBottom: '1rem',
          background: theme.gradients.sunset,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: '1.2',
        }}>
          Every Pet Deserves to Come Home
        </h1>
        <p style={{
          fontSize: '1.35rem',
          color: theme.colors.gray[700],
          maxWidth: '700px',
          margin: '0 auto 3rem',
          lineHeight: '1.6',
        }}>
          Instant expert advice, community alerts, and neighborhood heroes working together to reunite families.
        </p>
      </div>

      {/* 3 Main Options */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 2rem 4rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2rem',
      }}>
        {/* Report Lost Pet */}
        <Link
          href="/report/new"
          style={{
            background: 'white',
            borderRadius: theme.radius.xl,
            padding: '3rem 2rem',
            textDecoration: 'none',
            boxShadow: theme.shadows.colored.petOwner,
            border: '3px solid transparent',
            transition: 'all 0.3s ease',
            display: 'block',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = theme.colors.petOwner.primary;
            e.currentTarget.style.transform = 'translateY(-8px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: theme.gradients.sunset,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            margin: '0 auto 1.5rem',
            boxShadow: theme.shadows.md,
          }}>
            🚨
          </div>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: theme.colors.gray[900],
            textAlign: 'center',
          }}>
            Report Lost Pet
          </h2>
          <p style={{
            fontSize: '1.05rem',
            color: theme.colors.gray[600],
            lineHeight: '1.6',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}>
            Get immediate expert advice and alert your entire community. Every second counts.
          </p>
          <div style={{
            padding: '1rem',
            background: theme.gradients.sunset,
            color: 'white',
            borderRadius: theme.radius.md,
            fontWeight: '700',
            textAlign: 'center',
            fontSize: '1.1rem',
          }}>
            Start Recovery →
          </div>
        </Link>

        {/* Join Pet Patrol */}
        <Link
          href="/patrol/join"
          style={{
            background: 'white',
            borderRadius: theme.radius.xl,
            padding: '3rem 2rem',
            textDecoration: 'none',
            boxShadow: theme.shadows.colored.patrol,
            border: '3px solid transparent',
            transition: 'all 0.3s ease',
            display: 'block',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = theme.colors.patrol.primary;
            e.currentTarget.style.transform = 'translateY(-8px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: theme.gradients.ocean,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            margin: '0 auto 1.5rem',
            boxShadow: theme.shadows.md,
          }}>
            🦸
          </div>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: theme.colors.gray[900],
            textAlign: 'center',
          }}>
            Join Pet Patrol
          </h2>
          <p style={{
            fontSize: '1.05rem',
            color: theme.colors.gray[600],
            lineHeight: '1.6',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}>
            Be a neighborhood hero. Get alerts for lost pets in your area and help reunite families.
          </p>
          <div style={{
            padding: '1rem',
            background: theme.gradients.ocean,
            color: 'white',
            borderRadius: theme.radius.md,
            fontWeight: '700',
            textAlign: 'center',
            fontSize: '1.1rem',
          }}>
            Become a Hero →
          </div>
        </Link>

        {/* Get Advice */}
        <Link
          href="/advice"
          style={{
            background: 'white',
            borderRadius: theme.radius.xl,
            padding: '3rem 2rem',
            textDecoration: 'none',
            boxShadow: theme.shadows.md,
            border: '3px solid transparent',
            transition: 'all 0.3s ease',
            display: 'block',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = theme.colors.info;
            e.currentTarget.style.transform = 'translateY(-8px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: theme.gradients.hope,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            margin: '0 auto 1.5rem',
            boxShadow: theme.shadows.md,
          }}>
            💡
          </div>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: theme.colors.gray[900],
            textAlign: 'center',
          }}>
            Get Expert Advice
          </h2>
          <p style={{
            fontSize: '1.05rem',
            color: theme.colors.gray[600],
            lineHeight: '1.6',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}>
            Not ready to report? Get professional recovery strategies tailored to your situation.
          </p>
          <div style={{
            padding: '1rem',
            background: theme.gradients.hope,
            color: 'white',
            borderRadius: theme.radius.md,
            fontWeight: '700',
            textAlign: 'center',
            fontSize: '1.1rem',
          }}>
            Learn What To Do →
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div style={{
        background: 'white',
        padding: '3rem 2rem',
        marginTop: '2rem',
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
            <div style={{
              fontSize: '3rem',
              fontWeight: '800',
              background: theme.gradients.forest,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '0.5rem',
            }}>
              847
            </div>
            <div style={{ color: theme.colors.gray[600], fontWeight: '600' }}>
              Happy Reunions
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '3rem',
              fontWeight: '800',
              background: theme.gradients.ocean,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '0.5rem',
            }}>
              2,345
            </div>
            <div style={{ color: theme.colors.gray[600], fontWeight: '600' }}>
              Patrol Heroes
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '3rem',
              fontWeight: '800',
              background: theme.gradients.sunset,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '0.5rem',
            }}>
              5,621
            </div>
            <div style={{ color: theme.colors.gray[600], fontWeight: '600' }}>
              Sightings Reported
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        background: theme.colors.gray[100],
        padding: '2rem',
        textAlign: 'center',
        color: theme.colors.gray[600],
        fontSize: '0.9rem',
      }}>
        <p>© 2025 PetRecovery.org - Every pet deserves to come home</p>
      </div>
    </div>
  );
}
