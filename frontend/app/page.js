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

      {/* Hero Section */}
      <div style={{
        textAlign: 'center',
        padding: '4rem 2rem 2rem',
        maxWidth: '1000px',
        margin: '0 auto',
      }}>
        <div style={{
          fontSize: '5rem',
          marginBottom: '1.5rem',
        }}>
          🦸‍♀️🐕🐈🦸‍♂️
        </div>
        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: '900',
          marginBottom: '1.5rem',
          color: '#0f172a',
          lineHeight: '1.1',
        }}>
          Join Your Community Pet Patrol
        </h1>
        <p style={{
          fontSize: '1.4rem',
          color: '#475569',
          maxWidth: '800px',
          margin: '0 auto 2.5rem',
          lineHeight: '1.6',
          fontWeight: '400',
        }}>
          Receive instant alerts about lost pets in your area. Help neighbors find their pets and get help when you need it. <strong>It's completely free.</strong>
        </p>

        {/* Main CTA */}
        <Link
          href="/patrol/join"
          style={{
            display: 'inline-block',
            padding: '1.75rem 4rem',
            background: '#0ea5e9',
            color: 'white',
            borderRadius: '16px',
            textDecoration: 'none',
            fontWeight: '800',
            fontSize: '1.5rem',
            boxShadow: '0 10px 40px rgba(14, 165, 233, 0.3)',
            transition: 'all 0.2s ease',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 20px 50px rgba(14, 165, 233, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 40px rgba(14, 165, 233, 0.3)';
          }}
        >
          Join the Patrol - It's Free! →
        </Link>

        <p style={{
          fontSize: '1.1rem',
          color: '#10b981',
          fontWeight: '700',
          marginTop: '1.5rem',
        }}>
          ✓ 847 pets reunited and counting
        </p>
      </div>

      {/* Benefits Grid */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '3rem 2rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem',
      }}>
        {[
          {
            icon: '🚨',
            title: 'Get Instant Alerts',
            description: 'Be notified immediately when pets go missing in your neighborhood',
          },
          {
            icon: '🗺️',
            title: 'Search Your Area',
            description: 'Set your patrol radius and help during your daily walks or commute',
          },
          {
            icon: '📸',
            title: 'Report Sightings',
            description: 'Spot a lost pet? Report it instantly and help reunite families',
          },
          {
            icon: '🏆',
            title: 'Earn Recognition',
            description: 'Build your reputation as a community hero and earn patrol badges',
          },
        ].map((benefit, index) => (
          <div
            key={index}
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{benefit.icon}</div>
            <h3 style={{
              fontSize: '1.3rem',
              fontWeight: '700',
              marginBottom: '0.75rem',
              color: '#0f172a',
            }}>
              {benefit.title}
            </h3>
            <p style={{
              color: '#64748b',
              lineHeight: '1.6',
              fontSize: '1rem',
            }}>
              {benefit.description}
            </p>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{
        maxWidth: '800px',
        margin: '3rem auto',
        padding: '0 2rem',
      }}>
        <div style={{
          height: '1px',
          background: 'linear-gradient(to right, transparent, #e2e8f0, transparent)',
        }} />
      </div>

      {/* Secondary Actions */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '2rem 2rem 5rem',
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          textAlign: 'center',
          color: '#475569',
          marginBottom: '2rem',
        }}>
          Need Immediate Help?
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}>
          {/* Lost Pet Quick Action */}
          <Link
            href="/report/new"
            style={{
              background: '#fef2f2',
              border: '2px solid #fecaca',
              borderRadius: '12px',
              padding: '2rem',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              display: 'block',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#dc2626';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#fecaca';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              fontSize: '2.5rem',
              marginBottom: '1rem',
            }}>
              🚨
            </div>
            <h3 style={{
              fontSize: '1.4rem',
              fontWeight: '700',
              marginBottom: '0.5rem',
              color: '#dc2626',
            }}>
              Lost Your Pet?
            </h3>
            <p style={{
              color: '#991b1b',
              fontSize: '0.95rem',
              lineHeight: '1.5',
            }}>
              Get immediate help from the community. Alert everyone in your area right now.
            </p>
          </Link>

          {/* Found Pet Quick Action */}
          <Link
            href="/report/found"
            style={{
              background: '#f0fdf4',
              border: '2px solid #bbf7d0',
              borderRadius: '12px',
              padding: '2rem',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              display: 'block',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#bbf7d0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              fontSize: '2.5rem',
              marginBottom: '1rem',
            }}>
              🎉
            </div>
            <h3 style={{
              fontSize: '1.4rem',
              fontWeight: '700',
              marginBottom: '0.5rem',
              color: '#10b981',
            }}>
              Found a Pet?
            </h3>
            <p style={{
              color: '#065f46',
              fontSize: '0.95rem',
              lineHeight: '1.5',
            }}>
              Help reunite a lost pet with their family. Report your finding and we'll match them.
            </p>
          </Link>
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{
        background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
        padding: '4rem 2rem',
        textAlign: 'center',
        color: 'white',
      }}>
        <h2 style={{
          fontSize: '2.5rem',
          fontWeight: '900',
          marginBottom: '1rem',
        }}>
          Ready to Make a Difference?
        </h2>
        <p style={{
          fontSize: '1.2rem',
          marginBottom: '2rem',
          opacity: 0.95,
        }}>
          Join thousands of neighbors helping lost pets find their way home
        </p>
        <Link
          href="/patrol/join"
          style={{
            display: 'inline-block',
            padding: '1.25rem 3rem',
            background: 'white',
            color: '#0ea5e9',
            borderRadius: '12px',
            textDecoration: 'none',
            fontWeight: '800',
            fontSize: '1.3rem',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Join the Patrol Today →
        </Link>
      </div>
    </div>
  );
}
