'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function CommunitiesPage() {
  const { data: session } = useSession();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/communities');
      if (res.ok) {
        const data = await res.json();
        setCommunities(data.communities || []);
      }
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCommunities = communities.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.geographicScope.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (membership) => {
    if (!membership) return null;
    const styles = {
      PENDING: { bg: '#fef3c7', color: '#92400e', text: 'Pending' },
      APPROVED: { bg: '#d1fae5', color: '#065f46', text: 'Joined' },
      REJECTED: { bg: '#fee2e2', color: '#991b1b', text: 'Rejected' }
    };
    const style = styles[membership.status] || styles.PENDING;
    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        background: style.bg,
        color: style.color,
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '700'
      }}>
        {style.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>Loading communities...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '900',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Communities
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Join local communities to organize pet recovery efforts
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {session && (
              <Link
                href="/communities/my-requests"
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'white',
                  color: '#64748b',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: '700'
                }}
              >
                My Requests
              </Link>
            )}
            <Link
              href="/communities/request"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#667eea',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700'
              }}
            >
              + Request Community
            </Link>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '2rem' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search communities..."
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              outline: 'none'
            }}
          />
        </div>

        {/* Communities Grid */}
        {filteredCommunities.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏘️</div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              No communities found
            </h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Be the first to create a community in your area!
            </p>
            <Link
              href="/communities/request"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                background: '#667eea',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700'
              }}
            >
              Request a Community
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem'
          }}>
            {filteredCommunities.map(community => (
              <Link
                key={community.id}
                href={`/communities/${community.id}`}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '2rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                  border: '2px solid #f1f5f9',
                  transition: 'all 0.2s',
                  display: 'block'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#f1f5f9';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <h3 style={{
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      color: '#0f172a',
                      marginBottom: '0.25rem'
                    }}>
                      {community.name}
                    </h3>
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#64748b'
                    }}>
                      {community.type === 'METRO_AREA' && '🌆 Metro Area'}
                      {community.type === 'COUNTY' && '🏞️ County'}
                      {community.type === 'SUBCOMMUNITY' && '🏘️ Subcommunity'}
                    </div>
                  </div>
                  {community.userMembership && getStatusBadge(community.userMembership)}
                </div>

                {community.description && (
                  <p style={{
                    color: '#64748b',
                    marginBottom: '1rem',
                    fontSize: '0.95rem',
                    lineHeight: '1.5'
                  }}>
                    {community.description.slice(0, 100)}
                    {community.description.length > 100 && '...'}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  gap: '1.5rem',
                  padding: '1rem 0',
                  borderTop: '1px solid #f1f5f9',
                  fontSize: '0.9rem',
                  color: '#64748b'
                }}>
                  <div>
                    <strong style={{ color: '#0f172a' }}>{community.memberCount}</strong> members
                  </div>
                  {community.activeSquadsCount > 0 && (
                    <div>
                      <strong style={{ color: '#0f172a' }}>{community.activeSquadsCount}</strong> active squads
                    </div>
                  )}
                  {community.subcommunityCount > 0 && (
                    <div>
                      <strong style={{ color: '#0f172a' }}>{community.subcommunityCount}</strong> subcommunities
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
