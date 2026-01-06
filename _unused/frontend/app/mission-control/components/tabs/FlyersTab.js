'use client';

/**
 * FlyersTab Component
 *
 * Mission Control tab for flyer posting and tracking.
 * Integrates FlyerTracker with Mission Control context.
 *
 * Per Actions_Guide.md Phase 4 specification.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import useFlyerTracking from '../../hooks/useFlyerTracking';

// Points per spec
const FLYER_BASE_POINTS = 8;
const PHOTO_BONUS_POINTS = 3;

export default function FlyersTab({ mission, session }) {
  const missionId = mission?.id;
  const lastSeenLocation = mission?.lastSeenLatitude && mission?.lastSeenLongitude
    ? { lat: mission.lastSeenLatitude, lng: mission.lastSeenLongitude }
    : null;

  const {
    flyers,
    coldSpots,
    coverage,
    userLocation,
    userStats,
    teamStats,
    loading,
    error,
    posting,
    locationError,
    postFlyer,
    getNearestColdSpot,
    hasLocation,
    canPost,
    fetchFlyers,
  } = useFlyerTracking(missionId);

  // Local UI state
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [notes, setNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [activeView, setActiveView] = useState('map'); // 'map' | 'list'

  const fileInputRef = useRef(null);
  const nearestColdSpot = getNearestColdSpot();

  // Handle flyer posting
  const handleMarkFlyer = useCallback(async () => {
    const result = await postFlyer(photoUrl, notes || undefined);

    if (result.success) {
      setLastResult(result);
      setShowSuccess(true);
      setPhotoUrl(null);
      setNotes('');
      setShowPhotoCapture(false);

      setTimeout(() => setShowSuccess(false), 4000);
    } else {
      alert(result.error || 'Failed to mark flyer location');
    }
  }, [postFlyer, photoUrl, notes]);

  // Handle photo selection
  const handlePhotoSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
    }
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading flyer data...</p>
      </div>
    );
  }

  if (!missionId) {
    return (
      <div style={styles.emptyState}>
        <span style={styles.emptyIcon}>{"0x1F4CC"}</span>
        <p>No mission selected</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header with stats */}
      <div style={styles.header}>
        <div style={styles.headerStats}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{userStats.flyersPosted}</span>
            <span style={styles.statLabel}>By you</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <span style={styles.statValue}>{teamStats.totalFlyers}</span>
            <span style={styles.statLabel}>Team total</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <span style={styles.statValue}>{coverage.uniqueCells}</span>
            <span style={styles.statLabel}>Areas</span>
          </div>
        </div>

        {/* View toggle */}
        <div style={styles.viewToggle}>
          <button
            onClick={() => setActiveView('map')}
            style={{
              ...styles.toggleBtn,
              ...(activeView === 'map' ? styles.toggleBtnActive : {}),
            }}
          >
            Map
          </button>
          <button
            onClick={() => setActiveView('list')}
            style={{
              ...styles.toggleBtn,
              ...(activeView === 'list' ? styles.toggleBtnActive : {}),
            }}
          >
            List
          </button>
        </div>
      </div>

      {/* Map View */}
      {activeView === 'map' && (
        <div style={styles.mapSection}>
          <div style={styles.mapContainer}>
            {/* Map Legend */}
            <div style={styles.mapLegend}>
              <span style={styles.legendItem}>
                <span style={{ color: '#3B82F6' }}>{"0x1F4CD"}</span> You
              </span>
              <span style={styles.legendItem}>
                <span style={{ color: '#10B981' }}>{"0x1F4CC"}</span> Flyers ({teamStats.totalFlyers})
              </span>
              <span style={styles.legendItem}>
                <span style={{ color: '#EF4444' }}>{"0x1F534"}</span> Cold spots ({coldSpots.length})
              </span>
            </div>

            {/* Map Placeholder */}
            <div style={styles.mapPlaceholder}>
              {userLocation ? (
                <div style={styles.locationInfo}>
                  <p style={styles.locationCoords}>
                    {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                  </p>
                  <p style={styles.locationAccuracy}>
                    Accuracy: {Math.round(userLocation.accuracy || 0)}m
                  </p>
                </div>
              ) : (
                <div style={styles.locationError}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
                  </svg>
                  <p>{locationError || 'Getting location...'}</p>
                </div>
              )}

              {/* Cold spots preview */}
              {coldSpots.length > 0 && (
                <div style={styles.coldSpotsPreview}>
                  <p style={styles.coldSpotsTitle}>{coldSpots.length} areas need flyers</p>
                  <div style={styles.coldSpotDots}>
                    {coldSpots.slice(0, 5).map((_, i) => (
                      <span key={i} style={styles.coldSpotDot}>{"0x1F534"}</span>
                    ))}
                    {coldSpots.length > 5 && (
                      <span style={styles.coldSpotMore}>+{coldSpots.length - 5}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {activeView === 'list' && (
        <div style={styles.listSection}>
          {flyers.length === 0 ? (
            <div style={styles.emptyList}>
              <p>No flyers posted yet. Be the first!</p>
            </div>
          ) : (
            <div style={styles.flyerList}>
              {flyers.map((flyer, idx) => (
                <div key={flyer.id || idx} style={styles.flyerListItem}>
                  <div style={styles.flyerItemIcon}>{"0x1F4CC"}</div>
                  <div style={styles.flyerItemInfo}>
                    <span style={styles.flyerItemUser}>
                      {flyer.postedBy?.firstName || 'Someone'}
                    </span>
                    <span style={styles.flyerItemTime}>
                      {formatTimeAgo(flyer.createdAt)}
                    </span>
                  </div>
                  <span style={styles.flyerItemPoints}>
                    +{flyer.pointsEarned || FLYER_BASE_POINTS}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mark Button Section */}
      <div style={styles.markSection}>
        {/* Success notification */}
        {showSuccess && lastResult && (
          <div style={styles.successBanner}>
            <span style={styles.successIcon}>{"0x2705"}</span>
            <div>
              <strong>Flyer marked!</strong>
              <p style={styles.successPoints}>+{lastResult.pointsEarned} points</p>
            </div>
          </div>
        )}

        {/* Main mark button */}
        <button
          onClick={handleMarkFlyer}
          disabled={!canPost}
          style={{
            ...styles.markButton,
            ...(!canPost ? styles.markButtonDisabled : {}),
          }}
        >
          {posting ? (
            <div style={styles.markButtonContent}>
              <div style={styles.buttonSpinner} />
              <span>Marking location...</span>
            </div>
          ) : (
            <div style={styles.markButtonContent}>
              <span style={styles.markButtonIcon}>{"0x1F4CC"}</span>
              <span style={styles.markButtonText}>MARK FLYER HERE</span>
              <span style={styles.markButtonSubtext}>
                +{FLYER_BASE_POINTS} pts{photoUrl ? ` (+${PHOTO_BONUS_POINTS} photo)` : ''}
              </span>
            </div>
          )}
        </button>

        {/* Photo option */}
        <div style={styles.photoOption}>
          <button
            onClick={() => setShowPhotoCapture(!showPhotoCapture)}
            style={styles.photoToggle}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            {photoUrl ? 'Photo ready' : `Add photo (+${PHOTO_BONUS_POINTS} pts)`}
          </button>

          {showPhotoCapture && (
            <div style={styles.photoPanel}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />

              {photoUrl ? (
                <div style={styles.photoPreview}>
                  <img src={photoUrl} alt="Preview" style={styles.previewImg} />
                  <button onClick={() => setPhotoUrl(null)} style={styles.removePhoto}>
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.captureButton}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Take Photo
                </button>
              )}

              <input
                type="text"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={styles.notesInput}
                maxLength={200}
              />
            </div>
          )}
        </div>

        {/* Location error */}
        {locationError && (
          <p style={styles.locationErrorText}>{locationError}</p>
        )}
      </div>

      {/* Scout tip */}
      {nearestColdSpot && (
        <div style={styles.scoutTip}>
          <span style={styles.scoutIcon}>{"0x1F436"}</span>
          <div style={styles.scoutContent}>
            <strong>Scout says:</strong>
            <p>
              "{nearestColdSpot.distanceFromUser < 0.1
                ? "There's a cold spot nearby"
                : `Cold spot ${(nearestColdSpot.distanceFromUser * 5280).toFixed(0)} ft away`} - needs a flyer!"
            </p>
          </div>
        </div>
      )}

      {/* Cold spots list */}
      {coldSpots.length > 0 && (
        <div style={styles.coldSpotsSection}>
          <h4 style={styles.coldSpotsHeader}>
            <span>{"0x1F534"}</span> Priority Areas ({coldSpots.length})
          </h4>
          <div style={styles.coldSpotsList}>
            {coldSpots.slice(0, 5).map((spot, idx) => (
              <div key={spot.cellId || idx} style={styles.coldSpotItem}>
                <span style={styles.coldSpotCell}>Cell {spot.cellId}</span>
                <span style={styles.coldSpotDist}>
                  {spot.distanceFromLastSeen.toFixed(2)} mi
                </span>
                <span style={{
                  ...styles.coldSpotPriority,
                  ...(spot.priority >= 70 ? styles.priorityHigh :
                     spot.priority >= 40 ? styles.priorityMed : styles.priorityLow),
                }}>
                  {spot.priority >= 70 ? 'High' : spot.priority >= 40 ? 'Med' : 'Low'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={styles.errorBanner}>
          <p>{error}</p>
          <button onClick={fetchFlyers} style={styles.retryButton}>Retry</button>
        </div>
      )}
    </div>
  );
}

// Helper function
function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1rem',
    height: '100%',
    overflow: 'auto',
  },

  // Loading
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E5E7EB',
    borderTopColor: '#667EEA',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1rem',
    color: '#6B7280',
  },

  // Empty state
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    color: '#6B7280',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
    opacity: 0.5,
  },

  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  headerStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: 'white',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  },
  statItem: {
    textAlign: 'center',
  },
  statValue: {
    display: 'block',
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#4F46E5',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: '#6B7280',
  },
  statDivider: {
    width: '1px',
    height: '32px',
    background: '#E5E7EB',
  },
  viewToggle: {
    display: 'flex',
    gap: '0.25rem',
    background: '#F3F4F6',
    padding: '0.25rem',
    borderRadius: '8px',
  },
  toggleBtn: {
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    color: '#6B7280',
    transition: 'all 0.2s',
  },
  toggleBtnActive: {
    background: 'white',
    color: '#1F2937',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },

  // Map section
  mapSection: {
    flex: 1,
    minHeight: '250px',
  },
  mapContainer: {
    height: '100%',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #E5E7EB',
  },
  mapLegend: {
    display: 'flex',
    gap: '1rem',
    padding: '0.75rem 1rem',
    background: 'white',
    borderBottom: '1px solid #E5E7EB',
    fontSize: '0.8rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    color: '#374151',
  },
  mapPlaceholder: {
    height: 'calc(100% - 40px)',
    background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    padding: '1.5rem',
  },
  locationInfo: {
    textAlign: 'center',
    background: 'rgba(255,255,255,0.15)',
    padding: '1rem 2rem',
    borderRadius: '8px',
  },
  locationCoords: {
    fontSize: '0.9rem',
    fontWeight: '600',
    margin: 0,
  },
  locationAccuracy: {
    fontSize: '0.8rem',
    opacity: 0.8,
    marginTop: '0.25rem',
  },
  locationError: {
    textAlign: 'center',
    color: '#FCD34D',
  },
  coldSpotsPreview: {
    marginTop: '1.5rem',
    textAlign: 'center',
  },
  coldSpotsTitle: {
    fontSize: '0.85rem',
    opacity: 0.9,
    marginBottom: '0.5rem',
  },
  coldSpotDots: {
    display: 'flex',
    gap: '0.25rem',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coldSpotDot: {
    fontSize: '0.75rem',
  },
  coldSpotMore: {
    fontSize: '0.75rem',
    opacity: 0.8,
  },

  // List section
  listSection: {
    flex: 1,
    minHeight: '200px',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    overflow: 'auto',
  },
  emptyList: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6B7280',
    padding: '2rem',
  },
  flyerList: {
    padding: '0.5rem',
  },
  flyerListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    borderBottom: '1px solid #F3F4F6',
  },
  flyerItemIcon: {
    fontSize: '1.25rem',
  },
  flyerItemInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  flyerItemUser: {
    fontWeight: '600',
    color: '#1F2937',
    fontSize: '0.9rem',
  },
  flyerItemTime: {
    fontSize: '0.75rem',
    color: '#6B7280',
  },
  flyerItemPoints: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: '0.85rem',
  },

  // Mark section
  markSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    background: '#D1FAE5',
    borderRadius: '8px',
    color: '#065F46',
  },
  successIcon: {
    fontSize: '1.5rem',
  },
  successPoints: {
    fontSize: '0.85rem',
    marginTop: '0.125rem',
    opacity: 0.9,
  },
  markButton: {
    width: '100%',
    padding: '1.25rem',
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
  },
  markButtonDisabled: {
    background: '#9CA3AF',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  markButtonContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  markButtonIcon: {
    fontSize: '1.5rem',
  },
  markButtonText: {
    fontSize: '1.125rem',
    fontWeight: '700',
  },
  markButtonSubtext: {
    fontSize: '0.8rem',
    opacity: 0.9,
  },
  buttonSpinner: {
    width: '24px',
    height: '24px',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '0.5rem',
  },
  photoOption: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  photoToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'none',
    border: 'none',
    color: '#667EEA',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '0.25rem 0',
    fontSize: '0.9rem',
  },
  photoPanel: {
    padding: '1rem',
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  },
  photoPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  previewImg: {
    width: '64px',
    height: '64px',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '2px solid #10B981',
  },
  removePhoto: {
    background: 'none',
    border: 'none',
    color: '#EF4444',
    fontWeight: '600',
    cursor: 'pointer',
  },
  captureButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.75rem',
    background: '#EEF2FF',
    color: '#4F46E5',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  notesInput: {
    width: '100%',
    marginTop: '0.75rem',
    padding: '0.75rem',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '0.9rem',
  },
  locationErrorText: {
    color: '#EF4444',
    fontSize: '0.85rem',
    margin: 0,
  },

  // Scout tip
  scoutTip: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '1rem',
    background: '#FEF3C7',
    borderRadius: '12px',
    border: '1px solid #FCD34D',
  },
  scoutIcon: {
    fontSize: '1.5rem',
  },
  scoutContent: {
    flex: 1,
    fontSize: '0.9rem',
    color: '#78350F',
  },

  // Cold spots section
  coldSpotsSection: {
    padding: '1rem',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
  },
  coldSpotsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.95rem',
    fontWeight: '700',
    color: '#1F2937',
    margin: '0 0 0.75rem 0',
  },
  coldSpotsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  coldSpotItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    background: '#F9FAFB',
    borderRadius: '6px',
    fontSize: '0.85rem',
  },
  coldSpotCell: {
    fontWeight: '600',
    color: '#374151',
  },
  coldSpotDist: {
    flex: 1,
    color: '#6B7280',
  },
  coldSpotPriority: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  priorityHigh: {
    background: '#FEE2E2',
    color: '#991B1B',
  },
  priorityMed: {
    background: '#FEF3C7',
    color: '#92400E',
  },
  priorityLow: {
    background: '#E0E7FF',
    color: '#3730A3',
  },

  // Error
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem',
    background: '#FEE2E2',
    borderRadius: '8px',
    color: '#991B1B',
  },
  retryButton: {
    padding: '0.5rem 1rem',
    background: '#991B1B',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
