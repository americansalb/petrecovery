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
import { ArrowLeft, Dog, Cat, Bird, Rabbit, PawPrint, Camera, AlertCircle } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import ImageUpload from '@/app/components/ImageUpload';
import { Card, Button } from '@/components/ui';

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

    if (!validate()) {
      return;
    }

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
      console.error('[PETS-NEW] Submission error:', err);
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
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
          <h1 className="text-3xl md:text-4xl font-bold text-midnight-900">
            Add New Pet
          </h1>
          <p className="text-midnight-600 mt-2">
            Register your pet so you can quickly report if they go missing
          </p>
        </div>

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
                  {SPECIES_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    );
                  })}
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
              helpText="Upload clear photos of your pet from different angles. The first photo will be the primary photo."
            />
          </Card>

          {/* Submit Error */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-4 justify-end">
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
              Create Pet Profile
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
