'use client';

/**
 * Matches Panel Component - Phase 1.4
 *
 * Displays potential matches for a lost/found pet case.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import LoadingSpinner from './LoadingSpinner';

export default function MatchesPanel({ caseNumber }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportType, setReportType] = useState('LOST');

  useEffect(() => {
    fetchMatches();
  }, [caseNumber]);

  const fetchMatches = async () => {
    try {
      const res = await fetch(`/api/cases/${caseNumber}/matches`);
      if (!res.ok) throw new Error('Failed to fetch matches');
      const data = await res.json();
      setMatches(data.matches || []);
      setReportType(data.reportType || 'LOST');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '2rem',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <LoadingSpinner text="Searching for matches..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: '#fef2f2',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid #fecaca',
      }}>
        <p style={{ color: '#dc2626', margin: 0 }}>Error loading matches: {error}</p>
      </div>
    );
  }

  const isLost = reportType !== 'FOUND';
  const matchLabel = isLost ? 'Found Pets' : 'Lost Pets';

  return (
    <div style={{
      background: 'white',
      borderRadius: '1rem',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem',
        background: matches.length > 0 ? '#dcfce7' : '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.1rem',
          fontWeight: '600',
          color: matches.length > 0 ? '#166534' : '#0f172a',
        }}>
          {matches.length > 0 ? `${matches.length} Potential Match${matches.length > 1 ? 'es' : ''} Found!` : 'Potential Matches'}
        </h2>
        <p style={{
          margin: '0.25rem 0 0 0',
          fontSize: '0.8rem',
          color: matches.length > 0 ? '#15803d' : '#64748b',
        }}>
          {matches.length > 0
            ? `Matching ${matchLabel.toLowerCase()} in your area`
            : `No matching ${matchLabel.toLowerCase()} found yet`
          }
        </p>
      </div>

      {/* Matches List */}
      {matches.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#64748b',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
          <p style={{ margin: 0 }}>
            {isLost
              ? "We're watching for found pet reports that match."
              : "No lost pet reports match this pet yet."}
          </p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Check back regularly as new reports come in.
          </p>
        </div>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {matches.map((match, index) => (
            <div
              key={match.caseNumber}
              style={{
                padding: '1rem 1.5rem',
                borderBottom: index < matches.length - 1 ? '1px solid #f1f5f9' : 'none',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
              }}
            >
              {/* Photo */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                flexShrink: 0,
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {match.photoUrls?.[0] ? (
                  <img
                    src={match.photoUrls[0]}
                    alt={match.petName || 'Pet'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '2rem' }}>
                    {match.petSpecies === 'DOG' ? '🐕' : match.petSpecies === 'CAT' ? '🐈' : '🐾'}
                  </span>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#0f172a' }}>
                      {match.petName || `${match.petSpecies} - ${match.petColor || 'Unknown color'}`}
                    </h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                      {match.petBreed || match.petSpecies}
                      {match.petColor && ` • ${match.petColor}`}
                    </p>
                  </div>

                  {/* Match Score */}
                  <div style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    background: match.matchQuality.bg,
                    color: match.matchQuality.color,
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                  }}>
                    {match.matchScore}% Match
                  </div>
                </div>

                {/* Location & Time */}
                <div style={{
                  marginTop: '0.5rem',
                  fontSize: '0.8rem',
                  color: '#64748b',
                }}>
                  <span>📍 {match.city}, {match.state}</span>
                  {match.lastSeenAt && (
                    <span style={{ marginLeft: '1rem' }}>
                      📅 {new Date(match.lastSeenAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Match Details */}
                <div style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}>
                  {match.matchDetails.scores.species > 0 && (
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      background: '#dcfce7',
                      color: '#166534',
                      borderRadius: '0.25rem',
                      fontSize: '0.7rem',
                    }}>
                      Species: +{match.matchDetails.scores.species}
                    </span>
                  )}
                  {match.matchDetails.scores.location > 0 && (
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      background: '#dbeafe',
                      color: '#1e40af',
                      borderRadius: '0.25rem',
                      fontSize: '0.7rem',
                    }}>
                      Location: +{match.matchDetails.scores.location}
                      {match.matchDetails.distance && typeof match.matchDetails.distance === 'number'
                        ? ` (${match.matchDetails.distance}mi)`
                        : ''}
                    </span>
                  )}
                  {match.matchDetails.scores.breed > 0 && (
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      background: '#fef3c7',
                      color: '#92400e',
                      borderRadius: '0.25rem',
                      fontSize: '0.7rem',
                    }}>
                      Breed: +{match.matchDetails.scores.breed}
                    </span>
                  )}
                  {match.matchDetails.scores.color > 0 && (
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      background: '#f3e8ff',
                      color: '#6b21a8',
                      borderRadius: '0.25rem',
                      fontSize: '0.7rem',
                    }}>
                      Color: +{match.matchDetails.scores.color}
                    </span>
                  )}
                </div>

                {/* Contact & Actions */}
                <div style={{
                  marginTop: '0.75rem',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                }}>
                  <Link
                    href={`/cases/${match.caseNumber}`}
                    style={{
                      padding: '0.375rem 0.75rem',
                      background: '#2563eb',
                      color: 'white',
                      borderRadius: '0.375rem',
                      textDecoration: 'none',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                    }}
                  >
                    View Details
                  </Link>

                  {match.contact && (
                    <>
                      {match.contact.phone && (
                        <a
                          href={`tel:${match.contact.phone}`}
                          style={{
                            padding: '0.375rem 0.75rem',
                            background: '#dcfce7',
                            color: '#166534',
                            borderRadius: '0.375rem',
                            textDecoration: 'none',
                            fontSize: '0.8rem',
                            fontWeight: '500',
                          }}
                        >
                          📞 Call
                        </a>
                      )}
                      {match.contact.email && (
                        <a
                          href={`mailto:${match.contact.email}`}
                          style={{
                            padding: '0.375rem 0.75rem',
                            background: '#f1f5f9',
                            color: '#475569',
                            borderRadius: '0.375rem',
                            textDecoration: 'none',
                            fontSize: '0.8rem',
                            fontWeight: '500',
                          }}
                        >
                          ✉️ Email
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <div style={{
        padding: '1rem 1.5rem',
        background: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.75rem',
        color: '#64748b',
      }}>
        <strong>How matching works:</strong> We compare species (25pts), location (25pts),
        breed similarity (20pts), color similarity (15pts), and timing (15pts). Higher scores
        indicate a stronger potential match.
      </div>
    </div>
  );
}
