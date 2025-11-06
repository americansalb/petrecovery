'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState({
    myActiveAlerts: 0,
    totalSightings: 0,
    nearbyAlerts: 0,
    petsReunited: 0,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    // TODO: Fetch real stats from API
    // Mock data for now
    setStats({
      myActiveAlerts: 2,
      totalSightings: 5,
      nearbyAlerts: 12,
      petsReunited: 847,
    });
  }, []);

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}></div>
          <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    marginBottom: '1rem',
  };

  const statCardStyle = {
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    padding: '1.25rem',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    textAlign: 'center',
    border: '2px solid #e5e7eb',
  };

  const buttonStyle = {
    padding: '1rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    borderRadius: '0.75rem',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    textDecoration: 'none',
    display: 'block',
    textAlign: 'center',
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#1e40af',
        color: 'white',
        padding: '1rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              PetRecovery
            </h1>
            <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              Welcome back, {session.user?.name || session.user?.email?.split('@')[0]}
            </p>
          </div>
          <Link
            href="/profile"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '0.5rem',
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Profile
          </Link>
        </div>
      </div>

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '1.5rem 1rem',
      }}>
        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          <div style={statCardStyle}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626', marginBottom: '0.25rem' }}>
              {stats.myActiveAlerts}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>
              My Active Alerts
            </div>
          </div>

          <div style={statCardStyle}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb', marginBottom: '0.25rem' }}>
              {stats.totalSightings}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>
              Total Sightings
            </div>
          </div>

          <div style={statCardStyle}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '0.25rem' }}>
              {stats.nearbyAlerts}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>
              Nearby Alerts
            </div>
          </div>

          <div style={statCardStyle}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.25rem' }}>
              {stats.petsReunited}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>
              Pets Reunited
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
            Quick Actions
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            <Link
              href="/report/new"
              style={{
                ...buttonStyle,
                backgroundColor: '#dc2626',
                color: 'white',
              }}
            >
              🚨 Report Lost Pet
            </Link>
            <Link
              href="/alerts"
              style={{
                ...buttonStyle,
                backgroundColor: '#2563eb',
                color: 'white',
              }}
            >
              📍 View Nearby Alerts
            </Link>
            <Link
              href="/sightings/report"
              style={{
                ...buttonStyle,
                backgroundColor: '#10b981',
                color: 'white',
              }}
            >
              👁️ Report a Sighting
            </Link>
            <Link
              href="/patrol/join"
              style={{
                ...buttonStyle,
                backgroundColor: '#8b5cf6',
                color: 'white',
              }}
            >
              🔔 Join Watch
            </Link>
          </div>
        </div>

        {/* My Active Alerts */}
        <div style={cardStyle}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
              My Active Alerts
            </h2>
            <Link
              href="/my-alerts"
              style={{
                color: '#2563eb',
                fontSize: '0.875rem',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              View All →
            </Link>
          </div>

          {stats.myActiveAlerts === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#6b7280',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🐾</div>
              <p>No active alerts</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Your lost pet reports will appear here
              </p>
            </div>
          ) : (
            // Mock alert cards
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                padding: '1rem',
                backgroundColor: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '0.75rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#92400e' }}>
                      Max - Golden Retriever
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#78350f', marginBottom: '0.5rem' }}>
                      Last seen: 123 Main St, Chicago
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                      <span style={{ color: '#059669' }}>✓ 3 sightings</span>
                      <span style={{ color: '#6b7280' }}>• 2 days ago</span>
                    </div>
                  </div>
                  <Link
                    href="/alerts/1"
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      textDecoration: 'none',
                    }}
                  >
                    View
                  </Link>
                </div>
              </div>

              <div style={{
                padding: '1rem',
                backgroundColor: '#fee2e2',
                border: '2px solid #dc2626',
                borderRadius: '0.75rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#991b1b' }}>
                      Luna - Tabby Cat
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#7f1d1d', marginBottom: '0.5rem' }}>
                      Last seen: Oak Ave & 5th St
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                      <span style={{ color: '#059669' }}>✓ 2 sightings</span>
                      <span style={{ color: '#6b7280' }}>• 5 days ago</span>
                    </div>
                  </div>
                  <Link
                    href="/alerts/2"
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      textDecoration: 'none',
                    }}
                  >
                    View
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Community Alerts */}
        <div style={cardStyle}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
              Recent Nearby Alerts
            </h2>
            <Link
              href="/alerts"
              style={{
                color: '#2563eb',
                fontSize: '0.875rem',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              View All →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { id: 3, pet: 'Buddy', type: 'Beagle', time: '2h ago', distance: '0.3 mi' },
              { id: 4, pet: 'Mittens', type: 'Black Cat', time: '5h ago', distance: '0.8 mi' },
              { id: 5, pet: 'Charlie', type: 'Lab Mix', time: '1d ago', distance: '1.2 mi' },
            ].map((alert) => (
              <Link
                key={alert.id}
                href={`/alerts/${alert.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#1f2937' }}>
                    {alert.pet} - {alert.type}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {alert.distance} away • {alert.time}
                  </div>
                </div>
                <div style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}>
                  View
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
