'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { isAdmin } from '@/app/lib/permissions';

export default function NewCasePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState({
    // Location
    city: '',
    state: '',
    zipCode: '',
    lastSeenLandmark: '',
    lastSeenAt: '',
    // Pet
    petName: '',
    petSpecies: 'DOG',
    petBreed: '',
    petColor: '',
    petDescription: '',
    // Contact
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    // Squad
    squadId: '',
    // Flags
    isUrgent: false
  });

  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [legalError, setLegalError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=' + encodeURIComponent('/admin/missions/new'));
    } else if (status === 'authenticated' && !isAdmin(session)) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch squads for dropdown
  useEffect(() => {
    if (status === 'authenticated' && isAdmin(session)) {
      fetchSquads();
    }
  }, [status, session]);

  const fetchSquads = async () => {
    try {
      const response = await fetch('/api/squads');
      if (response.ok) {
        const data = await response.json();
        setSquads(data.squads || []);
      }
    } catch (err) {
      console.error('Failed to fetch squads:', err);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.city.trim()) {
      errors.city = 'City is required';
    }

    if (!formData.state.trim()) {
      errors.state = 'State is required';
    }

    if (!formData.petSpecies) {
      errors.petSpecies = 'Pet species is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Please fix the validation errors below.');
      return;
    }

    setLoading(true);
    setError(null);
    setLegalError(null);

    try {
      const payload = {
        city: formData.city.trim(),
        state: formData.state.trim(),
        zipCode: formData.zipCode.trim() || null,
        lastSeenLandmark: formData.lastSeenLandmark.trim() || null,
        lastSeenAt: formData.lastSeenAt || null,
        petName: formData.petName.trim() || null,
        petSpecies: formData.petSpecies,
        petBreed: formData.petBreed.trim() || null,
        petColor: formData.petColor.trim() || null,
        petDescription: formData.petDescription.trim() || null,
        contactName: formData.contactName.trim() || null,
        contactPhone: formData.contactPhone.trim() || null,
        contactEmail: formData.contactEmail.trim() || null,
        squadId: formData.squadId || null,
        isUrgent: formData.isUrgent
      };

      const response = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.status === 201) {
        // Success - redirect to case detail
        router.push('/admin/missions/' + data.case.id);
      } else if (response.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
        // Legal gating
        setLegalError({
          message: data.message,
          redirectTo: data.redirectTo
        });
      } else if (response.status === 400 || response.status === 422) {
        // Validation error
        setError(data.error || 'Validation failed. Please check your input.');
      } else if (response.status === 500) {
        // Server error
        setError('Failed to create case: ' + (data.message || 'Internal server error'));
      } else {
        setError(data.error || 'An unexpected error occurred');
      }
    } catch (err) {
      console.error('Error creating case:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb'
      }}>
        <div style={{ fontSize: '1rem', color: '#6b7280' }}>Loading...</div>
      </div>
    );
  }

  // Non-admin shouldn't see this (handled by redirect)
  if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      padding: '2rem 1rem'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => router.push('/admin/missions')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#3b82f6',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '1rem',
              padding: '0.5rem',
              marginLeft: '-0.5rem'
            }}
          >
            ← Back to Cases
          </button>
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: '700',
            color: '#111827',
            marginBottom: '0.5rem'
          }}>
            Create Lost Pet Case
            <span style={{
              fontSize: '0.75rem',
              padding: '0.125rem 0.5rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '0.25rem',
              fontWeight: '600',
              marginLeft: '0.5rem'
            }}>
              🔒 ADMIN ONLY
            </span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>
            Record a new lost pet case for tracking and coordination.
          </p>
        </div>

        {/* Legal Error Banner */}
        {legalError && (
          <div style={{
            padding: '1.5rem',
            background: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: '12px',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', color: '#92400e', marginBottom: '0.25rem' }}>
                  Legal Agreement Required
                </div>
                <div style={{ color: '#b45309', fontSize: '0.95rem' }}>
                  {legalError.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(legalError.redirectTo)}
              style={{
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Review & Accept Now →
            </button>
          </div>
        )}

        {/* General Error */}
        {error && (
          <div style={{
            padding: '1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            color: '#991b1b',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Location Section */}
          <Section title="Location Information">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <FormField
                label="City *"
                error={validationErrors.city}
              >
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Austin"
                  required
                  style={inputStyle(validationErrors.city)}
                />
              </FormField>

              <FormField
                label="State *"
                error={validationErrors.state}
              >
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  placeholder="TX"
                  required
                  style={inputStyle(validationErrors.state)}
                />
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <FormField label="ZIP Code">
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => handleChange('zipCode', e.target.value)}
                  placeholder="78701"
                  style={inputStyle()}
                />
              </FormField>

              <FormField label="Last Seen Date/Time">
                <input
                  type="datetime-local"
                  value={formData.lastSeenAt}
                  onChange={(e) => handleChange('lastSeenAt', e.target.value)}
                  style={inputStyle()}
                />
              </FormField>
            </div>

            <FormField label="Last Seen Landmark" style={{ marginTop: '1rem' }}>
              <input
                type="text"
                value={formData.lastSeenLandmark}
                onChange={(e) => handleChange('lastSeenLandmark', e.target.value)}
                placeholder="Near Zilker Park, corner of 5th and Congress"
                style={inputStyle()}
              />
            </FormField>
          </Section>

          {/* Pet Information Section */}
          <Section title="Pet Information">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <FormField label="Pet Name">
                <input
                  type="text"
                  value={formData.petName}
                  onChange={(e) => handleChange('petName', e.target.value)}
                  placeholder="Max"
                  style={inputStyle()}
                />
              </FormField>

              <FormField
                label="Species *"
                error={validationErrors.petSpecies}
              >
                <select
                  value={formData.petSpecies}
                  onChange={(e) => handleChange('petSpecies', e.target.value)}
                  required
                  style={inputStyle(validationErrors.petSpecies)}
                >
                  <option value="DOG">Dog</option>
                  <option value="CAT">Cat</option>
                  <option value="BIRD">Bird</option>
                  <option value="RABBIT">Rabbit</option>
                  <option value="OTHER">Other</option>
                </select>
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <FormField label="Breed">
                <input
                  type="text"
                  value={formData.petBreed}
                  onChange={(e) => handleChange('petBreed', e.target.value)}
                  placeholder="Golden Retriever"
                  style={inputStyle()}
                />
              </FormField>

              <FormField label="Color">
                <input
                  type="text"
                  value={formData.petColor}
                  onChange={(e) => handleChange('petColor', e.target.value)}
                  placeholder="Golden/Tan"
                  style={inputStyle()}
                />
              </FormField>
            </div>

            <FormField label="Description" style={{ marginTop: '1rem' }}>
              <textarea
                value={formData.petDescription}
                onChange={(e) => handleChange('petDescription', e.target.value)}
                placeholder="Additional details about the pet (size, markings, collar, etc.)"
                rows={4}
                style={{
                  ...inputStyle(),
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </FormField>
          </Section>

          {/* Contact Information Section */}
          <Section title="Contact Information">
            <FormField label="Contact Name" style={{ marginTop: '1rem' }}>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => handleChange('contactName', e.target.value)}
                placeholder="John Doe"
                style={inputStyle()}
              />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <FormField label="Phone">
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  placeholder="(512) 555-1234"
                  style={inputStyle()}
                />
              </FormField>

              <FormField label="Email">
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  placeholder="contact@example.com"
                  style={inputStyle()}
                />
              </FormField>
            </div>
          </Section>

          {/* Squad Assignment Section */}
          <Section title="Force Assignment (Optional)">
            <FormField label="Assign to Force" style={{ marginTop: '1rem' }}>
              <select
                value={formData.squadId}
                onChange={(e) => handleChange('squadId', e.target.value)}
                style={inputStyle()}
              >
                <option value="">Assign later in admin tools</option>
                {squads.map(squad => (
                  <option key={squad.id} value={squad.id}>
                    {squad.name} ({squad.city}, {squad.state})
                  </option>
                ))}
              </select>
            </FormField>
          </Section>

          {/* Flags Section */}
          <Section title="Flags">
            <div style={{ marginTop: '1rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}>
                <input
                  type="checkbox"
                  checked={formData.isUrgent}
                  onChange={(e) => handleChange('isUrgent', e.target.checked)}
                  style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: '600', color: '#111827' }}>Mark as urgent</span>
              </label>
              <div style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                marginTop: '0.25rem',
                marginLeft: '1.5rem'
              }}>
                Urgent cases are prioritized for immediate attention
              </div>
            </div>
          </Section>

          {/* Submit Button */}
          <div style={{
            marginTop: '2rem',
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={() => router.push('/admin/missions')}
              disabled={loading}
              style={{
                background: 'white',
                border: '1px solid #d1d5db',
                color: '#374151',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                opacity: loading ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem'
              }}
            >
              {loading ? 'Creating Case...' : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper Components
function Section({ title, children }) {
  return (
    <div style={{
      background: 'white',
      padding: '1.5rem',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      marginBottom: '1.5rem'
    }}>
      <h2 style={{
        fontSize: '1.125rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '0.5rem'
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function FormField({ label, error, children, style = {} }) {
  return (
    <div style={style}>
      <label style={{
        display: 'block',
        fontSize: '0.75rem',
        fontWeight: '600',
        color: error ? '#dc2626' : '#374151',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.5rem'
      }}>
        {label}
      </label>
      {children}
      {error && (
        <div style={{
          fontSize: '0.75rem',
          color: '#dc2626',
          marginTop: '0.25rem'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

function inputStyle(hasError = false) {
  return {
    width: '100%',
    padding: '0.625rem',
    border: hasError ? '1px solid #dc2626' : '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.875rem',
    color: '#111827',
    background: hasError ? '#fef2f2' : 'white',
    outline: 'none',
    transition: 'border-color 0.2s'
  };
}
