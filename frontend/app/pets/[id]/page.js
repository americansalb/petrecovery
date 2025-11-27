'use client';

/**
 * Pet Detail/Edit Page - Phase 1.3
 *
 * Route: /pets/[id]
 * View and edit a pet profile
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
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

export default function PetDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;

  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/pets/' + petId);
    }
  }, [status, router, petId]);

  useEffect(() => {
    if (status === 'authenticated' && petId) {
      fetchPet();
    }
  }, [status, petId]);

  const fetchPet = async () => {
    try {
      const res = await fetch(`/api/pets/${petId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Pet not found');
        }
        throw new Error('Failed to fetch pet');
      }
      const data = await res.json();
      setPet(data.pet);

      // Populate form
      setFormData({
        name: data.pet.name || '',
        species: data.pet.species || 'DOG',
        breed: data.pet.breed || '',
        age: data.pet.age?.toString() || '',
        sex: data.pet.sex || '',
        isNeutered: data.pet.isNeutered || false,
        color: data.pet.color || '',
        size: data.pet.size || 'MEDIUM',
        weight: data.pet.weight?.toString() || '',
        distinctiveMarks: data.pet.distinctiveMarks || '',
        microchipId: data.pet.microchipId || '',
        collarInfo: data.pet.collarInfo || '',
        personality: data.pet.personality || [],
        medicalConditions: data.pet.medicalConditions || '',
      });

      // Populate images
      if (data.pet.photos?.length > 0) {
        setImages(data.pet.photos.map(url => ({ url, uploaded: true })));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

      const res = await fetch(`/api/pets/${petId}`, {
        method: 'PATCH',
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
        throw new Error(data.error || 'Failed to update pet profile');
      }

      router.push('/pets');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${formData.name}'s profile? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/pets/${petId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete pet');
      }

      router.push('/pets');
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Loading pet profile..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 'clamp(1rem, 3vw, 2rem)' }}>
        <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🐾</div>
          <h1 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '0.5rem' }}>Pet Not Found</h1>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{error}</p>
          <Link
            href="/pets"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              background: '#2563eb',
              color: 'white',
              borderRadius: '0.5rem',
              textDecoration: 'none',
            }}
          >
            Back to My Pets
          </Link>
        </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Edit {pet?.name || 'Pet'}
              </h1>
              <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
                Update your pet&apos;s profile information
              </p>
            </div>
            {/* Quick Report Button */}
            {(!pet?.cases?.length || pet.cases[0]?.status === 'RESOLVED' || pet.cases[0]?.status === 'CLOSED_OTHER') && (
              <Link
                href={`/cases/report?petId=${petId}`}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#dc2626',
                  color: 'white',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                }}
              >
                Report Lost
              </Link>
            )}
          </div>
        </div>

        {/* Case History */}
        {pet?.cases?.length > 0 && (
          <div style={{
            background: '#eff6ff',
            borderRadius: '0.75rem',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            border: '1px solid #bfdbfe',
          }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e40af', marginBottom: '0.75rem' }}>
              Case History
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pet.cases.map(c => (
                <Link
                  key={c.id}
                  href={`/cases/${c.caseNumber}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'white',
                    borderRadius: '0.375rem',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ color: '#1e40af', fontWeight: '500' }}>{c.caseNumber}</span>
                  <span style={{
                    padding: '0.125rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    background: c.status === 'RESOLVED' ? '#dcfce7' : c.status === 'ACTIVE_SEARCH' ? '#dbeafe' : '#fef3c7',
                    color: c.status === 'RESOLVED' ? '#166534' : c.status === 'ACTIVE_SEARCH' ? '#1e40af' : '#92400e',
                  }}>
                    {c.status.replace('_', ' ')}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

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
              helpText="Upload clear photos of your pet. The first photo will be the primary photo."
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

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                border: '1px solid #dc2626',
                color: '#dc2626',
                borderRadius: '0.5rem',
                cursor: deleting ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                opacity: deleting ? 0.5 : 1,
              }}
            >
              {deleting ? 'Deleting...' : 'Delete Pet'}
            </button>

            <div style={{ display: 'flex', gap: '1rem' }}>
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
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
