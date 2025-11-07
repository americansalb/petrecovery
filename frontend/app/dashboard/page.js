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
  const [currentView, setCurrentView] = useState('owner'); // 'owner' or 'patrol'
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [pendingView, setPendingView] = useState(null);

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

        // Set initial view based on what the user has
        // Default to patrol if they're in patrol, otherwise owner
        if (data.hasPatrolProfile) {
          setCurrentView('patrol');
        } else {
          setCurrentView('owner');
        }

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

  const handleViewSwitch = (newView) => {
    // Check if user has access to this view
    if (newView === 'patrol' && !userData?.hasPatrolProfile) {
      // Redirect to join patrol page
      router.push('/patrol/join');
      return;
    }

    // Show explanation modal on first switch
    setPendingView(newView);
    setShowSwitchModal(true);
  };

  const confirmViewSwitch = () => {
    setCurrentView(pendingView);
    setShowSwitchModal(false);
    setPendingView(null);
  };

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
            {/* View Switcher */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: theme.radius.lg,
              padding: '0.25rem',
            }}>
              <button
                onClick={() => currentView !== 'owner' && handleViewSwitch('owner')}
                style={{
                  padding: '0.5rem 1rem',
                  background: currentView === 'owner' ? 'white' : 'transparent',
                  color: currentView === 'owner' ? '#dc2626' : theme.colors.gray[600],
                  border: 'none',
                  borderRadius: theme.radius.md,
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: currentView === 'owner' ? theme.shadows.sm : 'none',
                  transition: 'all 0.2s',
                }}
              >
                🏠 Owner View
              </button>
              <button
                onClick={() => currentView !== 'patrol' && handleViewSwitch('patrol')}
                style={{
                  padding: '0.5rem 1rem',
                  background: currentView === 'patrol' ? 'white' : 'transparent',
                  color: currentView === 'patrol' ? '#0ea5e9' : theme.colors.gray[600],
                  border: 'none',
                  borderRadius: theme.radius.md,
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: currentView === 'patrol' ? theme.shadows.sm : 'none',
                  transition: 'all 0.2s',
                }}
              >
                🦸 Patrol View
              </button>
            </div>

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

      {/* Modal for View Switch Explanation */}
      {showSwitchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem',
        }}>
          <div style={{
            background: 'white',
            borderRadius: theme.radius.xl,
            padding: '2.5rem',
            maxWidth: '500px',
            boxShadow: theme.shadows.xl,
          }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              marginBottom: '1rem',
              color: theme.colors.gray[900],
            }}>
              {pendingView === 'patrol' ? '🦸 Switching to Patrol View' : '🏠 Switching to Owner View'}
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: theme.colors.gray[700],
              lineHeight: '1.6',
              marginBottom: '1.5rem',
            }}>
              {pendingView === 'patrol'
                ? "You'll now see lost pets in your patrol area and can help reunite them with their families."
                : "You'll now see your active lost pet reports and can manage them from this view."}
            </p>
            <p style={{
              fontSize: '0.95rem',
              color: theme.colors.gray[600],
              marginBottom: '2rem',
              background: '#f8fafc',
              padding: '1rem',
              borderRadius: theme.radius.md,
            }}>
              💡 You can switch between views anytime using the toggle at the top of the page.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowSwitchModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  color: theme.colors.gray[700],
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmViewSwitch}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: pendingView === 'patrol' ? '#0ea5e9' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Switch View
              </button>
            </div>
          </div>
        </div>
      )}

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
            {currentView === 'patrol'
              ? "You're helping reunite pets with their families"
              : "Manage your lost pet reports and track recovery progress"}
          </p>
        </div>

        {/* Owner View */}
        {currentView === 'owner' && (
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
                flexWrap: 'wrap',
                gap: '1rem',
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
                  {!hasPatrolProfile && (
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
                  )}
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
          </>
        )}

        {/* Patrol View */}
        {currentView === 'patrol' && (
          <>
            {!hasPatrolProfile ? (
              <div style={{
                background: 'white',
                borderRadius: theme.radius.xl,
                padding: '3rem 2.5rem',
                textAlign: 'center',
                boxShadow: theme.shadows.md,
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🦸</div>
                <h2 style={{
                  fontSize: '2rem',
                  fontWeight: '800',
                  marginBottom: '1rem',
                  color: theme.colors.gray[900],
                }}>
                  Join the Community Patrol
                </h2>
                <p style={{
                  fontSize: '1.1rem',
                  color: theme.colors.gray[600],
                  marginBottom: '2rem',
                  maxWidth: '600px',
                  margin: '0 auto 2rem',
                }}>
                  Help reunite lost pets with their families by receiving alerts about missing pets in your area.
                </p>
                <Link
                  href="/patrol/join"
                  style={{
                    display: 'inline-block',
                    padding: '1.25rem 2.5rem',
                    background: '#0ea5e9',
                    color: 'white',
                    borderRadius: theme.radius.lg,
                    textDecoration: 'none',
                    fontWeight: '700',
                    fontSize: '1.1rem',
                    boxShadow: theme.shadows.md,
                  }}
                >
                  Join Patrol Now →
                </Link>
              </div>
            ) : (
              <>
                {/* Patrol Database Access */}
                <div style={{
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  borderRadius: theme.radius.xl,
                  padding: '2.5rem',
                  marginBottom: '2rem',
                  boxShadow: theme.shadows.md,
                  color: 'white',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1.5rem',
                  }}>
                    <div>
                      <div style={{
                        display: 'inline-block',
                        padding: '0.5rem 1rem',
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: theme.radius.md,
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        marginBottom: '1rem',
                      }}>
                        🦸 PATROL MEMBER EXCLUSIVE
                      </div>
                      <h2 style={{
                        fontSize: '1.75rem',
                        fontWeight: '800',
                        marginBottom: '0.75rem',
                      }}>
                        Pet Recovery Database
                      </h2>
                      <p style={{
                        fontSize: '1.05rem',
                        opacity: 0.95,
                      }}>
                        Search and browse all lost & found pet reports in one place. Full access to contact information and detailed records.
                      </p>
                    </div>
                    <Link
                      href="/database"
                      style={{
                        padding: '1.25rem 2.5rem',
                        background: 'white',
                        color: '#0ea5e9',
                        borderRadius: theme.radius.lg,
                        textDecoration: 'none',
                        fontWeight: '700',
                        fontSize: '1.1rem',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      🔍 Open Database →
                    </Link>
                  </div>
                </div>

                {/* Pets You Found Section */}
                {foundByMe.length > 0 && (
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
                      🎉 Pets You Found
                    </h2>
                    <p style={{
                      fontSize: '1.05rem',
                      color: theme.colors.gray[600],
                      marginBottom: '2rem',
                    }}>
                      Thank you for reporting these found pets!
                    </p>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {foundByMe.map((pet) => (
                        <div
                          key={pet.id}
                          style={{
                            padding: '1.5rem',
                            border: '2px solid #10b981',
                            background: '#f0fdf4',
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
                              background: '#10b981',
                              color: 'white',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              marginBottom: '0.75rem',
                            }}>
                              FOUND
                            </div>
                            <h3 style={{
                              fontSize: '1.25rem',
                              fontWeight: '700',
                              marginBottom: '0.5rem',
                              color: theme.colors.gray[900],
                            }}>
                              {pet.petName}
                            </h3>
                            <p style={{
                              color: theme.colors.gray[600],
                              marginBottom: '0.5rem',
                            }}>
                              Found: {pet.foundAt}
                            </p>
                          </div>
                          <Link
                            href={`/reports/${pet.id}`}
                            style={{
                              padding: '0.75rem 1.5rem',
                              background: '#10b981',
                              color: 'white',
                              borderRadius: theme.radius.lg,
                              textDecoration: 'none',
                              fontWeight: '700',
                            }}
                          >
                            View Details →
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nearby Lost Pets Section */}
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
                  )}
                </div>
              </>
            )}
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
