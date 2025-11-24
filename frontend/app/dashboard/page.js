'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { theme } from '../lib/theme';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchData() {
      if (!session?.user) return;

      try {
        const res = await fetch('/api/dashboard');

        if (!res.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const data = await res.json();
        setUserData(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setUserData({ reports: [], nearbyAlerts: [], user: null, hasPatrolProfile: false });
        setLoading(false);
      }
    }

    if (status === 'authenticated') {
      fetchData();
    }
  }, [session, status]);


  if (status === 'loading' || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      }}>
        <div style={{
          textAlign: 'center',
          background: 'white',
          padding: '3rem',
          borderRadius: theme.radius.xl,
          boxShadow: theme.shadows.lg,
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #dc2626',
            borderRadius: '50%',
            margin: '0 auto 1rem',
          }} className="spin"></div>
          <style jsx>{`
            .spin {
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ color: theme.colors.gray[600], fontWeight: '600' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !userData) {
    return null;
  }

  const reports = userData.reports || [];
  const nearbyAlerts = userData.nearbyAlerts || [];
  const foundByMe = userData.foundByMe || [];
  const hasPatrolProfile = userData.hasPatrolProfile || false;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      fontFamily: theme.fonts.sans,
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        padding: '1.5rem 2rem',
        boxShadow: theme.shadows.sm,
        borderBottom: '1px solid #f1f5f9',
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
          <Link
            href="/"
            style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              color: '#1e293b',
              textDecoration: 'none',
            }}
          >
            🐾 PetRecovery
          </Link>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Rescue Squads Link */}
            <Link
              href="/rescue-squads"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#f1f5f9',
                color: theme.colors.gray[700],
                borderRadius: theme.radius.lg,
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '0.9rem',
              }}
            >
              🚁 Rescue Squads
            </Link>

            {/* Admin Link - only show for admin users */}
            {session?.user?.role === 'ADMIN' && (
              <Link
                href="/admin/rescue-squads"
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#dc2626',
                  color: 'white',
                  borderRadius: theme.radius.lg,
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                }}
              >
                ⚙️ Admin Panel
              </Link>
            )}

            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#f1f5f9',
                color: theme.colors.gray[700],
                border: 'none',
                borderRadius: theme.radius.lg,
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 2rem',
      }}>
        {/* Welcome Section */}
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '900',
            marginBottom: '0.5rem',
            color: theme.colors.gray[900],
          }}>
            Welcome back, {session.user?.name || session.user?.email?.split('@')[0]}!
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: theme.colors.gray[600],
          }}>
            Your pet recovery dashboard
          </p>
        </div>

        {/* Your Lost Pet Reports */}
        <div style={{
          background: 'white',
          borderRadius: theme.radius.xl,
          padding: '2.5rem',
          marginBottom: '2rem',
          boxShadow: theme.shadows.md,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              color: theme.colors.gray[900],
            }}>
              Your Lost Pet Reports
            </h2>
            <Link
              href="/report/new"
              style={{
                padding: '1rem 2rem',
                background: '#dc2626',
                color: 'white',
                borderRadius: theme.radius.lg,
                textDecoration: 'none',
                fontWeight: '700',
                boxShadow: theme.shadows.sm,
              }}
            >
              🚨 Report Lost Pet
            </Link>
          </div>

          {reports.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              background: '#f8fafc',
              borderRadius: theme.radius.lg,
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😊</div>
              <p style={{
                fontSize: '1.1rem',
                color: theme.colors.gray[600],
              }}>
                No active lost pet reports
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {reports.map((report) => (
                <div
                  key={report.id}
                  style={{
                    padding: '1.5rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: theme.radius.lg,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      marginBottom: '0.5rem',
                      color: theme.colors.gray[900],
                    }}>
                      {report.petName}
                    </h3>
                    <p style={{
                      color: theme.colors.gray[600],
                      marginBottom: '0.5rem',
                    }}>
                      Last seen: {report.lastSeen}
                    </p>
                    <p style={{
                      color: '#0ea5e9',
                      fontWeight: '600',
                    }}>
                      {report.sightings} sightings reported
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={async () => {
                        if (confirm(`Mark ${report.petName} as found?`)) {
                          try {
                            const res = await fetch('/api/reports/found', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ reportId: report.id }),
                            });
                            if (res.ok) {
                              window.location.reload();
                            } else {
                              alert('Failed to mark as found. Please try again.');
                            }
                          } catch (err) {
                            alert('Error: ' + err.message);
                          }
                        }
                      }}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: theme.radius.lg,
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      ✓ Found!
                    </button>
                    <Link
                      href={`/reports/${report.id}`}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#f1f5f9',
                        color: theme.colors.gray[700],
                        borderRadius: theme.radius.lg,
                        textDecoration: 'none',
                        fontWeight: '600',
                      }}
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nearby Lost Pets (if patrol member) */}
        {hasPatrolProfile && nearbyAlerts.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: theme.radius.xl,
            padding: '2.5rem',
            marginBottom: '2rem',
            boxShadow: theme.shadows.md,
          }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              marginBottom: '1.5rem',
              color: theme.colors.gray[900],
            }}>
              Nearby Lost Pets
            </h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {nearbyAlerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    padding: '1.5rem',
                    border: '2px solid #fca5a5',
                    background: '#fef2f2',
                    borderRadius: theme.radius.lg,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      background: '#dc2626',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      marginBottom: '0.75rem',
                    }}>
                      LOST
                    </div>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      marginBottom: '0.5rem',
                      color: theme.colors.gray[900],
                    }}>
                      {alert.petName}
                    </h3>
                    <p style={{
                      color: theme.colors.gray[600],
                      marginBottom: '0.5rem',
                    }}>
                      Last seen: {alert.lastSeen}
                    </p>
                    <p style={{
                      color: '#dc2626',
                      fontWeight: '600',
                    }}>
                      📍 {alert.distance} from you
                    </p>
                  </div>
                  <Link
                    href={`/reports/${alert.id}`}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#dc2626',
                      color: 'white',
                      borderRadius: theme.radius.lg,
                      textDecoration: 'none',
                      fontWeight: '700',
                    }}
                  >
                    Help Find →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div style={{
          background: 'white',
          borderRadius: theme.radius.xl,
          padding: '2.5rem',
          boxShadow: theme.shadows.md,
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '800',
            marginBottom: '1.5rem',
            color: theme.colors.gray[900],
          }}>
            Quick Actions
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            <Link
              href="/report/found"
              style={{
                padding: '1.5rem',
                background: '#f0fdf4',
                borderRadius: theme.radius.lg,
                textDecoration: 'none',
                textAlign: 'center',
                border: '2px solid #10b981',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
              <div style={{
                fontWeight: '700',
                color: theme.colors.gray[900],
              }}>
                Report Found Pet
              </div>
            </Link>
            <Link
              href="/advice"
              style={{
                padding: '1.5rem',
                background: '#f8fafc',
                borderRadius: theme.radius.lg,
                textDecoration: 'none',
                textAlign: 'center',
                border: '2px solid #e5e7eb',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💡</div>
              <div style={{
                fontWeight: '700',
                color: theme.colors.gray[900],
              }}>
                Get Advice
              </div>
            </Link>
            <Link
              href="/profile"
              style={{
                padding: '1.5rem',
                background: '#f8fafc',
                borderRadius: theme.radius.lg,
                textDecoration: 'none',
                textAlign: 'center',
                border: '2px solid #e5e7eb',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚙️</div>
              <div style={{
                fontWeight: '700',
                color: theme.colors.gray[900],
              }}>
                Settings
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
