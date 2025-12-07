'use client';

/**
 * FlyerMarkButton Component
 *
 * One-tap GPS flyer marking button with optional photo capture.
 * Can be used standalone or within the FlyerTracker.
 *
 * Per Actions_Guide.md Phase 4 specification.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// Points per spec
const FLYER_BASE_POINTS = 8;
const PHOTO_BONUS_POINTS = 3;

export default function FlyerMarkButton({
  onMark,
  disabled = false,
  showPhotoOption = true,
  variant = 'large', // 'large' | 'compact' | 'floating'
  location = null,
}) {
  const [posting, setPosting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [notes, setNotes] = useState('');
  const [currentLocation, setCurrentLocation] = useState(location);
  const [locationError, setLocationError] = useState(null);

  const fileInputRef = useRef(null);

  // Get location if not provided
  useEffect(() => {
    if (!location && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          setLocationError(null);
        },
        (err) => {
          setLocationError('Enable GPS to mark flyers');
        },
        { enableHighAccuracy: true }
      );
    }
  }, [location]);

  const handleMark = useCallback(async () => {
    if (disabled || posting) return;

    if (!currentLocation) {
      alert('Location not available. Please enable GPS.');
      return;
    }

    setPosting(true);

    try {
      if (onMark) {
        await onMark({
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          photoUrl,
          notes: notes || undefined,
        });
      }

      // Reset state
      setPhotoUrl(null);
      setNotes('');
      setShowOptions(false);
    } catch (err) {
      console.error('Error marking flyer:', err);
      alert('Failed to mark flyer. Please try again.');
    } finally {
      setPosting(false);
    }
  }, [disabled, posting, currentLocation, photoUrl, notes, onMark]);

  const handlePhotoSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
    }
  }, []);

  // Large variant (default)
  if (variant === 'large') {
    return (
      <div style={styles.largeContainer}>
        <button
          onClick={handleMark}
          disabled={disabled || posting || !currentLocation}
          style={{
            ...styles.largeButton,
            ...(disabled || posting || !currentLocation ? styles.buttonDisabled : {}),
          }}
        >
          {posting ? (
            <div style={styles.buttonContent}>
              <div style={styles.spinner} />
              <span style={styles.buttonText}>Marking...</span>
            </div>
          ) : (
            <div style={styles.buttonContent}>
              <span style={styles.buttonIcon}>{"0x1F4CC"}</span>
              <span style={styles.buttonText}>MARK FLYER HERE</span>
              <span style={styles.buttonSubtext}>
                Tap when you post a flyer
              </span>
              <span style={styles.pointsText}>
                +{FLYER_BASE_POINTS} pts with GPS
                {photoUrl && ` (+${PHOTO_BONUS_POINTS} photo)`}
              </span>
            </div>
          )}
        </button>

        {showPhotoOption && (
          <div style={styles.optionsRow}>
            <button
              onClick={() => setShowOptions(!showOptions)}
              style={styles.optionToggle}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              {photoUrl ? 'Photo added' : `Add photo (+${PHOTO_BONUS_POINTS} pts)`}
            </button>

            {showOptions && (
              <div style={styles.optionsPanel}>
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
                    <img src={photoUrl} alt="Preview" style={styles.previewImage} />
                    <button onClick={() => setPhotoUrl(null)} style={styles.removePhoto}>
                      &times;
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} style={styles.captureBtn}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        )}

        {locationError && (
          <p style={styles.errorText}>{locationError}</p>
        )}
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <button
        onClick={handleMark}
        disabled={disabled || posting || !currentLocation}
        style={{
          ...styles.compactButton,
          ...(disabled || posting || !currentLocation ? styles.buttonDisabled : {}),
        }}
      >
        {posting ? (
          <div style={styles.compactSpinner} />
        ) : (
          <>
            <span>{"0x1F4CC"}</span>
            <span>Mark Flyer</span>
          </>
        )}
      </button>
    );
  }

  // Floating variant
  return (
    <button
      onClick={handleMark}
      disabled={disabled || posting || !currentLocation}
      style={{
        ...styles.floatingButton,
        ...(disabled || posting || !currentLocation ? styles.floatingDisabled : {}),
      }}
    >
      {posting ? (
        <div style={styles.floatingSpinner} />
      ) : (
        <span style={styles.floatingIcon}>{"0x1F4CC"}</span>
      )}
    </button>
  );
}

const styles = {
  // Large variant
  largeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  largeButton: {
    width: '100%',
    padding: '1.25rem',
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
    transition: 'all 0.2s',
  },
  buttonDisabled: {
    background: '#9CA3AF',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  buttonContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  buttonIcon: {
    fontSize: '1.75rem',
    marginBottom: '0.25rem',
  },
  buttonText: {
    fontSize: '1.125rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  buttonSubtext: {
    fontSize: '0.85rem',
    opacity: 0.9,
  },
  pointsText: {
    fontSize: '0.8rem',
    opacity: 0.85,
    marginTop: '0.25rem',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  // Options
  optionsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  optionToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'none',
    border: 'none',
    color: '#667EEA',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: '0.25rem 0',
  },
  optionsPanel: {
    padding: '1rem',
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  },
  captureBtn: {
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
  photoPreview: {
    position: 'relative',
    display: 'inline-block',
  },
  previewImage: {
    width: '80px',
    height: '80px',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '2px solid #10B981',
  },
  removePhoto: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    width: '24px',
    height: '24px',
    background: '#EF4444',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInput: {
    width: '100%',
    marginTop: '0.75rem',
    padding: '0.75rem',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '0.9rem',
  },
  errorText: {
    color: '#EF4444',
    fontSize: '0.85rem',
    margin: '0.25rem 0 0',
  },

  // Compact variant
  compactButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    background: '#10B981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  compactSpinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  // Floating variant
  floatingButton: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  floatingDisabled: {
    background: '#9CA3AF',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  floatingIcon: {
    fontSize: '1.75rem',
  },
  floatingSpinner: {
    width: '28px',
    height: '28px',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
