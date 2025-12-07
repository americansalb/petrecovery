'use client';

/**
 * FlyerTracker Component
 *
 * Main component for flyer posting and tracking in Mission Control.
 * Features:
 * - Interactive map with flyer pins and cold spots
 * - One-tap GPS flyer marking
 * - Optional photo capture for bonus points
 * - Progress tracking (personal and team)
 * - Scout tips for cold spots
 *
 * Per Actions_Guide.md Phase 4 specification.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import useFlyerTracking from '@/app/mission-control/hooks/useFlyerTracking';

// Lazy load map for performance
const FlyerMapView = dynamic(() => import('./FlyerMapView'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
      color: 'white',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="map-spinner" />
        <p>Loading map...</p>
      </div>
    </div>
  ),
});

// Points per spec
const FLYER_BASE_POINTS = 8;
const PHOTO_BONUS_POINTS = 3;

export default function FlyerTracker({ caseId, lastSeenLocation, petName, onClose }) {
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
  } = useFlyerTracking(caseId);

  // Local UI state
  const [showPhotoOption, setShowPhotoOption] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [notes, setNotes] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const fileInputRef = useRef(null);

  // Get nearest cold spot for Scout tip
  const nearestColdSpot = getNearestColdSpot();

  // Handle flyer posting
  const handleMarkFlyer = useCallback(async () => {
    const result = await postFlyer(photoUrl, notes || undefined);

    if (result.success) {
      setLastResult(result);
      setShowSuccess(true);
      setPhotoUrl(null);
      setNotes('');
      setShowPhotoOption(false);

      // Auto-hide success after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000);
    } else {
      alert(result.error || 'Failed to mark flyer');
    }
  }, [postFlyer, photoUrl, notes]);

  // Handle photo selection
  const handlePhotoSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      // In production, upload to storage and get URL
      // For now, create a local object URL for preview
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
    }
  }, []);

  // Render loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading flyer data...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {onClose && (
            <button onClick={onClose} style={styles.backButton}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2 style={styles.headerTitle}>Post Flyers</h2>
        </div>
        <div style={styles.headerStats}>
          <span style={styles.statBadge}>
            {userStats.flyersPosted} by you
          </span>
          <span style={styles.statBadge}>
            {teamStats.totalFlyers} total
          </span>
        </div>
      </div>

      {/* Interactive Map with Flyers and Cold Spots */}
      <div style={styles.mapContainer}>
        <FlyerMapView
          lastSeenLocation={lastSeenLocation}
          userLocation={userLocation}
          flyers={flyers}
          coldSpots={coldSpots}
          showLegend={true}
          interactive={true}
        />
      </div>

      {/* Mark Flyer Button */}
      <div style={styles.markSection}>
        <button
          onClick={handleMarkFlyer}
          disabled={!canPost}
          style={{
            ...styles.markButton,
            ...(canPost ? {} : styles.markButtonDisabled),
          }}
        >
          {posting ? (
            <>
              <div style={styles.buttonSpinner} />
              <span>Marking...</span>
            </>
          ) : (
            <>
              <span style={styles.markIcon}>{"0x1F4CC"}</span>
              <span style={styles.markText}>MARK FLYER HERE</span>
              <span style={styles.markSubtext}>
                +{FLYER_BASE_POINTS} pts with GPS{photoUrl ? ` (+${PHOTO_BONUS_POINTS} photo bonus)` : ''}
              </span>
            </>
          )}
        </button>

        {/* Photo option */}
        <div style={styles.photoSection}>
          <button
            onClick={() => setShowPhotoOption(!showPhotoOption)}
            style={styles.photoToggle}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            Add photo (+{PHOTO_BONUS_POINTS} pts)
          </button>

          {showPhotoOption && (
            <div style={styles.photoOptions}>
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
                  <img src={photoUrl} alt="Flyer photo" style={styles.previewImage} />
                  <button
                    onClick={() => setPhotoUrl(null)}
                    style={styles.removePhotoButton}
                  >
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
                placeholder="Add notes (optional)"
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
          <div style={styles.errorBanner}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {locationError}
          </div>
        )}
      </div>

      {/* Success notification */}
      {showSuccess && lastResult && (
        <div style={styles.successBanner}>
          <span style={styles.successIcon}>{"0x2705"}</span>
          <div>
            <strong>Flyer marked!</strong>
            <p style={styles.successPoints}>+{lastResult.pointsEarned} points earned</p>
          </div>
        </div>
      )}

      {/* Progress Section */}
      <div style={styles.progressSection}>
        <h3 style={styles.progressTitle}>{"0x1F4CA"} Progress</h3>
        <div style={styles.progressStats}>
          <div style={styles.progressStat}>
            <span style={styles.progressValue}>{userStats.flyersPosted}</span>
            <span style={styles.progressLabel}>Flyers by you</span>
          </div>
          <div style={styles.progressStat}>
            <span style={styles.progressValue}>{teamStats.totalFlyers}</span>
            <span style={styles.progressLabel}>Team total</span>
          </div>
          <div style={styles.progressStat}>
            <span style={styles.progressValue}>{coverage.uniqueCells}</span>
            <span style={styles.progressLabel}>Areas covered</span>
          </div>
        </div>
      </div>

      {/* Scout Tip */}
      {nearestColdSpot && (
        <div style={styles.scoutTip}>
          <div style={styles.scoutHeader}>
            <span style={styles.scoutIcon}>{"0x1F415"}</span>
            <span style={styles.scoutLabel}>Scout:</span>
          </div>
          <p style={styles.scoutMessage}>
            "There's a cold spot {nearestColdSpot.distanceFromUser < 0.1 ? 'nearby' : `${(nearestColdSpot.distanceFromUser * 5280).toFixed(0)} feet away`}
            {nearestColdSpot.priority >= 70 ? ' - high priority area!' : ' that needs a flyer!'}"
          </p>
          <span style={styles.scoutDismiss}>Dismiss</span>
        </div>
      )}

      {/* Cold Spots List */}
      {coldSpots.length > 0 && (
        <div style={styles.coldSpotsSection}>
          <h3 style={styles.coldSpotsTitle}>{"0x1F534"} Areas needing flyers</h3>
          <div style={styles.coldSpotsList}>
            {coldSpots.slice(0, 5).map((spot, idx) => (
              <div key={spot.cellId || idx} style={styles.coldSpotItem}>
                <span style={styles.coldSpotCell}>Cell {spot.cellId}</span>
                <span style={styles.coldSpotDistance}>
                  {spot.distanceFromLastSeen < 0.1
                    ? 'Very close'
                    : `${spot.distanceFromLastSeen.toFixed(2)} mi from last seen`}
                </span>
                <span style={{
                  ...styles.coldSpotPriority,
                  background: spot.priority >= 70 ? '#FEE2E2' : spot.priority >= 40 ? '#FEF3C7' : '#E0E7FF',
                  color: spot.priority >= 70 ? '#991B1B' : spot.priority >= 40 ? '#92400E' : '#3730A3',
                }}>
                  {spot.priority >= 70 ? 'High' : spot.priority >= 40 ? 'Medium' : 'Low'}
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
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

// ==========================================================================
// STYLES
// ==========================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#F9FAFB',
    overflow: 'auto',
  },

  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    background: 'white',
    borderBottom: '1px solid #E5E7EB',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  backButton: {
    background: 'none',
    border: 'none',
    padding: '0.5rem',
    cursor: 'pointer',
    color: '#6B7280',
    borderRadius: '8px',
  },
  headerTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#1F2937',
    margin: 0,
  },
  headerStats: {
    display: 'flex',
    gap: '0.5rem',
  },
  statBadge: {
    background: '#EEF2FF',
    color: '#4F46E5',
    padding: '0.375rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },

  // Map
  mapContainer: {
    flex: 1,
    minHeight: '300px',
    background: '#E5E7EB',
    margin: '1rem',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  mapPlaceholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    color: 'white',
    position: 'relative',
  },
  mapLegend: {
    display: 'flex',
    gap: '1rem',
    padding: '0.75rem 1rem',
    background: 'rgba(0,0,0,0.3)',
    fontSize: '0.8rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  legendIcon: {
    fontSize: '1rem',
  },
  mapContent: {
    flex: 1,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapInfo: {
    textAlign: 'center',
    background: 'rgba(255,255,255,0.1)',
    padding: '1rem 2rem',
    borderRadius: '8px',
  },
  accuracyText: {
    fontSize: '0.8rem',
    opacity: 0.8,
    marginTop: '0.25rem',
  },
  noLocationText: {
    color: '#FCD34D',
  },
  flyerList: {
    marginTop: '1rem',
    width: '100%',
    maxWidth: '300px',
  },
  flyerListTitle: {
    fontSize: '0.8rem',
    opacity: 0.8,
    marginBottom: '0.5rem',
  },
  flyerItem: {
    fontSize: '0.8rem',
    padding: '0.375rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },

  // Mark Section
  markSection: {
    padding: '0 1rem',
  },
  markButton: {
    width: '100%',
    padding: '1.25rem',
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
    transition: 'all 0.2s',
  },
  markButtonDisabled: {
    background: '#9CA3AF',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  markIcon: {
    fontSize: '1.5rem',
  },
  markText: {
    fontSize: '1.125rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  markSubtext: {
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
  },

  // Photo Section
  photoSection: {
    marginTop: '0.75rem',
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
    padding: '0.5rem 0',
  },
  photoOptions: {
    marginTop: '0.75rem',
    padding: '1rem',
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  },
  captureButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: '#EEF2FF',
    color: '#4F46E5',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    width: '100%',
    justifyContent: 'center',
  },
  photoPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  previewImage: {
    width: '60px',
    height: '60px',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '2px solid #10B981',
  },
  removePhotoButton: {
    background: 'none',
    border: 'none',
    color: '#EF4444',
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

  // Banners
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: '#FEE2E2',
    color: '#991B1B',
    borderRadius: '8px',
    margin: '0.75rem 1rem',
    fontSize: '0.9rem',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    background: '#D1FAE5',
    color: '#065F46',
    borderRadius: '12px',
    margin: '0.75rem 1rem',
    animation: 'slideIn 0.3s ease-out',
  },
  successIcon: {
    fontSize: '1.5rem',
  },
  successPoints: {
    fontSize: '0.85rem',
    marginTop: '0.25rem',
    opacity: 0.9,
  },

  // Progress
  progressSection: {
    padding: '1rem',
    margin: '0.5rem 1rem',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
  },
  progressTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: '0.75rem',
  },
  progressStats: {
    display: 'flex',
    justifyContent: 'space-around',
  },
  progressStat: {
    textAlign: 'center',
  },
  progressValue: {
    display: 'block',
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#4F46E5',
  },
  progressLabel: {
    fontSize: '0.75rem',
    color: '#6B7280',
  },

  // Scout Tip
  scoutTip: {
    margin: '0.5rem 1rem',
    padding: '1rem',
    background: '#FEF3C7',
    borderRadius: '12px',
    border: '1px solid #FCD34D',
  },
  scoutHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  scoutIcon: {
    fontSize: '1.25rem',
  },
  scoutLabel: {
    fontWeight: '700',
    color: '#92400E',
  },
  scoutMessage: {
    fontSize: '0.9rem',
    color: '#78350F',
    fontStyle: 'italic',
    margin: 0,
  },
  scoutDismiss: {
    display: 'block',
    textAlign: 'right',
    color: '#B45309',
    fontWeight: '600',
    fontSize: '0.8rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },

  // Cold Spots
  coldSpotsSection: {
    padding: '1rem',
    margin: '0.5rem 1rem 1rem',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
  },
  coldSpotsTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: '0.75rem',
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
    borderRadius: '8px',
    fontSize: '0.85rem',
  },
  coldSpotCell: {
    fontWeight: '600',
    color: '#374151',
  },
  coldSpotDistance: {
    flex: 1,
    color: '#6B7280',
  },
  coldSpotPriority: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },

  // Loading
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '2rem',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #E5E7EB',
    borderTopColor: '#667EEA',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1rem',
    color: '#6B7280',
  },
};

// Add keyframes for animations (would be in global CSS)
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleSheet);
}
