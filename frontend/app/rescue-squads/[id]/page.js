'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function SquadDetailsPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const router = useRouter();

  const [squad, setSquad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const fetchSquad = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${id}`);
      if (!res.ok) throw new Error('Squad not found');
      const data = await res.json();
      setSquad(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSquad();
  }, [id]);

  const handleJoin = async () => {
    if (!session) {
      router.push('/login');
      return;
    }

    setJoining(true);
    try {
      const res = await fetch(`/api/rescue-squads/${id}/join`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to join squad');
      await fetchSquad(); // Refresh data
    } catch (err) {
      alert(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this squad?')) return;

    setJoining(true);
    try {
      const res = await fetch(`/api/rescue-squads/${id}/leave`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to leave squad');
      await fetchSquad(); // Refresh data
    } catch (err) {
      alert(err.message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading squad details...</div>;
  if (error) return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>{error}</div>;
  if (!squad) return null;

  const isMember = squad.members?.some(m => m.userId === session?.user?.id);

  // Helper to format ZIPs
  const formatZips = (zips) => {
    if (!zips) return 'None';
    if (Array.isArray(zips)) return zips.join(', ');
    try {
      return JSON.parse(zips).join(', ');
    } catch (e) {
      return zips;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '3rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Link href="/rescue-squads" style={{ textDecoration: 'none', color: '#64748b', display: 'inline-block', marginBottom: '1rem' }}>
            ← Back to Search
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
                {squad.name}
              </h1>
              <div style={{ display: 'flex', gap: '1.5rem', color: '#64748b', fontSize: '1.1rem' }}>
                <span>📍 {squad.city}, {squad.state}</span>
                <span>📏 {squad.radiusMiles} mile radius</span>
                <span>🎯 {squad.coverageType || 'CITYWIDE'}</span>
              </div>
            </div>

            <div>
              {isMember ? (
                <button
                  onClick={handleLeave}
                  disabled={joining}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'white',
                    color: '#ef4444',
                    border: '2px solid #ef4444',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {joining ? 'Leaving...' : 'Leave Squad'}
                </button>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#0ea5e9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(14, 165, 233, 0.2)',
                  }}
                >
                  {joining ? 'Joining...' : 'Join Squad'}
                </button>
              )}
            </div>
          </div>

          <p style={{ fontSize: '1.2rem', color: '#475569', marginTop: '1.5rem', maxWidth: '700px', lineHeight: '1.6' }}>
            {squad.description}
          </p>

          {/* Stats Row */}
          <div style={{ display: 'flex', gap: '3rem', marginTop: '2rem', borderTop: '1px solid #f1f5f9', paddingTop: '2rem' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>{squad.members?.length || 0}</div>
              <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>Members</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>{squad.successfulReunions || 0}</div>
              <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>Reunions</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>{squad.totalCasesAccepted || 0}</div>
              <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>Cases</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 2rem', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Main Content */}
        <div>
          {/* Details Card */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', marginBottom: '2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: '#0f172a' }}>Squad Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>ZIP Codes Served</div>
                <div style={{ color: '#0f172a', fontSize: '1.1rem' }}>{formatZips(squad.zipCodes)}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>Availability</div>
                <div style={{ color: '#0f172a', fontSize: '1.1rem' }}>{squad.availability247 ? '24/7 Available' : 'Business Hours'}</div>
              </div>
              {squad.contactEmail && (
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>Contact</div>
                  <div style={{ color: '#0ea5e9', fontSize: '1.1rem' }}>{squad.contactEmail}</div>
                </div>
              )}
            </div>
          </div>

          {/* Divisions Section (Restored) */}
          {squad.divisions && squad.divisions.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', marginBottom: '1.5rem' }}>Divisions</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                {squad.divisions.map(division => (
                  <div key={division.id} style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                      {division.name}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                      {division.totalMembers || 0} members
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Cases */}
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', marginBottom: '1.5rem' }}>Active Cases</h2>
          {squad.activeCases?.length > 0 ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {squad.activeCases.map(c => (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  style={{
                    display: 'block',
                    background: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: '700', color: '#0f172a' }}>{c.petName}</span>
                    <span style={{
                      background: c.status === 'URGENT' ? '#fee2e2' : '#e0f2fe',
                      color: c.status === 'URGENT' ? '#dc2626' : '#0284c7',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '99px',
                      fontSize: '0.85rem',
                      fontWeight: '600'
                    }}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.95rem' }}>
                    Last seen near {c.lastSeenAddress}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', textAlign: 'center', color: '#64748b' }}>
              No active cases right now.
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Leaders Section (Restored) */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '1rem' }}>Squad Leaders</h3>
            {squad.members && squad.members.filter(m => ['FOUNDER', 'LEADER'].includes(m.role)).length > 0 ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {squad.members.filter(m => ['FOUNDER', 'LEADER'].includes(m.role)).map(member => (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', background: '#e0e7ff', color: '#4338ca', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                      {member.user.firstName[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>
                        {member.user.firstName} {member.user.lastName?.[0]}.
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{member.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No leaders listed</p>
            )}
          </div>

          {/* All Members */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '1rem' }}>Recent Members</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {squad.members?.slice(0, 5).map(member => (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '32px', height: '32px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {member.user.firstName[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>
                      {member.user.firstName} {member.user.lastName?.[0]}.
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{member.role}</div>
                  </div>
                </div>
              ))}
              {squad.members?.length > 5 && (
                <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  + {squad.members.length - 5} more
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
