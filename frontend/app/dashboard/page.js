'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMode } from '../contexts/ModeContext';
import ModeSwitcher from '../components/ModeSwitcher';
import PetMap from '../components/PetMap';
import { theme, card } from '../lib/theme';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { mode } = useMode();
  const [stats, setStats] = useState({
    myActiveAlerts: 2,
    totalSightings: 5,
    nearbyAlerts: 12,
    petsReunited: 847,
    patrolMembers: 234,
  });

  const [mapMarkers, setMapMarkers] = useState([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    // Mock map markers
    setMapMarkers([
      {
        position: [41.8781, -87.6298],
        type: 'lost',
        popup: '<strong>Max - Golden Retriever</strong><br/>Last seen 2 hours ago',
      },
      {
        position: [41.8801, -87.6258],
        type: 'sighting',
        popup: '<strong>Sighting of Max</strong><br/>1 hour ago',
      },
      {
        position: [41.8761, -87.6338],
        type: 'lost',
        popup: '<strong>Luna - Tabby Cat</strong><br/>Last seen 5 hours ago',
      },
    ]);
  }, []);

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.gradients.sky,
      }}>
        <div style={{
          textAlign: 'center',
          ...card(),
          padding: '2rem',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #ff6b9d',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }}></div>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ color: theme.colors.gray[600], fontWeight: '500' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const isPetOwner = mode === 'pet-owner';
  const gradient = isPetOwner ? theme.gradients.warmth : theme.gradients.hope;
  const primaryColor = isPetOwner ? theme.colors.petOwner.primary : theme.colors.patrol.primary;

  return (
    <div style={{
      minHeight: '100vh',
      background: gradient,
      fontFamily: theme.fonts.sans,
    }}>
      {/* Beautiful Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '1.5rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              background: gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '0.25rem',
            }}>
              Welcome Back, {session.user?.name || 'Friend'}!
            </h1>
            <p style={{
              color: theme.colors.gray[600],
              fontSize: '0.95rem',
            }}>
              {isPetOwner
                ? "Managing your pet's recovery journey"
                : "You're making a difference in your community 🦸"}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <ModeSwitcher />
            <Link
              href="/profile"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                fontSize: '1.5rem',
                boxShadow: theme.shadows.sm,
              }}
            >
              👤
            </Link>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '2rem 1rem',
      }}>
        {/* Pet Owner Mode */}
        {isPetOwner && (
          <>
            {/* Emergency CTA */}
            <div style={{
              ...card('pet-owner'),
              background: theme.gradients.sunset,
              color: 'white',
              marginBottom: '2rem',
              textAlign: 'center',
            }}>
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: '800',
                marginBottom: '0.5rem',
              }}>
                Missing a Pet?
              </h2>
              <p style={{
                fontSize: '1.1rem',
                marginBottom: '1.5rem',
                opacity: 0.95,
              }}>
                Every second counts. Get expert advice and alert your community now.
              </p>
              <Link
                href="/report/new"
                style={{
                  display: 'inline-block',
                  padding: '1rem 2.5rem',
                  background: 'white',
                  color: theme.colors.petOwner.primary,
                  borderRadius: theme.radius.full,
                  textDecoration: 'none',
                  fontWeight: '700',
                  fontSize: '1.1rem',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                🚨 Report Lost Pet Now
              </Link>
            </div>

            {/* Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem',
            }}>
              <div style={{
                ...card('pet-owner'),
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: '800',
                  background: theme.gradients.sunset,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginBottom: '0.5rem',
                }}>
                  {stats.myActiveAlerts}
                </div>
                <div style={{
                  color: theme.colors.gray[600],
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}>
                  Active Alerts
                </div>
              </div>

              <div style={{
                ...card('pet-owner'),
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: '800',
                  background: theme.gradients.forest,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginBottom: '0.5rem',
                }}>
                  {stats.totalSightings}
                </div>
                <div style={{
                  color: theme.colors.gray[600],
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}>
                  Total Sightings
                </div>
              </div>

              <div style={{
                ...card('pet-owner'),
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: '800',
                  background: theme.gradients.ocean,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginBottom: '0.5rem',
                }}>
                  {stats.patrolMembers}
                </div>
                <div style={{
                  color: theme.colors.gray[600],
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}>
                  Heroes Helping
                </div>
              </div>
            </div>

            {/* Map View */}
            <div style={{ ...card('pet-owner'), marginBottom: '2rem' }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                marginBottom: '1rem',
                color: theme.colors.gray[800],
              }}>
                📍 Your Pet's Last Known Location
              </h3>
              <PetMap
                center={[41.8781, -87.6298]}
                zoom={14}
                markers={mapMarkers}
                height="450px"
              />
            </div>

            {/* My Active Alerts */}
            <div style={{ ...card('pet-owner'), marginBottom: '2rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: theme.colors.gray[800],
                }}>
                  🐾 Your Lost Pets
                </h3>
                <Link
                  href="/my-alerts"
                  style={{
                    color: primaryColor,
                    textDecoration: 'none',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                  }}
                >
                  View All →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  {
                    name: 'Max',
                    type: 'Golden Retriever',
                    time: '2 days ago',
                    sightings: 3,
                    emoji: '🐕',
                  },
                  {
                    name: 'Luna',
                    type: 'Tabby Cat',
                    time: '5 days ago',
                    sightings: 2,
                    emoji: '🐈',
                  },
                ].map((pet, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '1.25rem',
                      background: theme.gradients.sky,
                      borderRadius: theme.radius.md,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        boxShadow: theme.shadows.sm,
                      }}>
                        {pet.emoji}
                      </div>
                      <div>
                        <h4 style={{
                          fontSize: '1.25rem',
                          fontWeight: '700',
                          marginBottom: '0.25rem',
                          color: theme.colors.gray[900],
                        }}>
                          {pet.name}
                        </h4>
                        <p style={{
                          color: theme.colors.gray[600],
                          fontSize: '0.9rem',
                        }}>
                          {pet.type} • Missing {pet.time}
                        </p>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '0.5rem',
                    }}>
                      <div style={{
                        padding: '0.5rem 1rem',
                        background: theme.gradients.forest,
                        color: 'white',
                        borderRadius: theme.radius.full,
                        fontWeight: '700',
                        fontSize: '0.9rem',
                      }}>
                        👁️ {pet.sightings} sightings
                      </div>
                      <Link
                        href={`/alerts/${idx + 1}`}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'white',
                          color: primaryColor,
                          borderRadius: theme.radius.full,
                          textDecoration: 'none',
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          boxShadow: theme.shadows.sm,
                        }}
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Patrol Mode */}
        {!isPetOwner && (
          <>
            {/* Hero Banner */}
            <div style={{
              ...card('patrol'),
              background: theme.gradients.ocean,
              color: 'white',
              marginBottom: '2rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🦸‍♀️</div>
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: '800',
                marginBottom: '0.5rem',
              }}>
                You're a Neighborhood Hero!
              </h2>
              <p style={{
                fontSize: '1.1rem',
                opacity: 0.95,
              }}>
                Thank you for being part of the recovery patrol. You make reunions possible.
              </p>
            </div>

            {/* Patrol Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem',
            }}>
              <div style={{
                ...card('patrol'),
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: '800',
                  background: theme.gradients.sunset,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginBottom: '0.5rem',
                }}>
                  {stats.nearbyAlerts}
                </div>
                <div style={{
                  color: theme.colors.gray[600],
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}>
                  Nearby Alerts
                </div>
              </div>

              <div style={{
                ...card('patrol'),
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: '800',
                  background: theme.gradients.forest,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginBottom: '0.5rem',
                }}>
                  {stats.petsReunited}
                </div>
                <div style={{
                  color: theme.colors.gray[600],
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}>
                  Community Reunions
                </div>
              </div>

              <div style={{
                ...card('patrol'),
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: '800',
                  background: theme.gradients.ocean,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginBottom: '0.5rem',
                }}>
                  5
                </div>
                <div style={{
                  color: theme.colors.gray[600],
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}>
                  Your Sightings
                </div>
              </div>
            </div>

            {/* Map of Nearby Alerts */}
            <div style={{ ...card('patrol'), marginBottom: '2rem' }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                marginBottom: '1rem',
                color: theme.colors.gray[800],
              }}>
                🗺️ Lost Pets in Your Area
              </h3>
              <PetMap
                center={[41.8781, -87.6298]}
                zoom={13}
                markers={mapMarkers}
                height="450px"
              />
            </div>

            {/* Recent Alerts to Help */}
            <div style={{ ...card('patrol'), marginBottom: '2rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: theme.colors.gray[800],
                }}>
                  🚨 Active Alerts Near You
                </h3>
                <Link
                  href="/alerts"
                  style={{
                    color: primaryColor,
                    textDecoration: 'none',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                  }}
                >
                  View All →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  {
                    name: 'Max',
                    type: 'Golden Retriever',
                    location: '0.3 mi away',
                    time: '2 hours ago',
                    emoji: '🐕',
                    urgent: true,
                  },
                  {
                    name: 'Buddy',
                    type: 'Beagle',
                    location: '0.8 mi away',
                    time: '5 hours ago',
                    emoji: '🐕',
                    urgent: false,
                  },
                  {
                    name: 'Luna',
                    type: 'Tabby Cat',
                    location: '1.2 mi away',
                    time: '1 day ago',
                    emoji: '🐈',
                    urgent: false,
                  },
                ].map((pet, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '1.25rem',
                      background: pet.urgent ? theme.gradients.reunion : theme.gradients.sky,
                      borderRadius: theme.radius.md,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: pet.urgent ? '2px solid #ff6b9d' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        boxShadow: theme.shadows.sm,
                      }}>
                        {pet.emoji}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{
                            fontSize: '1.25rem',
                            fontWeight: '700',
                            marginBottom: '0.25rem',
                            color: theme.colors.gray[900],
                          }}>
                            {pet.name}
                          </h4>
                          {pet.urgent && (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              background: theme.colors.status.active,
                              color: 'white',
                              borderRadius: theme.radius.full,
                              fontSize: '0.75rem',
                              fontWeight: '700',
                            }}>
                              URGENT
                            </span>
                          )}
                        </div>
                        <p style={{
                          color: theme.colors.gray[600],
                          fontSize: '0.9rem',
                        }}>
                          {pet.type} • {pet.location} • Missing {pet.time}
                        </p>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '0.5rem',
                    }}>
                      <Link
                        href={`/sightings/report?alertId=${idx + 1}`}
                        style={{
                          padding: '0.75rem 1.25rem',
                          background: theme.gradients.forest,
                          color: 'white',
                          borderRadius: theme.radius.full,
                          textDecoration: 'none',
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          boxShadow: theme.shadows.sm,
                        }}
                      >
                        👁️ Report Sighting
                      </Link>
                      <Link
                        href={`/alerts/${idx + 1}`}
                        style={{
                          padding: '0.75rem 1.25rem',
                          background: 'white',
                          color: primaryColor,
                          borderRadius: theme.radius.full,
                          textDecoration: 'none',
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          boxShadow: theme.shadows.sm,
                        }}
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
