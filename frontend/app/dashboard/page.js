'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, MapPin, Search, Clock, Award, Shield,
  ChevronRight, Plus, AlertCircle, CheckCircle2,
  Target, TrendingUp, Star, Zap
} from 'lucide-react';

// Rescue level configuration
const RESCUE_LEVELS = {
  PET_OWNER: { label: 'Pet Owner', color: '#64748b', icon: '🐾', next: 'SCOUT' },
  SCOUT: { label: 'Scout', color: '#22c55e', icon: '🔍', next: 'SENTRY' },
  SENTRY: { label: 'Sentry', color: '#3b82f6', icon: '👀', next: 'SHEPHERD' },
  SHEPHERD: { label: 'Shepherd', color: '#8b5cf6', icon: '🧭', next: 'PATHFINDER' },
  PATHFINDER: { label: 'Pathfinder', color: '#f59e0b', icon: '🗺️', next: 'PACK_GUARDIAN' },
  PACK_GUARDIAN: { label: 'Pack Guardian', color: '#ec4899', icon: '🛡️', next: 'PACK_LEGEND' },
  PACK_LEGEND: { label: 'Pack Legend', color: '#dc2626', icon: '⭐', next: null },
};

const SQUAD_ROLES = {
  FOUNDER: { label: 'Founder', color: '#dc2626', icon: Crown },
  LEADER: { label: 'Leader', color: '#f59e0b', icon: Shield },
  COORDINATOR: { label: 'Coordinator', color: '#8b5cf6', icon: Target },
  MEMBER: { label: 'Member', color: '#3b82f6', icon: Users },
};

