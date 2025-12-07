'use client';

/**
 * CaseOutcomeModal Component
 *
 * Modal for closing a case with detailed outcome recording.
 * Captures data for ML training: outcome, found method, pet behavior, etc.
 *
 * Per Actions_Guide.md Phase 6 specification.
 */

import { useState, useCallback } from 'react';

// Outcome options
const OUTCOMES = [
  { value: 'REUNITED', label: 'Reunited!', emoji: '\u{1F389}', color: '#10B981' },
  { value: 'NOT_FOUND', label: 'Search Ended', emoji: '\u{1F614}', color: '#6B7280' },
  { value: 'DECEASED', label: 'Found Deceased', emoji: '\u{1F54A}', color: '#374151' },
  { value: 'CLOSED_OTHER', label: 'Other Reason', emoji: '\u{1F4DD}', color: '#6B7280' },
];

// How the pet was found (for REUNITED)
const FOUND_METHODS = [
  { value: 'CAME_HOME', label: 'Came home on their own', emoji: '\u{1F3E0}' },
  { value: 'SHELTER_INTAKE', label: 'Found at a shelter', emoji: '\u{1F3E5}' },
  { value: 'NEIGHBOR_FOUND', label: 'Neighbor/community found them', emoji: '\u{1F91D}' },
  { value: 'SIGHTING_LED_TO', label: 'A sighting report led to them', emoji: '\u{1F440}' },
  { value: 'TRAP_CAUGHT', label: 'Caught in a humane trap', emoji: '\u{1FAA4}' },
  { value: 'FLYER_RESPONSE', label: 'Someone saw a flyer', emoji: '\u{1F4CC}' },
  { value: 'SOCIAL_MEDIA', label: 'Found through social media', emoji: '\u{1F4F1}' },
  { value: 'OTHER', label: 'Other', emoji: '\u{2753}' },
];

// Pet behavior options
const PET_BEHAVIORS = [
  { value: 'INDOOR', label: 'Indoor only' },
  { value: 'OUTDOOR', label: 'Outdoor/free-roaming' },
  { value: 'SKITTISH', label: 'Shy/Skittish' },
  { value: 'FRIENDLY', label: 'Friendly/Social' },
];

// Location type options
const LOCATION_TYPES = [
  { value: 'URBAN', label: 'Urban (city)' },
  { value: 'SUBURBAN', label: 'Suburban' },
  { value: 'RURAL', label: 'Rural' },
];

// Actions that could be marked as helpful
const HELPFUL_ACTIONS = [
  { value: 'search_area', label: 'Physical searching' },
  { value: 'post_flyers', label: 'Posting flyers' },
  { value: 'contact_shelters', label: 'Contacting shelters' },
  { value: 'social_media', label: 'Social media posts' },
  { value: 'talk_neighbors', label: 'Talking to neighbors' },
  { value: 'set_trap', label: 'Setting a trap' },
  { value: 'leave_items', label: 'Leaving food/litter outside' },
];

