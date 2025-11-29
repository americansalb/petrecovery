'use client';

/**
 * Create Rescue Squad Page
 *
 * Multi-step form for creating a new rescue squad:
 * 1. Basic info (name, description)
 * 2. Location & coverage area
 * 3. Review & create
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STEPS = [
  { id: 'basics', title: 'Squad Basics', icon: '📝' },
  { id: 'location', title: 'Coverage Area', icon: '📍' },
  { id: 'review', title: 'Review & Create', icon: '✓' },
];

export default function CreateSquadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    city: '',
    state: '',
    zipCode: '',
    radiusMiles: 5,
    contactEmail: '',
    contactPhone: '',
    website: '',
    isPublic: true,
  });

  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [coordinates, setCoordinates] = useState(null);

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/rescue-squads/create');
    }
  }, [status, router]);

  // Get coordinates from location
  const geocodeLocation = async () => {
    if (!formData.city || !formData.state) return;

    try {
      const query = `${formData.city}, ${formData.state}`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      const data = await res.json();

      if (data && data.length > 0) {
        setCoordinates({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        });
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  };

  useEffect(() => {
    if (formData.city && formData.state) {
      const timer = setTimeout(geocodeLocation, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.city, formData.state]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep = () => {
    switch (step) {
      case 0: // Basics
        if (!formData.name.trim()) {
          setError('Squad name is required');
          return false;
        }
        if (formData.name.trim().length < 3) {
          setError('Squad name must be at least 3 characters');
          return false;
        }
        break;

      case 1: // Location
        if (!formData.city.trim()) {
          setError('City is required');
          return false;
        }
        if (!formData.state.trim()) {
          setError('State is required');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 0));
    setError('');
  };

  const handleCreate = async () => {
    if (!validateStep()) return;

    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          centerLatitude: coordinates?.lat,
          centerLongitude: coordinates?.lng,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create squad');
      }

      // Redirect to the new squad page
      router.push(`/rescue-squads/${data.squad.id}?created=true`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (status === 'loading') {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <Link href="/rescue-squads" style={styles.backLink}>
            ← Back to Squads
          </Link>
          <h1 style={styles.title}>Create a Rescue Squad</h1>
          <p style={styles.subtitle}>
            Start a volunteer pet rescue team in your community
          </p>
        </div>

        {/* Progress */}
        <div style={styles.progress}>
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              style={{
                ...styles.progressStep,
                ...(i <= step ? styles.progressStepActive : {}),
              }}
            >
              <div
                style={{
                  ...styles.progressIcon,
                  ...(i <= step ? styles.progressIconActive : {}),
                }}
              >
                {i < step ? '✓' : s.icon}
              </div>
              <span style={styles.progressLabel}>{s.title}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Step 1: Basics */}
        {step === 0 && (
          <div style={styles.stepContent}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Squad Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="e.g., Austin Pet Rescue Squad"
                style={styles.input}
                maxLength={100}
              />
              <p style={styles.hint}>
                Choose a name that includes your city or neighborhood
              </p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                value={formData.description}
                onChange={e => updateField('description', e.target.value)}
                placeholder="Describe your squad's mission and what makes it special..."
                style={styles.textarea}
                rows={4}
                maxLength={500}
              />
              <p style={styles.charCount}>
                {formData.description.length}/500
              </p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Contact Email (Optional)</label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={e => updateField('contactEmail', e.target.value)}
                placeholder="squad@example.com"
                style={styles.input}
              />
            </div>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 1 && (
          <div style={styles.stepContent}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={e => updateField('city', e.target.value)}
                  placeholder="Austin"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>State *</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={e => updateField('state', e.target.value)}
                  placeholder="TX"
                  style={styles.input}
                  maxLength={2}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>ZIP Code (Optional)</label>
              <input
                type="text"
                value={formData.zipCode}
                onChange={e => updateField('zipCode', e.target.value)}
                placeholder="78701"
                style={styles.input}
                maxLength={10}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Coverage Radius</label>
              <div style={styles.radiusSelector}>
                {[3, 5, 10, 15, 25].map(r => (
                  <button
                    key={r}
                    onClick={() => updateField('radiusMiles', r)}
                    style={{
                      ...styles.radiusButton,
                      ...(formData.radiusMiles === r ? styles.radiusButtonActive : {}),
                    }}
                  >
                    {r} mi
                  </button>
                ))}
              </div>
              <p style={styles.hint}>
                This defines your squad's primary coverage area for receiving case alerts
              </p>
            </div>

            {coordinates && (
              <div style={styles.locationConfirm}>
                <span style={styles.locationIcon}>📍</span>
                <span>
                  Location found: {formData.city}, {formData.state}
                </span>
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={e => updateField('isPublic', e.target.checked)}
                  style={styles.checkbox}
                />
                <span>Public Squad</span>
              </label>
              <p style={styles.hint}>
                {formData.isPublic
                  ? 'Anyone can find and join this squad'
                  : 'Squad is invite-only and hidden from search'}
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 2 && (
          <div style={styles.stepContent}>
            <h3 style={styles.reviewTitle}>Review Your Squad</h3>

            <div style={styles.reviewSection}>
              <h4 style={styles.reviewLabel}>Squad Name</h4>
              <p style={styles.reviewValue}>{formData.name}</p>
            </div>

            {formData.description && (
              <div style={styles.reviewSection}>
                <h4 style={styles.reviewLabel}>Description</h4>
                <p style={styles.reviewValue}>{formData.description}</p>
              </div>
            )}

            <div style={styles.reviewSection}>
              <h4 style={styles.reviewLabel}>Location</h4>
              <p style={styles.reviewValue}>
                {formData.city}, {formData.state}
                {formData.zipCode && ` ${formData.zipCode}`}
              </p>
            </div>

            <div style={styles.reviewSection}>
              <h4 style={styles.reviewLabel}>Coverage</h4>
              <p style={styles.reviewValue}>
                {formData.radiusMiles} mile radius
              </p>
            </div>

            <div style={styles.reviewSection}>
              <h4 style={styles.reviewLabel}>Visibility</h4>
              <p style={styles.reviewValue}>
                {formData.isPublic ? 'Public - Anyone can join' : 'Private - Invite only'}
              </p>
            </div>

            <div style={styles.founderNote}>
              <span style={styles.noteIcon}>👑</span>
              <p>
                As the squad founder, you'll be able to manage members, accept cases,
                and appoint leaders.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={styles.navigation}>
          {step > 0 && (
            <button onClick={prevStep} style={styles.backButton}>
              ← Back
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button onClick={nextStep} style={styles.nextButton}>
              Continue →
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{
                ...styles.createButton,
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? 'Creating Squad...' : 'Create Squad'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '2rem',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    color: '#64748b',
  },

  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '1rem',
  },

  card: {
    maxWidth: '600px',
    width: '100%',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    padding: '2rem',
    marginTop: '2rem',
  },

  header: {
    marginBottom: '2rem',
  },

  backLink: {
    color: '#667eea',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '0.9rem',
    marginBottom: '1rem',
    display: 'inline-block',
  },

  title: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: '#0f172a',
    margin: '0 0 0.5rem 0',
  },

  subtitle: {
    fontSize: '1rem',
    color: '#64748b',
    margin: 0,
  },

  progress: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '2rem',
    padding: '0 1rem',
  },

  progressStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    opacity: 0.5,
  },

  progressStepActive: {
    opacity: 1,
  },

  progressIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    marginBottom: '0.5rem',
  },

  progressIconActive: {
    backgroundColor: '#667eea',
    color: 'white',
  },

  progressLabel: {
    fontSize: '0.8rem',
    color: '#64748b',
    textAlign: 'center',
  },

  error: {
    padding: '1rem',
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    marginBottom: '1.5rem',
  },

  stepContent: {
    marginBottom: '2rem',
  },

  formGroup: {
    marginBottom: '1.5rem',
  },

  formRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '1rem',
  },

  label: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.5rem',
  },

  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '1rem',
  },

  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '1rem',
    resize: 'vertical',
  },

  hint: {
    fontSize: '0.8rem',
    color: '#64748b',
    marginTop: '0.5rem',
  },

  charCount: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: '0.25rem',
  },

  radiusSelector: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },

  radiusButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    color: '#475569',
    fontWeight: '600',
    cursor: 'pointer',
  },

  radiusButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
    color: 'white',
  },

  locationConfirm: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#d1fae5',
    borderRadius: '8px',
    color: '#065f46',
    marginBottom: '1.5rem',
  },

  locationIcon: {
    fontSize: '1.25rem',
  },

  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
  },

  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
  },

  reviewTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '1.5rem',
  },

  reviewSection: {
    marginBottom: '1.25rem',
    paddingBottom: '1.25rem',
    borderBottom: '1px solid #e2e8f0',
  },

  reviewLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    margin: '0 0 0.25rem 0',
  },

  reviewValue: {
    fontSize: '1rem',
    color: '#0f172a',
    margin: 0,
  },

  founderNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '1rem',
    backgroundColor: '#fef3c7',
    borderRadius: '8px',
  },

  noteIcon: {
    fontSize: '1.5rem',
  },

  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e2e8f0',
  },

  backButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#f1f5f9',
    border: 'none',
    borderRadius: '8px',
    color: '#475569',
    fontWeight: '600',
    cursor: 'pointer',
  },

  nextButton: {
    flex: 1,
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontWeight: '700',
    cursor: 'pointer',
    marginLeft: 'auto',
  },

  createButton: {
    flex: 1,
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontWeight: '700',
    cursor: 'pointer',
    marginLeft: 'auto',
  },
};
