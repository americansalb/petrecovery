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
import { ArrowLeft, Dog, Cat, Bird, Rabbit, PawPrint, Camera, AlertCircle, AlertTriangle, Trash2 } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import ImageUpload from '@/app/components/ImageUpload';
import { Card, Button, Badge, EmptyState } from '@/components/ui';

const SPECIES_OPTIONS = [
  { value: 'DOG', label: 'Dog', icon: Dog },
  { value: 'CAT', label: 'Cat', icon: Cat },
  { value: 'BIRD', label: 'Bird', icon: Bird },
  { value: 'RABBIT', label: 'Rabbit', icon: Rabbit },
  { value: 'OTHER', label: 'Other', icon: PawPrint },
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      console.log('[PETS-EDIT] User not authenticated, redirecting to login');
      router.push('/login?callbackUrl=/pets/' + petId);
    }
  }, [status, router, petId]);

  useEffect(() => {
    if (status === 'authenticated' && petId) {
      fetchPet();
    }
  }, [status, petId]);

  const fetchPet = async () => {
    console.log('[PETS-EDIT] Fetching pet:', petId);
    try {
      const res = await fetch(`/api/pets/${petId}`);
      console.log('[PETS-EDIT] Response status:', res.status);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Pet not found');
        }
        throw new Error('Failed to fetch pet');
      }
      const data = await res.json();
      console.log('[PETS-EDIT] Pet data loaded:', data.pet.name);
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
      console.error('[PETS-EDIT] Fetch error:', err);
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

    if (!validate()) {
      console.log('[PETS-EDIT] Validation failed:', errors);
      return;
    }

    setSubmitting(true);
    console.log('[PETS-EDIT] Updating pet:', formData);

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
      console.log('[PETS-EDIT] Response status:', res.status);
      console.log('[PETS-EDIT] Response data:', data);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update pet profile');
      }

      console.log('[PETS-EDIT] Pet updated successfully');
      router.push('/pets');
    } catch (err) {
      console.error('[PETS-EDIT] Update error:', err);
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteConfirmOpen(false);
    setDeleting(true);
    setSubmitError(null);

    console.log('[PETS-EDIT] Deleting pet:', petId);

    try {
      const res = await fetch(`/api/pets/${petId}`, { method: 'DELETE' });
      const data = await res.json();
      console.log('[PETS-EDIT] Delete response:', res.status, data);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete pet');
      }

      console.log('[PETS-EDIT] Pet deleted successfully');
      router.push('/pets');
    } catch (err) {
      console.error('[PETS-EDIT] Delete error:', err);
      setSubmitError(err.message);
      setDeleting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <LoadingSpinner text="Loading pet profile..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-midnight-50 px-4 py-12">
        <div className="max-w-md mx-auto mt-16">
          <EmptyState
            icon={PawPrint}
            title="Pet Not Found"
            description={error}
            actionLabel="Back to My Pets"
            actionHref="/pets"
          />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  const inputClass = "w-full px-4 py-3 border-2 border-midnight-200 rounded-lg focus:border-flash-400 focus:ring-2 focus:ring-flash-400 focus:outline-none transition-colors";
  const inputErrorClass = "w-full px-4 py-3 border-2 border-red-400 bg-red-50 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-400 focus:outline-none transition-colors";
  const labelClass = "block mb-2 font-medium text-midnight-700";

  return (
    <div className="min-h-screen bg-midnight-50 px-4 py-6 md:px-8 md:py-12">
      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-midnight-900 mb-3">
              Delete Pet Profile?
            </h3>
            <p className="text-midnight-600 mb-6">
              Are you sure you want to delete <strong>{formData.name}</strong>&apos;s profile? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                className="flex-1"
              >
                Yes, Delete
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/pets"
            className="text-flash-500 hover:text-flash-600 inline-flex items-center gap-2 mb-4 font-medium transition-colors"
          >
            <ArrowLeft size={18} />
            Back to My Pets
          </Link>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-midnight-900">
                Edit {pet?.name || 'Pet'}
              </h1>
              <p className="text-midnight-600 mt-2">
                Update your pet&apos;s profile information
              </p>
            </div>
            {/* Quick Report Button */}
            {(!pet?.cases?.length || pet.cases[0]?.status === 'RESOLVED' || pet.cases[0]?.status === 'CLOSED_OTHER') && (
              <Button
                variant="danger"
                href={`/report/new?petId=${petId}`}
                size="lg"
              >
                <AlertTriangle size={18} />
                Report Lost
              </Button>
            )}
          </div>
        </div>

        {/* Case History */}
        {pet?.cases?.length > 0 && (
          <Card variant="primary" className="p-6 mb-6">
            <h3 className="text-sm font-semibold text-midnight-900 mb-3 uppercase tracking-wide">
              Case History
            </h3>
            <div className="space-y-2">
              {pet.cases.map(c => (
                <Link
                  key={c.id}
                  href={`/cases/${c.caseNumber}`}
                  className="flex justify-between items-center p-3 bg-white rounded-lg hover:bg-midnight-50 transition-colors"
                >
                  <span className="text-flash-600 font-medium">{c.caseNumber}</span>
                  <Badge
                    variant={
                      c.status === 'RESOLVED' ? 'success' :
                      c.status === 'ACTIVE_SEARCH' ? 'primary' :
                      'warning'
                    }
                  >
                    {c.status.replace('_', ' ')}
                  </Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Info Section */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold text-midnight-900 mb-6">
              Basic Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className={labelClass}>Pet Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Max"
                  className={errors.name ? inputErrorClass : inputClass}
                />
                {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
              </div>

              {/* Species */}
              <div>
                <label className={labelClass}>Species *</label>
                <select
                  name="species"
                  value={formData.species}
                  onChange={handleChange}
                  className={errors.species ? inputErrorClass : inputClass}
                >
                  {SPECIES_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Breed */}
              <div>
                <label className={labelClass}>Breed</label>
                <input
                  type="text"
                  name="breed"
                  value={formData.breed}
                  onChange={handleChange}
                  placeholder="e.g., Golden Retriever"
                  className={inputClass}
                />
              </div>

              {/* Age */}
              <div>
                <label className={labelClass}>Age (years)</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  min="0"
                  max="50"
                  placeholder="e.g., 3"
                  className={errors.age ? inputErrorClass : inputClass}
                />
                {errors.age && <p className="text-red-600 text-sm mt-1">{errors.age}</p>}
              </div>

              {/* Sex */}
              <div>
                <label className={labelClass}>Sex</label>
                <select
                  name="sex"
                  value={formData.sex}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Select...</option>
                  {SEX_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Neutered/Spayed */}
              <div className="flex items-center pt-7">
                <input
                  type="checkbox"
                  name="isNeutered"
                  checked={formData.isNeutered}
                  onChange={handleChange}
                  id="isNeutered"
                  className="w-5 h-5 text-flash-500 border-2 border-midnight-300 rounded focus:ring-2 focus:ring-flash-400"
                />
                <label htmlFor="isNeutered" className="ml-2 text-midnight-700">
                  Neutered/Spayed
                </label>
              </div>
            </div>
          </Card>

          {/* Physical Description Section */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold text-midnight-900 mb-6">
              Physical Description
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Color */}
              <div>
                <label className={labelClass}>Color/Markings *</label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  placeholder="e.g., Golden, Black and White"
                  className={errors.color ? inputErrorClass : inputClass}
                />
                {errors.color && <p className="text-red-600 text-sm mt-1">{errors.color}</p>}
              </div>

              {/* Size */}
              <div>
                <label className={labelClass}>Size *</label>
                <select
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  className={errors.size ? inputErrorClass : inputClass}
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
                <label className={labelClass}>Weight (lbs)</label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  min="0"
                  step="0.1"
                  placeholder="e.g., 25"
                  className={errors.weight ? inputErrorClass : inputClass}
                />
                {errors.weight && <p className="text-red-600 text-sm mt-1">{errors.weight}</p>}
              </div>

              {/* Distinctive Marks */}
              <div className="md:col-span-2">
                <label className={labelClass}>Distinctive Marks</label>
                <textarea
                  name="distinctiveMarks"
                  value={formData.distinctiveMarks}
                  onChange={handleChange}
                  placeholder="e.g., White spot on chest, scar on left ear, cropped tail..."
                  rows={2}
                  className={inputClass}
                />
              </div>
            </div>
          </Card>

          {/* Identification Section */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold text-midnight-900 mb-6">
              Identification
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Microchip */}
              <div>
                <label className={labelClass}>Microchip ID</label>
                <input
                  type="text"
                  name="microchipId"
                  value={formData.microchipId}
                  onChange={handleChange}
                  placeholder="e.g., 900123456789012"
                  className={inputClass}
                />
                <p className="text-midnight-600 text-xs mt-1">
                  Having a microchip greatly increases chances of reunion
                </p>
              </div>

              {/* Collar Info */}
              <div>
                <label className={labelClass}>Collar/Tag Description</label>
                <input
                  type="text"
                  name="collarInfo"
                  value={formData.collarInfo}
                  onChange={handleChange}
                  placeholder="e.g., Red collar with bone-shaped tag"
                  className={inputClass}
                />
              </div>
            </div>
          </Card>

          {/* Behavior & Health Section */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold text-midnight-900 mb-6">
              Behavior & Health
            </h2>

            {/* Personality Traits */}
            <div className="mb-6">
              <label className={labelClass}>Personality Traits</label>
              <p className="text-midnight-600 text-sm mb-3">
                Select all that apply - this helps rescuers approach your pet safely
              </p>
              <div className="flex flex-wrap gap-2">
                {PERSONALITY_TRAITS.map(trait => (
                  <button
                    key={trait}
                    type="button"
                    onClick={() => handlePersonalityToggle(trait)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      formData.personality.includes(trait)
                        ? 'bg-flash-100 border-2 border-flash-400 text-flash-700'
                        : 'bg-white border border-midnight-200 text-midnight-600 hover:border-midnight-300'
                    }`}
                  >
                    {trait}
                  </button>
                ))}
              </div>
            </div>

            {/* Medical Conditions */}
            <div>
              <label className={labelClass}>Medical Conditions</label>
              <textarea
                name="medicalConditions"
                value={formData.medicalConditions}
                onChange={handleChange}
                placeholder="e.g., Diabetes (needs insulin), arthritis, allergies to chicken..."
                rows={2}
                className={inputClass}
              />
              <p className="text-midnight-600 text-xs mt-1">
                Important for rescuers to know about medications or special needs
              </p>
            </div>
          </Card>

          {/* Photos Section */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold text-midnight-900 mb-6 flex items-center gap-2">
              <Camera className="w-5 h-5 text-flash-500" />
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
          </Card>

          {/* Submit Error */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              loading={deleting}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <Trash2 size={18} />
              {deleting ? 'Deleting...' : 'Delete Pet'}
            </Button>

            <div className="flex gap-4">
              <Button
                variant="outline"
                href="/pets"
                size="lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
