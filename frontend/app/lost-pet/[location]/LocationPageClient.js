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
import { formatLocationSlug } from '@/app/lib/utils';

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
      const city = encodeURIComponent(location.city);
      const state = encodeURIComponent(location.state);

      // /api/missions needs a session, so on this page - the one Google sends
      // strangers to - it answered 401 and the board rendered empty. The public
      // endpoint is the correct source here, and it reports a real total.
      const [openRes, reunitedRes, squadsRes] = await Promise.all([
        fetch(`/api/public/missions?city=${city}&state=${state}&limit=6`),
        fetch(`/api/public/missions?city=${city}&state=${state}&status=REUNITED&limit=1`),
        fetch(`/api/rescue-forces?state=${state}&limit=4`),
      ]);

      let activeMissions = 0;
      if (openRes.ok) {
        const data = await openRes.json();
        setCases(data.cases || []);
        activeMissions = data.pagination?.totalCount ?? (data.cases || []).length;
      } else {
        setCases([]);
      }

      let reunited = 0;
      if (reunitedRes.ok) {
        const data = await reunitedRes.json();
        reunited = data.pagination?.totalCount ?? 0;
      }

      if (squadsRes.ok) {
        const data = await squadsRes.json();
        setSquads(data.squads || []);
      }

      // These are counted, not invented. They used to be Math.random(), which
      // published a different "Pets Reunited" figure on every page load of a
      // public, indexed page.
      setStats({ activeMissions, reunited });
    } catch (err) {
      console.error('Error loading location data:', err);
      setCases([]);
      setStats({ activeMissions: 0, reunited: 0 });
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
              href="/report/new"
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
              href="/report/found"
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
          {/* Two counted numbers, not three invented ones. There is no honest
              source for "Active Searchers" per city, so that card is gone
              rather than filled with a plausible-looking figure. */}
          <StatCard
            icon={<PawPrint size={24} color="#4f46e5" />}
            value={stats.activeMissions || 0}
            label={stats.activeMissions === 1 ? 'Pet missing now' : 'Pets missing now'}
          />
          <StatCard
            icon={<Search size={24} color="#10b981" />}
            value={stats.reunited || 0}
            label={stats.reunited === 1 ? 'Pet reunited here' : 'Pets reunited here'}
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
            <p>That's good news! Help us stay ready by joining a rescue force.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}>
            {cases.map((c) => (
              <MissionCard key={c.id} missionData={c} />
            ))}
          </div>
        )}
      </div>

      {/* Rescue Forces */}
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
            Rescue Forces in {location.state}
          </h2>

          {squads.length === 0 ? (
            <div style={{
              background: '#f8fafc',
              padding: '2rem',
              borderRadius: '12px',
              textAlign: 'center',
            }}>
              <p style={{ color: '#64748b' }}>
                No rescue forces in this area yet.
              </p>
              <Link
                href="/rescue-forces/create"
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
                Start a Rescue Force
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
            If you've lost a pet in {location.city}, {location.state}, ReunitePets.org
            is here to help. Our community-powered platform connects pet owners with
            local volunteers who can help search for missing pets.
          </p>

          <h3 style={{ fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
            What to do if you've lost a pet in {location.city}:
          </h3>
          <ol style={{ paddingLeft: '1.5rem' }}>
            <li>Report your lost pet on ReunitePets.org immediately</li>
            <li>Search your neighborhood and nearby areas</li>
            <li>Contact local shelters and animal control</li>
            <li>Post on social media and neighborhood apps</li>
            <li>Put up flyers in your area</li>
          </ol>

          <h3 style={{ fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
            Found a pet in {location.city}?
          </h3>
          <p>
            If you've found a lost pet, please <Link href="/report/found" style={{ color: '#4f46e5' }}>report it here</Link>.
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

function MissionCard({ missionData }) {
  return (
    <Link
      href={`/cases/${missionData.missionNumber}`}
      style={{
        display: 'block',
        background: 'white',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textDecoration: 'none',
      }}
    >
      {missionData.petPhotoUrl && (
        <img
          src={missionData.petPhotoUrl}
          alt={missionData.petName}
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
            {missionData.status}
          </span>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
            {new Date(missionData.createdAt).toLocaleDateString()}
          </span>
        </div>
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: 600,
          color: '#0f172a',
          margin: '0 0 0.25rem 0',
        }}>
          {missionData.petName}
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
          {missionData.petSpecies} • {missionData.lastSeenAddress?.split(',')[0]}
        </p>
      </div>
    </Link>
  );
}

function SquadCard({ squad }) {
  return (
    <Link
      href={`/rescue-forces/${squad.id}`}
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

