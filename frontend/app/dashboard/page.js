'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { theme } from '../lib/theme';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState('owner'); // 'owner' or 'patrol'
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [nearbyAlerts, setNearbyAlerts] = useState([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchData() {
      if (!session?.user) return;

      try {
        // Fetch REAL data from database (no more mock data!)
        const res = await fetch('/api/dashboard');

        if (!res.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const data = await res.json();

        // Set mode based on whether user has patrol profile
        setMode(data.mode);

        // Set reports - will be empty array [] if no reports (NOT fake data)
        setReports(data.reports || []);

        // Set nearby alerts - will be empty array [] if none (NOT fake data)
        setNearbyAlerts(data.nearbyAlerts || []);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        // On error, set empty arrays (show 0, not fake data)
        setReports([]);
        setNearbyAlerts([]);
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

  if (!session) {
    return null;
  }

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
        }}>
          <div>
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
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
            {mode === 'patrol'
              ? "You're helping reunite pets with their families"
              : "Manage your lost pet reports and community alerts"}
          </p>
        </div>

        {/* Owner Mode: Active Reports */}
        {mode === 'owner' && (
          <>
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
              }}>
                <h2 style={{
                  fontSize: '1.75rem',
                  fontWeight: '800',
                  color: theme.colors.gray[900],
                }}>
                  Your Active Reports
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
                    marginBottom: '1.5rem',
                  }}>
                    No active reports. Hope all your pets are safe!
                  </p>
                  <Link
                    href="/patrol/join"
                    style={{
                      display: 'inline-block',
                      padding: '1rem 2rem',
                      background: '#0ea5e9',
                      color: 'white',
                      borderRadius: theme.radius.lg,
                      textDecoration: 'none',
                      fontWeight: '700',
                    }}
                  >
                    Join Community Pet Patrol
                  </Link>
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
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
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
                                  // Refresh the page to show updated data
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
          </>
        )}

        {/* Patrol Mode: Nearby Alerts */}
        {mode === 'patrol' && (
          <>
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
              <p style={{
                fontSize: '1.05rem',
                color: theme.colors.gray[600],
                marginBottom: '2rem',
              }}>
                Keep an eye out for these pets in your patrol area
              </p>

              {nearbyAlerts.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  background: '#f8fafc',
                  borderRadius: theme.radius.lg,
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                  <p style={{
                    fontSize: '1.1rem',
                    color: theme.colors.gray[600],
                  }}>
                    No lost pets in your area right now. Great news!
                  </p>
                </div>
              ) : (
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
              )}
            </div>
          </>
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
            {mode === 'owner' && (
              <Link
                href="/patrol/join"
                style={{
                  padding: '1.5rem',
                  background: '#eff6ff',
                  borderRadius: theme.radius.lg,
                  textDecoration: 'none',
                  textAlign: 'center',
                  border: '2px solid #0ea5e9',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🦸</div>
                <div style={{
                  fontWeight: '700',
                  color: theme.colors.gray[900],
                }}>
                  Join Patrol
                </div>
              </Link>
            )}
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