export default function CaseOutcomeModal({
  isOpen,
  onClose,
  onSubmit,
  petName,
  caseMetrics,
  submitting = false,
}) {
  const [step, setStep] = useState(1);
  const [outcome, setOutcome] = useState(null);
  const [foundMethod, setFoundMethod] = useState(null);
  const [foundMethodDetails, setFoundMethodDetails] = useState('');
  const [petBehavior, setPetBehavior] = useState(null);
  const [locationType, setLocationType] = useState(null);
  const [ownerFeedback, setOwnerFeedback] = useState('');
  const [helpfulActions, setHelpfulActions] = useState([]);

  const handleSubmit = useCallback(() => {
    if (!outcome) return;

    onSubmit({
      outcome,
      foundMethod: outcome === 'REUNITED' ? foundMethod : undefined,
      foundMethodDetails: foundMethodDetails || undefined,
      petBehavior: petBehavior || undefined,
      locationType: locationType || undefined,
      ownerFeedback: ownerFeedback || undefined,
      helpfulActions: helpfulActions.length > 0 ? helpfulActions : undefined,
    });
  }, [outcome, foundMethod, foundMethodDetails, petBehavior, locationType, ownerFeedback, helpfulActions, onSubmit]);

  const toggleHelpfulAction = (action) => {
    setHelpfulActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  const canProceed = () => {
    if (step === 1) return !!outcome;
    if (step === 2 && outcome === 'REUNITED') return !!foundMethod;
    return true;
  };

  const nextStep = () => {
    if (step === 1 && outcome !== 'REUNITED') {
      // Skip found method step for non-reunited outcomes
      setStep(3);
    } else {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step === 3 && outcome !== 'REUNITED') {
      setStep(1);
    } else {
      setStep(step - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            {outcome === 'REUNITED' ? '\u{1F389} Great News!' : 'Close Case'}
          </h2>
          <button onClick={onClose} style={styles.closeButton} disabled={submitting}>
            &times;
          </button>
        </div>

        {/* Progress indicator */}
        <div style={styles.progress}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                ...styles.progressDot,
                background: step >= s ? '#667EEA' : '#E5E7EB',
              }}
            />
          ))}
        </div>

        {/* Step 1: Outcome Selection */}
        {step === 1 && (
          <div style={styles.stepContent}>
            <h3 style={styles.stepTitle}>What happened with {petName}?</h3>
            <div style={styles.optionsGrid}>
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setOutcome(o.value)}
                  style={{
                    ...styles.optionCard,
                    borderColor: outcome === o.value ? o.color : '#E5E7EB',
                    background: outcome === o.value ? `${o.color}10` : 'white',
                  }}
                >
                  <span style={styles.optionEmoji}>{o.emoji}</span>
                  <span style={styles.optionLabel}>{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Found Method (only for REUNITED) */}
        {step === 2 && outcome === 'REUNITED' && (
          <div style={styles.stepContent}>
            <h3 style={styles.stepTitle}>How was {petName} found?</h3>
            <p style={styles.stepSubtitle}>This helps us improve our recommendations</p>
            <div style={styles.methodsList}>
              {FOUND_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setFoundMethod(m.value)}
                  style={{
                    ...styles.methodOption,
                    borderColor: foundMethod === m.value ? '#10B981' : '#E5E7EB',
                    background: foundMethod === m.value ? '#D1FAE5' : 'white',
                  }}
                >
                  <span style={styles.methodEmoji}>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
            {foundMethod === 'OTHER' && (
              <textarea
                value={foundMethodDetails}
                onChange={(e) => setFoundMethodDetails(e.target.value)}
                placeholder="Please describe how they were found..."
                style={styles.textarea}
                maxLength={500}
              />
            )}
          </div>
        )}

        {/* Step 3: Context Details */}
        {step === 3 && (
          <div style={styles.stepContent}>
            <h3 style={styles.stepTitle}>A few more details (optional)</h3>
            <p style={styles.stepSubtitle}>This data helps train our algorithm</p>

            <div style={styles.formGroup}>
              <label style={styles.label}>{petName}&apos;s typical behavior:</label>
              <div style={styles.radioGroup}>
                {PET_BEHAVIORS.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => setPetBehavior(b.value)}
                    style={{
                      ...styles.radioButton,
                      borderColor: petBehavior === b.value ? '#667EEA' : '#E5E7EB',
                      background: petBehavior === b.value ? '#EEF2FF' : 'white',
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Area type:</label>
              <div style={styles.radioGroup}>
                {LOCATION_TYPES.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setLocationType(l.value)}
                    style={{
                      ...styles.radioButton,
                      borderColor: locationType === l.value ? '#667EEA' : '#E5E7EB',
                      background: locationType === l.value ? '#EEF2FF' : 'white',
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Feedback */}
        {step === 4 && (
          <div style={styles.stepContent}>
            <h3 style={styles.stepTitle}>What helped most? (optional)</h3>

            {outcome === 'REUNITED' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Select actions that were helpful:</label>
                <div style={styles.checkboxGroup}>
                  {HELPFUL_ACTIONS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => toggleHelpfulAction(a.value)}
                      style={{
                        ...styles.checkboxButton,
                        borderColor: helpfulActions.includes(a.value) ? '#10B981' : '#E5E7EB',
                        background: helpfulActions.includes(a.value) ? '#D1FAE5' : 'white',
                      }}
                    >
                      <span style={styles.checkbox}>
                        {helpfulActions.includes(a.value) ? '\u2713' : ''}
                      </span>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Any other feedback?</label>
              <textarea
                value={ownerFeedback}
                onChange={(e) => setOwnerFeedback(e.target.value)}
                placeholder="Share your experience or tips for others..."
                style={styles.textarea}
                maxLength={1000}
              />
            </div>

            {/* Summary */}
            {caseMetrics && (
              <div style={styles.metricsSummary}>
                <h4 style={styles.metricsTitle}>Case Summary</h4>
                <div style={styles.metricsGrid}>
                  <div style={styles.metric}>
                    <span style={styles.metricValue}>{caseMetrics.totalFlyersPosted}</span>
                    <span style={styles.metricLabel}>Flyers Posted</span>
                  </div>
                  <div style={styles.metric}>
                    <span style={styles.metricValue}>{caseMetrics.totalSheltersContacted}</span>
                    <span style={styles.metricLabel}>Shelters Contacted</span>
                  </div>
                  <div style={styles.metric}>
                    <span style={styles.metricValue}>{Math.round(caseMetrics.totalSearchHours || 0)}</span>
                    <span style={styles.metricLabel}>Search Hours</span>
                  </div>
                  <div style={styles.metric}>
                    <span style={styles.metricValue}>{caseMetrics.sightingsCount}</span>
                    <span style={styles.metricLabel}>Sightings</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          {step > 1 && (
            <button onClick={prevStep} style={styles.backButton} disabled={submitting}>
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 4 ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              style={{
                ...styles.nextButton,
                opacity: canProceed() ? 1 : 0.5,
              }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !outcome}
              style={{
                ...styles.submitButton,
                background: outcome === 'REUNITED' ? '#10B981' : '#667EEA',
              }}
            >
              {submitting ? 'Saving...' : 'Close Case'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    background: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #E5E7EB',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    color: '#6B7280',
    cursor: 'pointer',
    padding: '0.25rem',
    lineHeight: 1,
  },
  progress: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '1rem',
  },
  progressDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    transition: 'background 0.2s',
  },
  stepContent: {
    padding: '1rem 1.5rem',
  },
  stepTitle: {
    margin: '0 0 0.5rem',
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#111827',
  },
  stepSubtitle: {
    margin: '0 0 1rem',
    fontSize: '0.875rem',
    color: '#6B7280',
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
  },
  optionCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1.25rem 1rem',
    border: '2px solid',
    borderRadius: '12px',
    background: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  optionEmoji: {
    fontSize: '2rem',
  },
  optionLabel: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#374151',
  },
  methodsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  methodOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    border: '2px solid',
    borderRadius: '10px',
    background: 'white',
    cursor: 'pointer',
    fontSize: '0.9rem',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
  methodEmoji: {
    fontSize: '1.25rem',
  },
  formGroup: {
    marginBottom: '1.25rem',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.5rem',
  },
  radioGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  radioButton: {
    padding: '0.5rem 1rem',
    border: '2px solid',
    borderRadius: '8px',
    background: 'white',
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  checkboxButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    border: '2px solid',
    borderRadius: '8px',
    background: 'white',
    fontSize: '0.9rem',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #D1D5DB',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    color: '#10B981',
  },
  textarea: {
    width: '100%',
    minHeight: '80px',
    padding: '0.75rem',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '0.9rem',
    resize: 'vertical',
    marginTop: '0.5rem',
  },
  metricsSummary: {
    marginTop: '1.5rem',
    padding: '1rem',
    background: '#F9FAFB',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
  },
  metricsTitle: {
    margin: '0 0 0.75rem',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#374151',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.5rem',
  },
  metric: {
    textAlign: 'center',
  },
  metricValue: {
    display: 'block',
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#667EEA',
  },
  metricLabel: {
    fontSize: '0.7rem',
    color: '#6B7280',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderTop: '1px solid #E5E7EB',
    gap: '0.75rem',
  },
  backButton: {
    padding: '0.75rem 1.25rem',
    background: 'white',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    fontWeight: '600',
    color: '#6B7280',
    cursor: 'pointer',
  },
  nextButton: {
    padding: '0.75rem 1.5rem',
    background: '#667EEA',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    color: 'white',
    cursor: 'pointer',
  },
  submitButton: {
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    color: 'white',
    cursor: 'pointer',
  },
};
