'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SquadActivityFeed({ squadId, caseId = null, isLeader = false }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, cases, members, tasks

  useEffect(() => {
    loadActivities();

    // Refresh every 30 seconds
    const interval = setInterval(loadActivities, 30000);
    return () => clearInterval(interval);
  }, [squadId, caseId, filter]);

  const loadActivities = async () => {
    try {
      let url = `/api/rescue-squads/${squadId}/activities?filter=${filter}`;
      if (caseId) {
        url += `&caseId=${caseId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'CASE_ACCEPTED': return '🚨';
      case 'CASE_UPDATED': return '📝';
      case 'CASE_RESOLVED': return '✅';
      case 'MEMBER_JOINED': return '👋';
      case 'MEMBER_OPTED_IN': return '🚀';
      case 'MEMBER_OPTED_OUT': return '⏸️';
      case 'TASK_CREATED': return '📋';
      case 'TASK_COMPLETED': return '✓';
      case 'SIGHTING_REPORTED': return '👀';
      case 'SEARCH_AREA_ASSIGNED': return '🗺️';
      default: return '•';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'CASE_ACCEPTED':
      case 'TASK_CREATED':
      case 'SEARCH_AREA_ASSIGNED':
        return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' }; // Red - urgent
      case 'CASE_RESOLVED':
      case 'TASK_COMPLETED':
        return { bg: '#d1fae5', border: '#10b981', text: '#065f46' }; // Green - success
      case 'MEMBER_JOINED':
      case 'MEMBER_OPTED_IN':
        return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }; // Blue - info
      case 'SIGHTING_REPORTED':
        return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' }; // Yellow - alert
      default:
        return { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' }; // Gray - neutral
    }
  };

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '2rem',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      marginBottom: '2rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '800',
            color: '#0f172a',
            marginBottom: '0.25rem'
          }}>
            📡 Live Activity Feed
          </h2>
          <p style={{
            fontSize: '0.9rem',
            color: '#64748b'
          }}>
            Real-time updates from your squad
          </p>
        </div>

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          background: '#f8fafc',
          padding: '0.25rem',
          borderRadius: '8px',
          border: '2px solid #e2e8f0'
        }}>
          {[
            { value: 'all', label: 'All' },
            { value: 'cases', label: 'Cases' },
            { value: 'members', label: 'Team' },
            { value: 'tasks', label: 'Tasks' }
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={{
                padding: '0.5rem 1rem',
                background: filter === tab.value ? '#667eea' : 'transparent',
                color: filter === tab.value ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#64748b'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          Loading activities...
        </div>
      ) : activities.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '2px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
            No Recent Activity
          </div>
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
            Squad activity will appear here as members work on cases
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {activities.map((activity, idx) => {
            const colors = getActivityColor(activity.type);

            return (
              <div
                key={activity.id || idx}
                style={{
                  position: 'relative',
                  padding: '1rem 1.25rem',
                  background: 'white',
                  border: `2px solid ${colors.border}`,
                  borderLeft: `4px solid ${colors.border}`,
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  cursor: activity.caseId ? 'pointer' : 'default'
                }}
                onMouseEnter={(e) => {
                  if (activity.caseId) {
                    e.currentTarget.style.transform = 'translateX(4px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activity.caseId) {
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
                onClick={() => {
                  if (activity.caseId) {
                    window.location.href = `/cases/internal/${activity.caseId}`;
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem'
                }}>
                  <div style={{ flex: 1 }}>
                    {/* Icon + Message */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{
                        fontSize: '1.5rem',
                        lineHeight: 1
                      }}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: '700',
                        color: '#0f172a',
                        lineHeight: '1.4'
                      }}>
                        {activity.message}
                      </div>
                    </div>

                    {/* Details */}
                    {activity.details && (
                      <div style={{
                        fontSize: '0.9rem',
                        color: '#64748b',
                        marginLeft: '2.25rem',
                        lineHeight: '1.5'
                      }}>
                        {activity.details}
                      </div>
                    )}

                    {/* Actor & Time */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      marginTop: '0.5rem',
                      marginLeft: '2.25rem',
                      fontSize: '0.8rem',
                      color: '#94a3b8'
                    }}>
                      {activity.actorName && (
                        <div style={{ fontWeight: '600' }}>
                          {activity.actorName}
                        </div>
                      )}
                      <div>•</div>
                      <div>
                        {formatTimeAgo(activity.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Action Badge */}
                  {activity.caseId && (
                    <div style={{
                      padding: '0.4rem 0.75rem',
                      background: colors.bg,
                      color: colors.text,
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      whiteSpace: 'nowrap'
                    }}>
                      View →
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Refresh Indicator */}
      <div style={{
        marginTop: '1.5rem',
        padding: '0.75rem',
        background: '#f8fafc',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: '#64748b',
        fontWeight: '600'
      }}>
        🔄 Auto-refreshes every 30 seconds
      </div>
    </div>
  );
}
