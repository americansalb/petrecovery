'use client';

/**
 * Participant List Component - Phase 1.2
 *
 * Shows list of volunteers participating in the case.
 *
 * Features:
 * - List of participants with stats
 * - Participation status indicators
 * - Contribution stats (areas, sightings, hours)
 */

import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '@/app/components/LoadingSpinner';

export default function ParticipantList({
  assignmentId,
  isLeader,
  currentUserId,
}) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log('[PARTICIPANTS] Component rendering');
  console.log(`[PARTICIPANTS] Assignment ID: ${assignmentId}`);
  console.log(`[PARTICIPANTS] Is leader: ${isLeader}`);

  // Fetch participants
  const fetchParticipants = useCallback(async () => {
    if (!assignmentId) return;

    console.log('[PARTICIPANTS] Fetching participants...');
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/participants`);

      if (!res.ok) {
        throw new Error('Failed to fetch participants');
      }

      const data = await res.json();
      console.log(`[PARTICIPANTS] Fetched ${data.participants?.length || 0} participants`);

      setParticipants(data.participants || []);
      setError(null);
    } catch (err) {
      console.error('[PARTICIPANTS] Error fetching participants:', err);
      setError('Failed to load participants');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchParticipants();

    // Poll every 30 seconds
    const interval = setInterval(fetchParticipants, 30000);
    return () => clearInterval(interval);
  }, [fetchParticipants]);

  // Get rescue level badge
  const getRescueLevelBadge = (level) => {
    const badges = {
      PET_OWNER: { emoji: '🐾', label: 'Pet Owner', color: '#64748b' },
      SCOUT: { emoji: '🔍', label: 'Scout', color: '#22c55e' },
      SENTRY: { emoji: '👀', label: 'Sentry', color: '#3b82f6' },
      SHEPHERD: { emoji: '🧭', label: 'Shepherd', color: '#8b5cf6' },
      PATHFINDER: { emoji: '🗺️', label: 'Pathfinder', color: '#f59e0b' },
      PACK_GUARDIAN: { emoji: '🛡️', label: 'Pack Guardian', color: '#ec4899' },
      PACK_LEGEND: { emoji: '⭐', label: 'Pack Legend', color: '#dc2626' },
    };
    return badges[level] || badges.SCOUT;
  };

  // Calculate stats
  const activeParticipants = participants.filter((p) => p.isActive);
  const totalAreas = participants.reduce((sum, p) => sum + (p.areasMarked || 0), 0);
  const totalSightings = participants.reduce((sum, p) => sum + (p.sightingsReported || 0), 0);
  const totalHours = participants.reduce((sum, p) => sum + (p.searchHours || 0), 0);

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
      }}>
        <LoadingSpinner text="Loading team..." />
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '1rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.1rem',
          fontWeight: '600',
          color: '#0f172a',
        }}>
          👥 Search Team
        </h2>
        <p style={{
          margin: '0.25rem 0 0 0',
          fontSize: '0.8rem',
          color: '#64748b',
        }}>
          {activeParticipants.length} active volunteers
        </p>
      </div>

      {/* Team stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        padding: '1.5rem',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '1.75rem',
            fontWeight: '700',
            color: '#2563eb',
          }}>
            {activeParticipants.length}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: '#64748b',
            marginTop: '0.25rem',
          }}>
            Active
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '1.75rem',
            fontWeight: '700',
            color: '#10b981',
          }}>
            {totalAreas}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: '#64748b',
            marginTop: '0.25rem',
          }}>
            Areas Marked
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '1.75rem',
            fontWeight: '700',
            color: '#f59e0b',
          }}>
            {totalSightings}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: '#64748b',
            marginTop: '0.25rem',
          }}>
            Sightings
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '1.75rem',
            fontWeight: '700',
            color: '#8b5cf6',
          }}>
            {totalHours.toFixed(1)}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: '#64748b',
            marginTop: '0.25rem',
          }}>
            Search Hours
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem 1.5rem',
          background: '#fef2f2',
          color: '#dc2626',
          fontSize: '0.875rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Participants list */}
      <div style={{
        maxHeight: '500px',
        overflowY: 'auto',
      }}>
        {participants.length === 0 ? (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            color: '#64748b',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
            <p>No volunteers have joined yet.</p>
            <p style={{ fontSize: '0.875rem' }}>
              Be the first to join the search!
            </p>
          </div>
        ) : (
          participants.map((participant) => {
            const badge = getRescueLevelBadge(participant.user?.rescueLevel);
            const isCurrentUser = participant.userId === currentUserId;

            return (
              <div
                key={participant.id}
                style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: isCurrentUser ? '#eff6ff' : 'white',
                  opacity: participant.isActive ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Avatar */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${badge.color}33 0%, ${badge.color}66 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    border: `2px solid ${badge.color}`,
                  }}>
                    {badge.emoji}
                  </div>

                  {/* User info */}
                  <div>
                    <div style={{
                      fontWeight: '600',
                      color: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      {participant.user?.firstName || 'Unknown'} {participant.user?.lastName?.[0] || ''}.
                      {isCurrentUser && (
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          background: '#2563eb',
                          color: 'white',
                          borderRadius: '0.25rem',
                          fontSize: '0.7rem',
                        }}>
                          You
                        </span>
                      )}
                      {!participant.isActive && (
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          background: '#fef3c7',
                          color: '#92400e',
                          borderRadius: '0.25rem',
                          fontSize: '0.7rem',
                        }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.8rem',
                      color: badge.color,
                      marginTop: '0.125rem',
                    }}>
                      {badge.emoji} {badge.label}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      marginTop: '0.25rem',
                    }}>
                      Joined {new Date(participant.optedInAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Contribution stats */}
                <div style={{
                  display: 'flex',
                  gap: '1.5rem',
                  alignItems: 'center',
                }}>
                  {/* Areas marked */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      color: '#10b981',
                    }}>
                      {participant.areasMarked || 0}
                    </div>
                    <div style={{
                      fontSize: '0.65rem',
                      color: '#64748b',
                    }}>
                      Areas
                    </div>
                  </div>

                  {/* Sightings */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      color: '#f59e0b',
                    }}>
                      {participant.sightingsReported || 0}
                    </div>
                    <div style={{
                      fontSize: '0.65rem',
                      color: '#64748b',
                    }}>
                      Sightings
                    </div>
                  </div>

                  {/* Hours */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      color: '#8b5cf6',
                    }}>
                      {(participant.searchHours || 0).toFixed(1)}
                    </div>
                    <div style={{
                      fontSize: '0.65rem',
                      color: '#64748b',
                    }}>
                      Hours
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer with legend */}
      {participants.length > 0 && (
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}>
          <h4 style={{
            margin: '0 0 0.75rem 0',
            fontSize: '0.8rem',
            fontWeight: '600',
            color: '#64748b',
          }}>
            Rescue Levels
          </h4>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            {Object.entries({
              SCOUT: 'New member',
              SENTRY: 'First case',
              SHEPHERD: '5+ areas',
              PATHFINDER: '1+ reunion',
              PACK_GUARDIAN: '5+ reunions',
              PACK_LEGEND: '50+ reunions',
            }).map(([level, desc]) => {
              const badge = getRescueLevelBadge(level);
              return (
                <span
                  key={level}
                  style={{
                    fontSize: '0.7rem',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span style={{ color: badge.color }}>{badge.emoji}</span>
                  {badge.label}: {desc}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
