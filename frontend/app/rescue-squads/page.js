'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function RescueSquadsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [zip, setZip] = useState(searchParams.get('zip') || '');
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchSquads = async (searchZip) => {
    if (!searchZip || searchZip.length < 5) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads?zip=${searchZip}`);
      if (res.ok) {
        const data = await res.json();
        setSquads(data.squads || []);
      }
    } catch (error) {
      console.error('Failed to fetch squads:', error);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  useEffect(() => {
    const initialZip = searchParams.get('zip');
    if (initialZip) {
      searchSquads(initialZip);
    }
  }, [searchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    router.push(`/rescue-squads?zip=${zip}`);
    searchSquads(zip);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        padding: '1.5rem 2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>
            🐾 PetRecovery
          </h1>
        </Link>
        
        {session && (
          <Link
            href="/rescue-squads/create"
            style={{
              padding: '0.75rem 1.5rem',
              background: '#0ea5e9',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '0.95rem',
            }}
          >
            + Create New Squad
          </Link>
        )}
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem' }}>
            Find a Rescue Squad
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#64748b', maxWidth: '600px', margin: '0 auto 2rem' }}>
            Join local volunteer teams dedicated to reuniting lost pets with their families.
          </p>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', justifyContent: 'center', maxWidth: '500px', margin: '0 auto' }}>
            <input
              type="text"
              placeholder="Enter ZIP Code"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              style={{
                flex: 1,
                padding: '1rem 1.5rem',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                fontSize: '1.1rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '1rem 2rem',
                background: '#0f172a',
                color: 'white',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '1.1rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {/* Results */}
        {searched && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {squads.length > 0 ? (
              squads.map((squad) => (
                <Link
                  key={squad.id}
                  href={`/rescue-squads/${squad.id}`}
                  style={{
                    background: 'white',
                    padding: '2rem',
                    borderRadius: '16px',
                    textDecoration: 'none',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
                      {squad.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '1rem', color: '#64748b', marginBottom: '1rem' }}>
                      <span>📍 {squad.city}, {squad.state}</span>
                      <span>👥 {squad.memberCount || 0} members</span>
                      <span>🏆 {squad.successfulReunions || 0} reunions</span>
                    </div>
                    <p style={{ color: '#475569', margin: 0 }}>
                      {squad.description || 'No description available.'}
                    </p>
                  </div>
                  <div style={{
                    padding: '0.75rem 1.5rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    borderRadius: '8px',
                    fontWeight: '600',
                  }}>
                    View Squad →
                  </div>
                </Link>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '16px', color: '#64748b' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏜️</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>No squads found nearby</h3>
                <p style={{ marginBottom: '2rem' }}>Be the first to start a Rescue Squad in this area!</p>
                {session ? (
                  <Link
                    href="/rescue-squads/create"
                    style={{
                      padding: '1rem 2rem',
                      background: '#0ea5e9',
                      color: 'white',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      fontWeight: '700',
                    }}
                  >
                    Create a Squad
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    style={{
                      padding: '1rem 2rem',
                      background: '#0f172a',
                      color: 'white',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      fontWeight: '700',
                    }}
                  >
                    Sign in to Create Squad
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
