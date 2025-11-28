'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  MapPin,
  PawPrint,
  Users,
  ArrowRight,
  Filter,
  Clock,
} from 'lucide-react';

/**
 * SEO Landing Page for Location-based Lost Pet Searches
 * e.g., /lost-pet/chicago-il, /lost-pet/los-angeles-ca
 */
export default function LocationLandingPage() {
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [squads, setSquads] = useState([]);
  const [stats, setStats] = useState({});

  const locationSlug = params.location;
  const location = formatLocationSlug(locationSlug);

  useEffect(() => {
    loadLocationData();
  }, [locationSlug]);

  const loadLocationData = async () => {
    setLoading(true);
    try {
      // Load cases for this location
      const casesRes = await fetch(`/api/cases?location=${encodeURIComponent(location.city)}&limit=6`);
      if (casesRes.ok) {
        const data = await casesRes.json();
        setCases(data.cases || []);
      }

      // Load squads for this location
      const squadsRes = await fetch(`/api/rescue-squads?state=${location.state}&limit=4`);
      if (squadsRes.ok) {
        const data = await squadsRes.json();
        setSquads(data.squads || []);
      }

      // Mock stats for now
      setStats({
        activeCases: Math.floor(Math.random() * 50) + 10,
        reunited: Math.floor(Math.random() * 200) + 50,
        activeSearchers: Math.floor(Math.random() * 100) + 20,
      });
    } catch (err) {
      console.error('Error loading location data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        color: 'white',
        padding: '4rem 2rem',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255,255,255,0.2)',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            marginBottom: '1rem',
            fontSize: '0.9rem',
          }}>
            <MapPin size={16} />
            {location.display}
          </div>

          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            marginBottom: '1rem',
          }}>
            Lost & Found Pets in {location.city}, {location.state}
          </h1>

          <p style={{
            fontSize: '1.1rem',
            opacity: 0.9,
            maxWidth: '600px',
            margin: '0 auto 2rem',
          }}>
            Join the community effort to reunite lost pets with their families.
            Report a lost pet or help search in your neighborhood.
          </p>

          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            <Link
              href="/cases/report"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem 2rem',
                background: 'white',
                color: '#4f46e5',
                borderRadius: '12px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Report Lost Pet
              <ArrowRight size={18} />
            </Link>

            <Link
              href="/found"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem 2rem',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                borderRadius: '12px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Report Found Pet
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        maxWidth: '1200px',
        margin: '-2rem auto 0',
        padding: '0 2rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}>
          <StatCard
            icon={<PawPrint size={24} color="#4f46e5" />}
            value={stats.activeCases || 0}
            label="Active Cases"
          />
          <StatCard
            icon={<Search size={24} color="#10b981" />}
            value={stats.reunited || 0}
            label="Pets Reunited"
          />
          <StatCard
            icon={<Users size={24} color="#f59e0b" />}
            value={stats.activeSearchers || 0}
            label="Active Searchers"
          />
        </div>
      </div>

      {/* Active Cases */}
      <div style={{ maxWidth: '1200px', margin: '3rem auto', padding: '0 2rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
            Active Cases in {location.city}
          </h2>
          <Link
            href={`/cases?location=${encodeURIComponent(location.city)}`}
            style={{
              color: '#4f46e5',
              textDecoration: 'none',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            View All <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <p style={{ color: '#64748b' }}>Loading...</p>
        ) : cases.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '3rem',
            borderRadius: '16px',
            textAlign: 'center',
            color: '#64748b',
          }}>
            <PawPrint size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
            <p>No active cases in this area right now.</p>
            <p>That's good news! Help us stay ready by joining a rescue squad.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}>
            {cases.map((c) => (
              <CaseCard key={c.id} caseData={c} />
            ))}
          </div>
        )}
      </div>

      {/* Rescue Squads */}
      <div style={{
        background: 'white',
        padding: '3rem 2rem',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '1.5rem',
          }}>
            Rescue Squads in {location.state}
          </h2>

          {squads.length === 0 ? (
            <div style={{
              background: '#f8fafc',
              padding: '2rem',
              borderRadius: '12px',
              textAlign: 'center',
            }}>
              <p style={{ color: '#64748b' }}>
                No rescue squads in this area yet.
              </p>
              <Link
                href="/rescue-squads/create"
                style={{
                  display: 'inline-block',
                  marginTop: '1rem',
                  padding: '0.75rem 1.5rem',
                  background: '#4f46e5',
                  color: 'white',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Start a Squad
              </Link>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
            }}>
              {squads.map((squad) => (
                <SquadCard key={squad.id} squad={squad} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SEO Content */}
      <div style={{
        maxWidth: '800px',
        margin: '3rem auto',
        padding: '0 2rem',
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: '#0f172a',
          marginBottom: '1rem',
        }}>
          Lost Pet Resources in {location.display}
        </h2>

        <div style={{ color: '#475569', lineHeight: 1.7 }}>
          <p style={{ marginBottom: '1rem' }}>
            If you've lost a pet in {location.city}, {location.state}, PetRecovery.org
            is here to help. Our community-powered platform connects pet owners with
            local volunteers who can help search for missing pets.
          </p>

          <h3 style={{ fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
            What to do if you've lost a pet in {location.city}:
          </h3>
          <ol style={{ paddingLeft: '1.5rem' }}>
            <li>Report your lost pet on PetRecovery.org immediately</li>
            <li>Search your neighborhood and nearby areas</li>
            <li>Contact local shelters and animal control</li>
            <li>Post on social media and neighborhood apps</li>
            <li>Put up flyers in your area</li>
          </ol>

          <h3 style={{ fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
            Found a pet in {location.city}?
          </h3>
          <p>
            If you've found a lost pet, please <Link href="/found" style={{ color: '#4f46e5' }}>report it here</Link>.
            We'll help match it with owners who are searching.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }) {
  return (
    <div style={{
      background: 'white',
      padding: '1.5rem',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      textAlign: 'center',
    }}>
      <div style={{ marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{label}</div>
    </div>
  );
}

function CaseCard({ caseData }) {
  return (
    <Link
      href={`/cases/${caseData.caseNumber}`}
      style={{
        display: 'block',
        background: 'white',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textDecoration: 'none',
      }}
    >
      {caseData.petPhotoUrl && (
        <img
          src={caseData.petPhotoUrl}
          alt={caseData.petName}
          style={{
            width: '100%',
            height: '200px',
            objectFit: 'cover',
          }}
        />
      )}
      <div style={{ padding: '1rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
        }}>
          <span style={{
            padding: '0.25rem 0.5rem',
            background: '#fef3c7',
            color: '#92400e',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}>
            {caseData.status}
          </span>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
            {new Date(caseData.createdAt).toLocaleDateString()}
          </span>
        </div>
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: 600,
          color: '#0f172a',
          margin: '0 0 0.25rem 0',
        }}>
          {caseData.petName}
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
          {caseData.petSpecies} • {caseData.lastSeenAddress?.split(',')[0]}
        </p>
      </div>
    </Link>
  );
}

function SquadCard({ squad }) {
  return (
    <Link
      href={`/rescue-squads/${squad.id}`}
      style={{
        display: 'block',
        background: '#f8fafc',
        padding: '1.25rem',
        borderRadius: '12px',
        textDecoration: 'none',
      }}
    >
      <h3 style={{
        fontSize: '1rem',
        fontWeight: 600,
        color: '#0f172a',
        margin: '0 0 0.5rem 0',
      }}>
        {squad.name}
      </h3>
      <div style={{
        display: 'flex',
        gap: '1rem',
        color: '#64748b',
        fontSize: '0.85rem',
      }}>
        <span>{squad._count?.members || 0} members</span>
        <span>{squad.successfulReunions || 0} reunions</span>
      </div>
    </Link>
  );
}

function formatLocationSlug(slug) {
  if (!slug) return { city: '', state: '', display: '' };

  const parts = slug.split('-');
  const state = parts.pop()?.toUpperCase() || '';
  const city = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

  return {
    city,
    state,
    display: `${city}, ${state}`,
  };
}
