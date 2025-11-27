'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function Home() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/public/metrics');
        const data = await response.json();
        setMetrics(data);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
        setMetrics(null);
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#fff',
    }}>
      {/* Header */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 1.5rem',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <Link href="/" style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#111827',
            textDecoration: 'none',
          }}>
            PetRecovery
          </Link>
          <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Link href="/database" style={{
              padding: '0.5rem 1rem',
              color: '#374151',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: '500',
            }}>
              Search Database
            </Link>
            <Link href="/rescue-squads" style={{
              padding: '0.5rem 1rem',
              color: '#374151',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: '500',
            }}>
              Rescue Squads
            </Link>
            {session ? (
              <Link href="/dashboard" style={{
                padding: '0.5rem 1rem',
                background: '#111827',
                color: '#fff',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '0.95rem',
                fontWeight: '500',
              }}>
                Dashboard
              </Link>
            ) : (
              <Link href="/login" style={{
                padding: '0.5rem 1rem',
                background: '#111827',
                color: '#fff',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '0.95rem',
                fontWeight: '500',
              }}>
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={{
        padding: 'clamp(3rem, 8vw, 6rem) 1.5rem',
        maxWidth: '800px',
        margin: '0 auto',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: '700',
          color: '#111827',
          marginBottom: '1.5rem',
          lineHeight: '1.2',
        }}>
          Help bring lost pets home
        </h1>
        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.25rem)',
          color: '#6b7280',
          marginBottom: '2rem',
          lineHeight: '1.6',
        }}>
          Community-powered pet recovery. Report a lost or found pet,
          coordinate with local rescue squads, and reunite families.
        </p>

        {!metricsLoading && metrics && (metrics.pets_reunited > 0 || metrics.active_squads > 0) && (
          <p style={{
            fontSize: '0.95rem',
            color: '#059669',
            fontWeight: '500',
            marginBottom: '2rem',
          }}>
            {metrics.pets_reunited > 0
              ? `${metrics.pets_reunited} pets reunited`
              : `${metrics.active_squads} rescue squads active`}
          </p>
        )}

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          <Link href="/report/new" style={{
            padding: '0.875rem 1.75rem',
            background: '#dc2626',
            color: '#fff',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: '600',
          }}>
            Report Lost Pet
          </Link>
          <Link href="/report/found" style={{
            padding: '0.875rem 1.75rem',
            background: '#059669',
            color: '#fff',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: '600',
          }}>
            Report Found Pet
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section style={{
        background: '#f9fafb',
        padding: 'clamp(3rem, 6vw, 5rem) 1.5rem',
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: '600',
            color: '#111827',
            textAlign: 'center',
            marginBottom: '3rem',
          }}>
            How it works
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: '2rem',
          }}>
            {/* Step 1 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#fee2e2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: '#dc2626',
                fontWeight: '700',
                fontSize: '1.25rem',
              }}>
                1
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '0.5rem',
              }}>
                Report your pet
              </h3>
              <p style={{
                fontSize: '0.95rem',
                color: '#6b7280',
                lineHeight: '1.5',
              }}>
                Submit details about your lost or found pet including photos,
                location, and distinguishing features.
              </p>
            </div>

            {/* Step 2 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#dbeafe',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: '#2563eb',
                fontWeight: '700',
                fontSize: '1.25rem',
              }}>
                2
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '0.5rem',
              }}>
                Get matched
              </h3>
              <p style={{
                fontSize: '0.95rem',
                color: '#6b7280',
                lineHeight: '1.5',
              }}>
                Our system automatically matches lost and found reports
                and notifies potential matches in your area.
              </p>
            </div>

            {/* Step 3 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#d1fae5',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: '#059669',
                fontWeight: '700',
                fontSize: '1.25rem',
              }}>
                3
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '0.5rem',
              }}>
                Reunite
              </h3>
              <p style={{
                fontSize: '0.95rem',
                color: '#6b7280',
                lineHeight: '1.5',
              }}>
                Coordinate with rescue squads and community members
                to safely reunite pets with their families.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 5rem) 1.5rem',
        maxWidth: '1000px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: '2rem',
        }}>
          {/* Search Database */}
          <Link href="/database" style={{
            padding: '1.5rem',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            textDecoration: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2563eb';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e5e7eb';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '0.5rem',
            }}>
              Search Database
            </h3>
            <p style={{
              fontSize: '0.95rem',
              color: '#6b7280',
              lineHeight: '1.5',
              marginBottom: '1rem',
            }}>
              Browse all lost and found pets in your area. No account required.
            </p>
            <span style={{
              color: '#2563eb',
              fontSize: '0.95rem',
              fontWeight: '500',
            }}>
              Browse pets →
            </span>
          </Link>

          {/* Rescue Squads */}
          <Link href="/rescue-squads" style={{
            padding: '1.5rem',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            textDecoration: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#7c3aed';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e5e7eb';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '0.5rem',
            }}>
              Rescue Squads
            </h3>
            <p style={{
              fontSize: '0.95rem',
              color: '#6b7280',
              lineHeight: '1.5',
              marginBottom: '1rem',
            }}>
              Join local volunteer groups to coordinate searches and help reunite pets.
            </p>
            <span style={{
              color: '#7c3aed',
              fontSize: '0.95rem',
              fontWeight: '500',
            }}>
              Find squads →
            </span>
          </Link>

          {/* My Pets */}
          <Link href={session ? "/pets" : "/login"} style={{
            padding: '1.5rem',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            textDecoration: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#059669';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e5e7eb';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '0.5rem',
            }}>
              Register Your Pets
            </h3>
            <p style={{
              fontSize: '0.95rem',
              color: '#6b7280',
              lineHeight: '1.5',
              marginBottom: '1rem',
            }}>
              Pre-register your pets so you can quickly report if they ever go missing.
            </p>
            <span style={{
              color: '#059669',
              fontSize: '0.95rem',
              fontWeight: '500',
            }}>
              {session ? 'Manage pets →' : 'Sign in →'}
            </span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #e5e7eb',
        padding: '2rem 1.5rem',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: '0.875rem',
          color: '#9ca3af',
        }}>
          PetRecovery.org — Helping reunite lost pets with their families
        </p>
      </footer>
    </div>
  );
}