function Crown(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 17h20v2H2z" />
      <path d="M12 3l3 5 5-2-2 8H6L4 6l5 2z" />
    </svg>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');

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
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        const data = await res.json();
        setUserData(data);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load dashboard');
      } finally {
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
        background: '#f8fafc',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #4f46e5',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            animation: 'spin 1s linear infinite',
          }} />
          <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#64748b', fontWeight: '500' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: '2rem',
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '500px',
          background: 'white',
          padding: '3rem',
          borderRadius: '16px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        }}>
          <AlertCircle size={48} style={{ color: '#dc2626', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
            Dashboard Error
          </h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <Link
              href="/"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#f1f5f9',
                color: '#64748b',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!session || !userData) {
    return null;
  }

  const { user, squads = [], activeCases = [], reports = [], nearbyAlerts = [] } = userData;
  const rescueLevel = RESCUE_LEVELS[user?.rescueLevel] || RESCUE_LEVELS.PET_OWNER;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        padding: '3rem 2rem 4rem',
        color: 'white',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '2rem',
          }}>
            {/* Welcome */}
            <div>
              <p style={{
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Welcome back
              </p>
              <h1 style={{
                fontSize: '2.5rem',
                fontWeight: '800',
                margin: 0,
                lineHeight: 1.2,
              }}>
                {user?.firstName || session.user?.name || 'Rescuer'}
              </h1>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginTop: '1rem',
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: '2rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}>
                  <span style={{ fontSize: '1.25rem' }}>{rescueLevel.icon}</span>
                  {rescueLevel.label}
                </span>
                {squads.length > 0 && (
                  <span style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '2rem',
                    fontSize: '0.875rem',
                  }}>
                    {squads.length} Squad{squads.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1.5rem',
            }}>
              {[
                { label: 'Cases Helped', value: activeCases.length, icon: Target },
                { label: 'Areas Marked', value: user?.areasMarkedCount || 0, icon: MapPin },
                { label: 'Acres Searched', value: Math.round(user?.totalAcreageSearched || 0), icon: Search },
                { label: 'Reunions', value: user?.successfulReunions || 0, icon: Award },
              ].map((stat, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <stat.icon size={20} style={{ opacity: 0.7, marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>{stat.value}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '-2rem auto 0',
        padding: '0 2rem 3rem',
      }}>
        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.75rem',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#dc2626',
          }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: '1.5rem',
        }}>
          {/* Left Column - Main Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Active Cases Section */}
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    borderRadius: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                  }}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                      Active Searches
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                      Cases you're helping with
                    </p>
                  </div>
                </div>
                <Link
                  href="/cases"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    color: '#4f46e5',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    textDecoration: 'none',
                  }}
                >
                  Browse Cases <ChevronRight size={16} />
                </Link>
              </div>

              {activeCases.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: '#f1f5f9',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                  }}>
                    <Search size={28} style={{ color: '#94a3b8' }} />
                  </div>
                  <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontWeight: '600' }}>
                    No Active Searches
                  </h3>
                  <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                    Join a rescue squad to help find lost pets in your area
                  </p>
                  <Link
                    href="/rescue-squads/search"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      background: '#4f46e5',
                      color: 'white',
                      borderRadius: '0.5rem',
                      textDecoration: 'none',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                    }}
                  >
                    <Users size={18} /> Find a Squad
                  </Link>
                </div>
              ) : (
                <div>
                  {activeCases.slice(0, 5).map((caseItem) => (
                    <Link
                      key={caseItem.id}
                      href={`/cases/${caseItem.caseNumber}/coordinate`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem 1.5rem',
                        borderBottom: '1px solid #f1f5f9',
                        textDecoration: 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          background: '#fef2f2',
                          borderRadius: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem',
                        }}>
                          {caseItem.petSpecies === 'DOG' ? '🐕' : caseItem.petSpecies === 'CAT' ? '🐈' : '🐾'}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>
                            {caseItem.petName}
                            <span style={{
                              marginLeft: '0.5rem',
                              padding: '0.125rem 0.5rem',
                              background: '#fef3c7',
                              color: '#92400e',
                              borderRadius: '0.25rem',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                            }}>
                              ACTIVE
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                            {caseItem.city}, {caseItem.state} • {caseItem.activeVolunteers} volunteers
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={20} style={{ color: '#94a3b8' }} />
                    </Link>
                  ))}
                  {activeCases.length > 5 && (
                    <div style={{ padding: '1rem', textAlign: 'center' }}>
                      <Link
                        href="/cases"
                        style={{ color: '#4f46e5', fontWeight: '600', fontSize: '0.875rem', textDecoration: 'none' }}
                      >
                        View all {activeCases.length} cases
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* My Squads Section */}
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                    borderRadius: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                  }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                      My Rescue Squads
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                      Teams you're part of
                    </p>
                  </div>
                </div>
                <Link
                  href="/rescue-squads/search"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.5rem 1rem',
                    background: '#f1f5f9',
                    color: '#4f46e5',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    textDecoration: 'none',
                  }}
                >
                  <Plus size={16} /> Join Squad
                </Link>
              </div>

              {squads.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: '#f1f5f9',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                  }}>
                    <Users size={28} style={{ color: '#94a3b8' }} />
                  </div>
                  <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontWeight: '600' }}>
                    Not in Any Squads Yet
                  </h3>
                  <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                    Join a local rescue squad to coordinate searches with your community
                  </p>
                  <Link
                    href="/rescue-squads/search"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      background: '#4f46e5',
                      color: 'white',
                      borderRadius: '0.5rem',
                      textDecoration: 'none',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                    }}
                  >
                    <Search size={18} /> Find Squads Near You
                  </Link>
                </div>
              ) : (
                <div>
                  {squads.map((squad) => {
                    const roleConfig = SQUAD_ROLES[squad.myRole] || SQUAD_ROLES.MEMBER;
                    const RoleIcon = roleConfig.icon;
                    return (
                      <Link
                        key={squad.id}
                        href={`/rescue-squads/${squad.id}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '1rem 1.5rem',
                          borderBottom: '1px solid #f1f5f9',
                          textDecoration: 'none',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                            borderRadius: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '1.25rem',
                          }}>
                            🚨
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>
                              {squad.name}
                            </div>
                            <div style={{
                              fontSize: '0.8rem',
                              color: '#64748b',
                              marginTop: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                            }}>
                              <span>{squad.city}, {squad.state}</span>
                              <span style={{ color: '#d1d5db' }}>•</span>
                              <span>{squad.memberCount} members</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.375rem 0.75rem',
                            background: `${roleConfig.color}15`,
                            color: roleConfig.color,
                            borderRadius: '2rem',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                          }}>
                            <RoleIcon size={14} />
                            {roleConfig.label}
                          </span>
                          <ChevronRight size={20} style={{ color: '#94a3b8' }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Lost Pet Reports with Mission Control Integration */}
            {reports.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      borderRadius: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                    }}>
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                        Your Lost Pet Reports
                      </h2>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                        Pets you've reported missing
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <Link
                        href={`/cases/${report.caseNumber}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '1rem 1.5rem',
                          textDecoration: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          {report.petPhotoUrl ? (
                            <img
                              src={report.petPhotoUrl}
                              alt={report.petName}
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '0.75rem',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '48px',
                              height: '48px',
                              background: '#fef2f2',
                              borderRadius: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.5rem',
                            }}>
                              {report.petSpecies === 'DOG' ? '🐕' : report.petSpecies === 'CAT' ? '🐈' : '🐾'}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {report.petName}
                              {report.isLive && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.125rem 0.5rem',
                                  background: '#dc2626',
                                  color: 'white',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.65rem',
                                  fontWeight: '700',
                                  animation: 'pulse 2s infinite',
                                }}>
                                  <span style={{ fontSize: '0.5rem' }}>●</span> LIVE
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                              {report.status === 'RESOLVED' ? (
                                <span style={{ color: '#16a34a' }}>✓ Resolved</span>
                              ) : (
                                <>
                                  Missing {report.hoursMissing < 24 ? `${report.hoursMissing}h` : `${Math.floor(report.hoursMissing / 24)}d`}
                                  {report.activeVolunteers > 0 && ` • ${report.activeVolunteers} searching`}
                                  {report.sightings > 0 && ` • ${report.sightings} sightings`}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={20} style={{ color: '#94a3b8' }} />
                      </Link>

                      {/* Mission Control Quick Actions for Active Cases */}
                      {report.status !== 'RESOLVED' && report.status !== 'CLOSED_OTHER' && (
                        <div style={{
                          padding: '0.75rem 1.5rem 1rem',
                          display: 'flex',
                          gap: '0.5rem',
                        }}>
                          {report.isLive ? (
                            <Link
                              href={`/cases/${report.caseNumber}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.5rem 1rem',
                                background: '#dc2626',
                                color: 'white',
                                borderRadius: '0.5rem',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                textDecoration: 'none',
                              }}
                            >
                              <Zap size={14} />
                              Open Mission Control
                            </Link>
                          ) : (
                            <Link
                              href={`/cases/${report.caseNumber}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.5rem 1rem',
                                background: '#4f46e5',
                                color: 'white',
                                borderRadius: '0.5rem',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                textDecoration: 'none',
                              }}
                            >
                              <Zap size={14} />
                              Start Live Search
                            </Link>
                          )}
                          <Link
                            href={`/cases/${report.caseNumber}/coordinate`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.5rem 1rem',
                              background: '#f1f5f9',
                              color: '#475569',
                              borderRadius: '0.5rem',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              textDecoration: 'none',
                            }}
                          >
                            <Target size={14} />
                            Coordinate
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Rescue Level Progress Card */}
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              padding: '1.5rem',
            }}>
              <h3 style={{
                margin: '0 0 1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Your Rescue Level
              </h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem',
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  background: `linear-gradient(135deg, ${rescueLevel.color}20 0%, ${rescueLevel.color}40 100%)`,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  border: `3px solid ${rescueLevel.color}`,
                }}>
                  {rescueLevel.icon}
                </div>
                <div>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: rescueLevel.color
                  }}>
                    {rescueLevel.label}
                  </div>
                  {rescueLevel.next && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Next: {RESCUE_LEVELS[rescueLevel.next]?.label}
                    </div>
                  )}
                </div>
              </div>
              {rescueLevel.next && (
                <div style={{
                  background: '#f1f5f9',
                  borderRadius: '0.5rem',
                  height: '8px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    background: `linear-gradient(90deg, ${rescueLevel.color} 0%, ${RESCUE_LEVELS[rescueLevel.next]?.color || rescueLevel.color} 100%)`,
                    height: '100%',
                    width: '35%',
                    borderRadius: '0.5rem',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              padding: '1.5rem',
            }}>
              <h3 style={{
                margin: '0 0 1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Quick Actions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Link
                  href="/report/new"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.875rem 1rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '0.75rem',
                    textDecoration: 'none',
                    color: '#dc2626',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                  }}
                >
                  <AlertCircle size={20} />
                  Report Lost Pet
                </Link>
                <Link
                  href="/found"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.875rem 1rem',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '0.75rem',
                    textDecoration: 'none',
                    color: '#16a34a',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                  }}
                >
                  <CheckCircle2 size={20} />
                  Report Found Pet
                </Link>
                <Link
                  href="/rescue-squads/search"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.875rem 1rem',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    textDecoration: 'none',
                    color: '#475569',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                  }}
                >
                  <Search size={20} />
                  Find Rescue Squads
                </Link>
              </div>
            </div>

            {/* Nearby Alerts (if patrol member) */}
            {nearbyAlerts.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                padding: '1.5rem',
              }}>
                <h3 style={{
                  margin: '0 0 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Nearby Lost Pets
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {nearbyAlerts.slice(0, 5).map((alert) => (
                    <Link
                      key={alert.id}
                      href={`/cases/${alert.id}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: '#fef2f2',
                        borderRadius: '0.5rem',
                        textDecoration: 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', color: '#dc2626', fontSize: '0.9rem' }}>
                          {alert.petName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {alert.distance} away
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: '#dc2626' }} />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Tips Card */}
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              borderRadius: '1rem',
              padding: '1.5rem',
              border: '1px solid #f59e0b',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Star size={18} style={{ color: '#d97706' }} />
                <span style={{ fontWeight: '700', color: '#92400e' }}>Pro Tip</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#78350f', lineHeight: 1.5 }}>
                Join your local rescue squad to get notified about lost pets in your area and help coordinate searches with your neighbors.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
