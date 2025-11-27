'use client';

/**
 * Add New Pet Page - Phase 1.3
 *
 * Route: /pets/new
 * Form to create a new pet profile
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import ImageUpload from '@/app/components/ImageUpload';

const SPECIES_OPTIONS = [
  { value: 'DOG', label: 'Dog', emoji: '🐕' },
  { value: 'CAT', label: 'Cat', emoji: '🐈' },
  { value: 'BIRD', label: 'Bird', emoji: '🐦' },
  { value: 'RABBIT', label: 'Rabbit', emoji: '🐰' },
  { value: 'OTHER', label: 'Other', emoji: '🐾' },
];

const SIZE_OPTIONS = [
  { value: 'TINY', label: 'Tiny', description: 'Under 10 lbs (Chihuahua, Hamster)' },
  { value: 'SMALL', label: 'Small', description: '10-25 lbs (Beagle, Cat)' },
  { value: 'MEDIUM', label: 'Medium', description: '25-50 lbs (Border Collie, Cocker Spaniel)' },
  { value: 'LARGE', label: 'Large', description: '50-90 lbs (Labrador, Golden Retriever)' },
  { value: 'GIANT', label: 'Giant', description: '90+ lbs (Great Dane, St. Bernard)' },
];

const SEX_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const PERSONALITY_TRAITS = [
  'Friendly', 'Shy', 'Energetic', 'Calm', 'Playful',
  'Anxious', 'Aggressive when scared', 'Good with kids',
  'Good with other pets', 'Comes when called', 'Microchip trained',
];

export default function NewPetPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    species: 'DOG',
    breed: '',
    age: '',
    sex: '',
    isNeutered: false,
    color: '',
    size: 'MEDIUM',
    weight: '',
    distinctiveMarks: '',
    microchipId: '',
    collarInfo: '',
    personality: [],
    medicalConditions: '',
  });

  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/pets/new');
    }
  }, [status, router]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handlePersonalityToggle = (trait) => {
    setFormData(prev => ({
      ...prev,
      personality: prev.personality.includes(trait)
        ? prev.personality.filter(t => t !== trait)
        : [...prev.personality, trait]
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Pet name is required';
    if (!formData.species) newErrors.species = 'Species is required';
    if (!formData.color.trim()) newErrors.color = 'Color is required';
    if (!formData.size) newErrors.size = 'Size is required';

    if (formData.age && (isNaN(formData.age) || formData.age < 0 || formData.age > 50)) {
      newErrors.age = 'Please enter a valid age (0-50)';
    }

    if (formData.weight && (isNaN(formData.weight) || formData.weight < 0)) {
      newErrors.weight = 'Please enter a valid weight';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setSubmitting(true);

    try {
      const photoUrls = images.map(img => img.url);

      const res = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          age: formData.age ? parseInt(formData.age) : null,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          photos: photoUrls,
          primaryPhotoUrl: photoUrls[0] || '',
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create pet profile');
      }

      router.push('/pets');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #e2e8f0',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    outline: 'none',
  };

  const inputErrorStyle = {
    ...inputStyle,
    borderColor: '#dc2626',
    background: '#fef2f2',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: '500',
    color: '#374151',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 'clamp(1rem, 3vw, 2rem)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link
            href="/pets"
            style={{ color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginBottom: '1rem' }}
          >
            ← Back to My Pets
          </Link>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            Add New Pet
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
            Register your pet so you can quickly report if they go missing
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Info Section */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', marginBottom: '1.5rem' }}>
              Basic Information
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Name */}
              <div>
                <label style={labelStyle}>Pet Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Max"
                  style={errors.name ? inputErrorStyle : inputStyle}
                />
                {errors.name && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>{errors.name}</p>}
              </div>

              {/* Species */}
              <div>
                <label style={labelStyle}>Species *</label>
                <select
                  name="species"
                  value={formData.species}
                  onChange={handleChange}
                  style={errors.species ? inputErrorStyle : inputStyle}
                >
                  {SPECIES_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.emoji} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Breed */}
              <div>
                <label style={labelStyle}>Breed</label>
                <input
                  type="text"
                  name="breed"
                  value={formData.breed}
                  onChange={handleChange}
                  placeholder="e.g., Golden Retriever"
                  style={inputStyle}
                />
              </div>

              {/* Age */}
              <div>
                <label style={labelStyle}>Age (years)</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  min="0"
                  max="50"
                  placeholder="e.g., 3"
                  style={errors.age ? inputErrorStyle : inputStyle}
                />
                {errors.age && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>{errors.age}</p>}
              </div>

              {/* Sex */}
              <div>
                <label style={labelStyle}>Sex</label>
                <select
                  name="sex"
                  value={formData.sex}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Select...</option>
                  {SEX_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Neutered/Spayed */}
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.75rem' }}>
                <input
                  type="checkbox"
                  name="isNeutered"
                  checked={formData.isNeutered}
                  onChange={handleChange}
                  id="isNeutered"
                  style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem' }}
                />
                <label htmlFor="isNeutered" style={{ color: '#374151' }}>
                  Neutered/Spayed
                </label>
              </div>
            </div>
          </div>

          {/* Physical Description Section */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', marginBottom: '1.5rem' }}>
              Physical Description
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Color */}
              <div>
                <label style={labelStyle}>Color/Markings *</label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  placeholder="e.g., Golden, Black and White"
                  style={errors.color ? inputErrorStyle : inputStyle}
                />
                {errors.color && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>{errors.color}</p>}
              </div>

              {/* Size */}
              <div>
                <label style={labelStyle}>Size *</label>
                <select
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  style={errors.size ? inputErrorStyle : inputStyle}
                >
                  {SIZE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} - {opt.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Weight */}
              <div>
                <label style={labelStyle}>Weight (lbs)</label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  min="0"
                  step="0.1"
                  placeholder="e.g., 25"
                  style={errors.weight ? inputErrorStyle : inputStyle}
                />
                {errors.weight && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>{errors.weight}</p>}
              </div>

              {/* Distinctive Marks */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Distinctive Marks</label>
                <textarea
                  name="distinctiveMarks"
                  value={formData.distinctiveMarks}
                  onChange={handleChange}
                  placeholder="e.g., White spot on chest, scar on left ear, cropped tail..."
                  rows={2}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Identification Section */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', marginBottom: '1.5rem' }}>
              Identification
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Microchip */}
              <div>
                <label style={labelStyle}>Microchip ID</label>
                <input
                  type="text"
                  name="microchipId"
                  value={formData.microchipId}
                  onChange={handleChange}
                  placeholder="e.g., 900123456789012"
                  style={inputStyle}
                />
                <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  Having a microchip greatly increases chances of reunion
                </p>
              </div>

              {/* Collar Info */}
              <div>
                <label style={labelStyle}>Collar/Tag Description</label>
                <input
                  type="text"
                  name="collarInfo"
                  value={formData.collarInfo}
                  onChange={handleChange}
                  placeholder="e.g., Red collar with bone-shaped tag"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Behavior & Health Section */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', marginBottom: '1.5rem' }}>
              Behavior & Health
            </h2>

            {/* Personality Traits */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Personality Traits</label>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                Select all that apply - this helps rescuers approach your pet safely
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {PERSONALITY_TRAITS.map(trait => (
                  <button
                    key={trait}
                    type="button"
                    onClick={() => handlePersonalityToggle(trait)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '9999px',
                      border: formData.personality.includes(trait) ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: formData.personality.includes(trait) ? '#eff6ff' : 'white',
                      color: formData.personality.includes(trait) ? '#2563eb' : '#64748b',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: formData.personality.includes(trait) ? '600' : '400',
                    }}
                  >
                    {trait}
                  </button>
                ))}
              </div>
            </div>

            {/* Medical Conditions */}
            <div>
              <label style={labelStyle}>Medical Conditions</label>
              <textarea
                name="medicalConditions"
                value={formData.medicalConditions}
                onChange={handleChange}
                placeholder="e.g., Diabetes (needs insulin), arthritis, allergies to chicken..."
                rows={2}
                style={inputStyle}
              />
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Important for rescuers to know about medications or special needs
              </p>
            </div>
          </div>

          {/* Photos Section */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', marginBottom: '1.5rem' }}>
              Photos
            </h2>

            <ImageUpload
              images={images}
              onUpload={(newImages) => setImages(prev => [...prev, ...newImages])}
              onRemove={(index) => setImages(prev => prev.filter((_, i) => i !== index))}
              maxImages={5}
              context="pet"
              label="Pet Photos"
              helpText="Upload clear photos of your pet from different angles. The first photo will be the primary photo."
            />
          </div>

          {/* Submit Error */}
          {submitError && (
            <div style={{
              padding: '1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              color: '#dc2626',
              marginBottom: '1.5rem',
            }}>
              {submitError}
            </div>
          )}

          {/* Submit Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Link
              href="/pets"
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: '500',
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.75rem 2rem',
                background: submitting ? '#94a3b8' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Creating...' : 'Create Pet Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
