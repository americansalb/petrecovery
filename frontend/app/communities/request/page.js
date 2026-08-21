'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { US_LOCATIONS, searchLocations, getTypeLabel } from '@/lib/us-locations';

export default function CommunityRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [type, setType] = useState('METRO_AREA');
  const [geographicScope, setGeographicScope] = useState('');
  const [parentCommunityId, setParentCommunityId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parentCommunities, setParentCommunities] = useState([]);
  const [rateLimitInfo, setRateLimitInfo] = useState({ count: 0, limit: 10 });

  // Suggestion modal for ZIP code overlap
  const [suggestion, setSuggestion] = useState(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  // Location search
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [filteredLocations, setFilteredLocations] = useState(US_LOCATIONS);
  const [existingCommunities, setExistingCommunities] = useState([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/communities/request');
    }
  }, [status, router]);

  // Fetch parent communities and rate limit info
  useEffect(() => {
    if (session?.user) {
      fetchRateLimitInfo();
      fetchExistingCommunities();
      if (type === 'SUBCOMMUNITY') {
        fetchParentCommunities();
      }
    }
  }, [session, type]);

  const fetchExistingCommunities = async () => {
    try {
      const res = await fetch('/api/communities');
      if (res.ok) {
        const data = await res.json();
        setExistingCommunities(data.communities || []);
      }
    } catch (err) {
      console.error('Error fetching existing communities:', err);
    }
  };

  // Handle location search
  const handleLocationSearch = (query) => {
    setLocationSearch(query);
    setShowLocationDropdown(true);
    const results = searchLocations(query);
    // Filter by type if metro/county selected (always allow ZIP codes through)
    const typeFiltered = type === 'SUBCOMMUNITY'
      ? results
      : results.filter(loc => loc.type === type || loc.type === 'COUNTY' || loc.type === 'ZIP' || loc.isZip);

    // Mark already-created communities
    const withExistingFlag = typeFiltered.map(loc => {
      const exists = existingCommunities.some(comm =>
        comm.geographicScope === loc.value ||
        comm.name === loc.label
      );
      return { ...loc, alreadyExists: exists };
    });

    setFilteredLocations(withExistingFlag);
  };

  // Select location from dropdown
  const selectLocation = (location) => {
    // Prevent selecting already-created communities
    if (location.alreadyExists) {
      setError(`${location.label} already exists. Please join the existing community instead.`);
      setShowLocationDropdown(false);
      return;
    }

    setGeographicScope(location.value);
    setLocationSearch(location.label);
    setShowLocationDropdown(false);
    setError('');

    // Auto-set type based on selection
    if (type !== 'SUBCOMMUNITY') {
      setType(location.type);
    }
  };

  const fetchRateLimitInfo = async () => {
    try {
      const res = await fetch('/api/communities/requests');
      if (res.ok) {
        const data = await res.json();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentCount = data.requests.filter(r =>
          new Date(r.createdAt) > thirtyDaysAgo
        ).length;

        setRateLimitInfo({ count: recentCount, limit: 10 });
      }
    } catch (err) {
      console.error('Error fetching rate limit info:', err);
    }
  };

  const fetchParentCommunities = async () => {
    try {
      const res = await fetch('/api/communities?type=METRO_AREA,COUNTY');
      if (res.ok) {
        const data = await res.json();
        setParentCommunities(data.communities || []);
      }
    } catch (err) {
      console.error('Error fetching parent communities:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/communities/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          geographicScope,
          parentCommunityId: type === 'SUBCOMMUNITY' ? parentCommunityId : undefined,
          notes
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      // Check if API returned a suggestion (ZIP code overlap detection)
      if (data.suggestion) {
        setSuggestion(data.suggestion);
        setShowSuggestionModal(true);
        return; // Don't redirect yet
      }

      // Redirect to my requests page
      router.push('/communities/my-requests');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle accepting the subcommunity suggestion
  const handleAcceptSuggestion = async () => {
    setShowSuggestionModal(false);
    setLoading(true);
    setError('');

    try {
      // Submit as subcommunity with suggested details
      const res = await fetch('/api/communities/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'SUBCOMMUNITY',
          geographicScope: suggestion.cityName,
          parentCommunityId: suggestion.parentMetroId,
          notes: notes + `\n\nOriginal request: ZIP ${suggestion.zipCode}`
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      // Redirect to my requests page
      router.push('/communities/my-requests');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle rejecting the suggestion (proceed with original ZIP request)
  const handleRejectSuggestion = () => {
    setShowSuggestionModal(false);
    setSuggestion(null);
    setError('ZIP-based communities are not currently supported. Please select a city or metro area instead.');
  };

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const remaining = rateLimitInfo.limit - rateLimitInfo.count;
  const canSubmit = remaining > 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '16px',
        padding: '3rem',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Back Link */}
        <Link
          href="/communities"
          style={{
            display: 'inline-block',
            marginBottom: '1.5rem',
            color: '#667eea',
            textDecoration: 'none',
            fontSize: '0.95rem',
            fontWeight: '600'
          }}
        >
          ← Back to Communities
        </Link>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '900',
            color: '#0f172a',
            marginBottom: '0.5rem'
          }}>
            Request Community Creation
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: '#64748b',
            lineHeight: '1.6'
          }}>
            Help us expand PetRecovery to your area! Submit a request to create a new community.
          </p>
        </div>

        {/* Admin Notice */}
        {session?.user?.role === 'ADMIN' && (
          <div style={{
            padding: '1rem',
            background: '#dbeafe',
            border: '2px solid #93c5fd',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <p style={{ color: '#1e40af', fontWeight: '600', marginBottom: '0.5rem' }}>
              👑 Admin: You can create communities directly
            </p>
            <p style={{ color: '#1e40af', margin: 0 }}>
              No approval needed! <Link href="/admin/communities/create" style={{ color: '#1e40af', textDecoration: 'underline' }}>Create communities directly here</Link>
            </p>
          </div>
        )}

        {/* Rate Limit Warning */}
        {!canSubmit && (
          <div style={{
            padding: '1rem',
            background: '#fee2e2',
            border: '2px solid #fecaca',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <p style={{ color: '#991b1b', fontWeight: '600', margin: 0 }}>
              You've reached the limit of 10 requests per 30 days. Please wait before submitting more requests.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee2e2',
            border: '2px solid #fecaca',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <p style={{ color: '#991b1b', fontWeight: '600', margin: 0 }}>
              {error}
            </p>
          </div>
        )}

        {/* Form */}
        <form method="post" onSubmit={handleSubmit}>
          {/* Community Type */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.75rem'
            }}>
              Community Type *
            </label>
            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '1rem',
                border: `2px solid ${type === 'METRO_AREA' ? '#667eea' : '#e2e8f0'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: type === 'METRO_AREA' ? '#f8f9ff' : 'white'
              }}>
                <input
                  type="radio"
                  name="type"
                  value="METRO_AREA"
                  checked={type === 'METRO_AREA'}
                  onChange={(e) => setType(e.target.value)}
                  style={{ marginRight: '0.75rem' }}
                />
                <div>
                  <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>
                    Metropolitan Area / County
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                    For large urban areas or rural counties
                  </div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '1rem',
                border: `2px solid ${type === 'SUBCOMMUNITY' ? '#667eea' : '#e2e8f0'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: type === 'SUBCOMMUNITY' ? '#f8f9ff' : 'white'
              }}>
                <input
                  type="radio"
                  name="type"
                  value="SUBCOMMUNITY"
                  checked={type === 'SUBCOMMUNITY'}
                  onChange={(e) => setType(e.target.value)}
                  style={{ marginRight: '0.75rem' }}
                />
                <div>
                  <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>
                    Subcommunity
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                    City or neighborhood within an existing metro/county
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Parent Community (for subcommunities) */}
          {type === 'SUBCOMMUNITY' && (
            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontSize: '1rem',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '0.75rem'
              }}>
                Parent Community *
              </label>
              <select
                value={parentCommunityId}
                onChange={(e) => setParentCommunityId(e.target.value)}
                required={type === 'SUBCOMMUNITY'}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              >
                <option value="">Select parent community...</option>
                {parentCommunities.map(community => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Geographic Scope */}
          <div style={{ marginBottom: '2rem', position: 'relative' }}>
            <label style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.75rem'
            }}>
              {type === 'SUBCOMMUNITY' ? 'Neighborhood/Area Name *' : 'Select Location *'}
            </label>
            {type === 'SUBCOMMUNITY' ? (
              // Free text for subcommunities
              <>
                <input
                  type="text"
                  value={geographicScope}
                  onChange={(e) => setGeographicScope(e.target.value)}
                  placeholder="e.g., Lincoln Park, Downtown, etc."
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
                <p style={{
                  marginTop: '0.5rem',
                  fontSize: '0.9rem',
                  color: '#64748b'
                }}>
                  💡 Enter the name of your neighborhood, district, or local area
                </p>
              </>
            ) : (
              // Searchable dropdown for metros/counties
              <>
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => handleLocationSearch(e.target.value)}
                  onFocus={() => setShowLocationDropdown(true)}
                  placeholder="Search for your city or county..."
                  required={!geographicScope}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
                {showLocationDropdown && filteredLocations.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '300px',
                    overflowY: 'auto',
                    background: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    marginTop: '0.5rem',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                    zIndex: 10
                  }}>
                    {filteredLocations.slice(0, 20).map((location) => (
                      <div
                        key={location.value}
                        onClick={() => selectLocation(location)}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: location.alreadyExists ? 'not-allowed' : 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.2s',
                          opacity: location.alreadyExists ? 0.5 : 1,
                          background: location.alreadyExists ? '#f9fafb' : 'white'
                        }}
                        onMouseEnter={(e) => {
                          if (!location.alreadyExists) {
                            e.currentTarget.style.background = '#f8f9ff';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = location.alreadyExists ? '#f9fafb' : 'white';
                        }}
                      >
                        <div style={{ fontWeight: '600', color: location.alreadyExists ? '#94a3b8' : '#0f172a' }}>
                          {location.label}
                          {location.alreadyExists && ' ✓ Already Created'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                          {location.isZip ? '📮 ' :
                           location.type === 'METRO_AREA' || location.type === 'CITY' ? '🌆 ' :
                           location.type === 'COUNTY' ? '🏞️ ' : ''}
                          {getTypeLabel(location.type)} • {location.state}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{
                  marginTop: '0.5rem',
                  fontSize: '0.9rem',
                  color: '#64748b'
                }}>
                  💡 Type to search from {US_LOCATIONS.length}+ verified US locations
                  {geographicScope && ` • Selected: ${locationSearch}`}
                </p>
              </>
            )}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.75rem'
            }}>
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tell us why this community is needed..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Requirements */}
          <div style={{
            padding: '1.5rem',
            background: '#f1f5f9',
            borderRadius: '8px',
            marginBottom: '2rem'
          }}>
            <div style={{ fontWeight: '700', marginBottom: '0.75rem' }}>
              ⚠️ Requirements:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#10b981', marginRight: '0.5rem' }}>✓</span>
                Email verified
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#64748b', marginRight: '0.5rem' }}>○</span>
                Phone verified (optional but recommended)
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: canSubmit ? '#10b981' : '#ef4444', marginRight: '0.5rem' }}>
                  {canSubmit ? '✓' : '✗'}
                </span>
                Within rate limit ({remaining}/{rateLimitInfo.limit} requests remaining this month)
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link
              href="/communities"
              style={{
                flex: 1,
                padding: '1rem',
                textAlign: 'center',
                fontSize: '1.1rem',
                fontWeight: '700',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                textDecoration: 'none',
                color: '#64748b'
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              style={{
                flex: 1,
                padding: '1rem',
                fontSize: '1.1rem',
                fontWeight: '700',
                background: loading || !canSubmit ? '#cbd5e1' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || !canSubmit ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>

        {/* Suggestion Modal */}
        {showSuggestionModal && suggestion && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{
                fontSize: '2rem',
                textAlign: 'center',
                marginBottom: '1rem'
              }}>
                💡
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '900',
                color: '#0f172a',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                Subcommunity Suggestion
              </h2>
              <p style={{
                fontSize: '1rem',
                color: '#64748b',
                lineHeight: '1.6',
                marginBottom: '1.5rem'
              }}>
                {suggestion.message}
              </p>
              <div style={{
                background: '#f8f9ff',
                border: '2px solid #e0e7ff',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>ZIP Code:</strong> {suggestion.zipCode}
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>City:</strong> {suggestion.cityName}
                </div>
                <div>
                  <strong>Parent Metro:</strong> {suggestion.parentMetroName}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={handleRejectSuggestion}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: '700',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  No, Cancel
                </button>
                <button
                  onClick={handleAcceptSuggestion}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: '700',
                    border: 'none',
                    borderRadius: '8px',
                    background: loading ? '#cbd5e1' : '#667eea',
                    color: 'white',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Submitting...' : 'Yes, Create Subcommunity'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
