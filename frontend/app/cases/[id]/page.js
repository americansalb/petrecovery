'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import tactical components
const TaskCoordination = dynamic(() => import('@/app/components/TaskCoordination'), { ssr: false });
const SquadActivityFeed = dynamic(() => import('@/app/components/SquadActivityFeed'), { ssr: false });

export default function CaseDetailPage({ params }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, tasks, activity, chat, map

  // User's squad assignment for this case
  const [userAssignment, setUserAssignment] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    loadCase();
  }, [params.id, session]);

  const loadCase = async () => {
    try {
      const res = await fetch(`/api/cases/${params.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load case');
      }

      setCaseData(data.case);

      // Check if user is part of a squad working on this case
      if (session?.user?.id && data.case.assignments) {
        for (const assignment of data.case.assignments) {
          const participant = assignment.participants?.find(p => p.userId === session.user.id && p.isActive);
          if (participant) {
            setUserAssignment(assignment);
            // Get user's role in the squad
            const membership = assignment.rescueSquad.members?.find(m => m.userId === session.user.id);
            setUserRole(membership?.role);
            break;
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const daysSinceLastSeen = caseData
    ? Math.floor((new Date() - new Date(caseData.lastSeenAt)) / (1000 * 60 * 60 * 24))
    : 0;
  const isUrgent = daysSinceLastSeen <= 2;

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading case details...</div>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: '2rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          maxWidth: '500px'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626', marginBottom: '1rem' }}>
            Case Not Found
          </h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            {error || 'The case you\'re looking for doesn\'t exist.'}
          </p>
          <Link href="/cases" style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            background: '#667eea',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '700'
          }}>
            ← Browse Cases
          </Link>
        </div>
      </div>
    );
  }

  const isParticipating = !!userAssignment;
  const isLeader = userRole && ['FOUNDER', 'LEADER'].includes(userRole);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '2rem 1rem'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header Section */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2.5rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          ...(isUrgent && { border: '3px solid #dc2626' })
        }}>
          <Link href="/cases" style={{
            display: 'inline-block',
            color: '#667eea',
            textDecoration: 'none',
            fontWeight: '700',
            marginBottom: '1.5rem'
          }}>
            ← Back to Cases
          </Link>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '2rem',
            alignItems: 'start'
          }}>
            {/* Pet Photo */}
            <div style={{ position: 'relative' }}>
              <img
                src={caseData.petPhotoUrl || '/placeholder-pet.jpg'}
                alt={caseData.petName}
                style={{
                  width: '200px',
                  height: '200px',
                  borderRadius: '16px',
                  objectFit: 'cover',
                  border: '4px solid white',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
                }}
              />
              {isUrgent && (
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '900',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  🔥 URGENT
                </div>
              )}
            </div>

            {/* Case Info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <h1 style={{
                  fontSize: '2.5rem',
                  fontWeight: '900',
                  color: '#0f172a',
                  margin: 0
                }}>
                  {caseData.petName}
                </h1>
                <div style={{
                  padding: '0.5rem 1rem',
                  background: caseData.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                  color: caseData.status === 'ACTIVE' ? '#166534' : '#991b1b',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: '800',
                  textTransform: 'uppercase'
                }}>
                  {caseData.status}
                </div>
              </div>

              <div style={{
                fontSize: '1.1rem',
                color: '#64748b',
                marginBottom: '1.5rem',
                fontWeight: '600'
              }}>
                {caseData.petSpecies} • {caseData.petBreed || 'Mixed'} • {caseData.petColor} • {caseData.petSize}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '700' }}>
                    Last Seen
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: isUrgent ? '#dc2626' : '#0f172a' }}>
                    {daysSinceLastSeen === 0 ? 'Today' : `${daysSinceLastSeen} day${daysSinceLastSeen === 1 ? '' : 's'} ago`}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>
                    {new Date(caseData.lastSeenAt).toLocaleDateString()}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '700' }}>
                    Location
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>
                    📍 {caseData.lastSeenAddress}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '700' }}>
                    Case Number
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: '#667eea', fontFamily: 'monospace' }}>
                    {caseData.caseNumber}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div style={{
                padding: '1.5rem',
                background: '#f8fafc',
                borderRadius: '12px',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Description
                </div>
                <div style={{ fontSize: '1rem', color: '#475569', lineHeight: '1.6' }}>
                  {caseData.petDescription}
                </div>
              </div>

              {/* Owner Contact */}
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                borderRadius: '12px',
                border: '2px solid #3b82f6'
              }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e40af', marginBottom: '0.75rem' }}>
                  📞 Owner Contact
                </div>
                <div style={{ fontSize: '0.95rem', color: '#1e40af' }}>
                  <strong>{caseData.ownerName}</strong> • {caseData.ownerPhone} • {caseData.ownerEmail}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Participation Status */}
        {isParticipating && (
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '3px solid #10b981',
            borderRadius: '16px',
            padding: '1.5rem 2rem',
            marginBottom: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2rem' }}>✓</div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#065f46' }}>
                  You're On This Case
                </div>
                <div style={{ fontSize: '0.95rem', color: '#047857' }}>
                  Working with {userAssignment.rescueSquad.name}
                </div>
              </div>
            </div>
            <Link
              href={`/rescue-squads/${userAssignment.rescueSquadId}`}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                color: '#10b981',
                border: '2px solid #10b981',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '800',
                transition: 'all 0.2s'
              }}
            >
              → View Squad
            </Link>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto'
          }}>
            {[
              { id: 'overview', label: '📋 Overview', icon: '📋' },
              { id: 'tasks', label: '🎯 Tasks', icon: '🎯', requiresParticipation: true },
              { id: 'activity', label: '📡 Activity', icon: '📡', requiresParticipation: true },
              { id: 'chat', label: '💬 Chat', icon: '💬', requiresParticipation: true },
              { id: 'map', label: '🗺️ Search Map', icon: '🗺️' }
            ].map(tab => {
              if (tab.requiresParticipation && !isParticipating) return null;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: activeTab === tab.id
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'transparent',
                    color: activeTab === tab.id ? 'white' : '#64748b',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '800',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '2rem' }}>
              Case Overview
            </h2>

            {/* Squads Working on This Case */}
            {caseData.assignments && caseData.assignments.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem' }}>
                  🚁 Rescue Squads ({caseData.assignments.length})
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {caseData.assignments.map(assignment => (
                    <div key={assignment.id} style={{
                      padding: '1.5rem',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '2px solid #e2e8f0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                            {assignment.rescueSquad.name}
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>
                            {assignment._count?.participants || 0} members helping • Status: {assignment.status}
                          </div>
                        </div>
                        <Link
                          href={`/rescue-squads/${assignment.rescueSquadId}`}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#667eea',
                            color: 'white',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontWeight: '700',
                            fontSize: '0.9rem'
                          }}
                        >
                          View Squad →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Call to Action for Non-Participants */}
            {!isParticipating && (
              <div style={{
                padding: '2rem',
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: '12px',
                border: '2px solid #f59e0b',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🚨</div>
                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#92400e', marginBottom: '0.5rem' }}>
                  Want to Help Find {caseData.petName}?
                </div>
                <div style={{ fontSize: '1rem', color: '#78350f', marginBottom: '1.5rem' }}>
                  Join a rescue squad to access tasks, team chat, and coordination tools
                </div>
                <Link
                  href="/rescue-squads"
                  style={{
                    display: 'inline-block',
                    padding: '1rem 2rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    fontWeight: '900',
                    fontSize: '1.1rem',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  Find Rescue Squads →
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && isParticipating && userAssignment && (
          <TaskCoordination
            squadId={userAssignment.rescueSquadId}
            caseId={caseData.id}
            caseName={caseData.petName}
            userRole={userRole}
            userId={session?.user?.id}
          />
        )}

        {activeTab === 'activity' && isParticipating && userAssignment && (
          <SquadActivityFeed
            squadId={userAssignment.rescueSquadId}
            caseId={caseData.id}
            isLeader={isLeader}
          />
        )}

        {activeTab === 'chat' && isParticipating && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
              Team Chat Coming Soon
            </div>
            <div style={{ fontSize: '1rem', color: '#64748b' }}>
              Real-time team coordination chat will be available here
            </div>
          </div>
        )}

        {activeTab === 'map' && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
              Search Map Coming Soon
            </div>
            <div style={{ fontSize: '1rem', color: '#64748b' }}>
              Interactive map with search sectors, sightings, and live volunteer tracking
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
