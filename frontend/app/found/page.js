'use client';

/**
 * Report Found Pet Page - Phase 1.4
 *
 * Route: /found
 * Public form for reporting a found pet
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ImageUpload from '@/app/components/ImageUpload';

const SPECIES_OPTIONS = [
  { value: 'DOG', label: 'Dog', emoji: '🐕' },
  { value: 'CAT', label: 'Cat', emoji: '🐈' },
  { value: 'BIRD', label: 'Bird', emoji: '🐦' },
  { value: 'RABBIT', label: 'Rabbit', emoji: '🐰' },
  { value: 'OTHER', label: 'Other', emoji: '🐾' },
];

export default function ReportFoundPetPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    petSpecies: '',
    petBreed: '',
    petColor: '',
    petDescription: '',
    city: '',
    state: '',
    zipCode: '',
    lastSeenLandmark: '',
    foundAt: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    agreeToTerms: false,
  });

  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

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

  const validate = () => {
    const newErrors = {};

    if (!formData.petSpecies) newErrors.petSpecies = 'Please select the type of pet';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.contactName.trim()) newErrors.contactName = 'Your name is required';
    if (!formData.contactEmail.trim() && !formData.contactPhone.trim()) {
      newErrors.contactEmail = 'Please provide email or phone';
    }
    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Invalid email format';
    }
    if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setSubmitting(true);

    try {
      const res = await fetch('/api/public/found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          photoUrls: images.map(img => img.url),
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setResult(data);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (submitted && result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Thank You!</h1>
            <p className="text-lg text-gray-600 mb-6">
              Your found pet report has been submitted.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <p className="text-sm text-gray-600 mb-2">Reference Number:</p>
              <p className="text-2xl font-bold text-blue-600">{result.caseNumber}</p>
            </div>

            {result.matches?.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 text-left">
                <h2 className="text-lg font-bold text-green-800 mb-3">
                  Potential Matches Found!
                </h2>
                <p className="text-sm text-green-700 mb-4">
                  We found {result.matches.length} potential match(es) and notified the owners.
                </p>
                <ul className="space-y-2">
                  {result.matches.map((match, i) => (
                    <li key={i} className="flex items-center justify-between bg-white p-3 rounded border">
                      <span className="font-medium text-gray-800">
                        {match.petName || match.caseNumber}
                      </span>
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        match.quality === 'good'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {match.score}% Match
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.matches?.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  No matching lost pet reports were found, but don&apos;t worry!
                  If someone reports a pet matching this description, they&apos;ll be notified.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Link
                href="/cases"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                View Lost Pets
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Report Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const inputStyle = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500";
  const inputErrorStyle = "w-full px-4 py-3 border border-red-500 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-red-50";

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/cases"
            className="text-green-600 hover:text-green-800 mb-4 inline-flex items-center"
          >
            ← Back to Cases
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Report a Found Pet</h1>
          <p className="text-lg text-gray-600">
            Did you find a lost pet? Fill out this form and we&apos;ll try to match it with lost pet reports.
          </p>
        </div>

        {/* Matching Info Banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <h2 className="font-bold text-green-800 mb-2">How Matching Works</h2>
          <p className="text-sm text-green-700">
            When you submit a found pet report, we automatically compare it against all active
            lost pet cases. If we find potential matches based on species, breed, color, and
            location, we&apos;ll notify the owners immediately.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Pet Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold mb-6">Pet Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  What type of pet did you find? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {SPECIES_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, petSpecies: opt.value }))}
                      className={`p-4 rounded-lg border-2 text-center transition ${
                        formData.petSpecies === opt.value
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <p className="text-sm mt-1 font-medium">{opt.label}</p>
                    </button>
                  ))}
                </div>
                {errors.petSpecies && <p className="mt-1 text-sm text-red-600">{errors.petSpecies}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Breed (if known)
                  </label>
                  <input
                    type="text"
                    name="petBreed"
                    value={formData.petBreed}
                    onChange={handleChange}
                    placeholder="e.g., Golden Retriever"
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Color/Markings
                  </label>
                  <input
                    type="text"
                    name="petColor"
                    value={formData.petColor}
                    onChange={handleChange}
                    placeholder="e.g., Black and white"
                    className={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="petDescription"
                  value={formData.petDescription}
                  onChange={handleChange}
                  placeholder="Describe the pet's appearance, behavior, collar, tags, etc."
                  rows={4}
                  className={inputStyle}
                />
              </div>

              <ImageUpload
                images={images}
                onUpload={(newImages) => setImages(prev => [...prev, ...newImages])}
                onRemove={(index) => setImages(prev => prev.filter((_, i) => i !== index))}
                maxImages={5}
                context="found-pet"
                label="Photos of the Found Pet"
                helpText="Photos help owners identify their pet"
              />
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold mb-6">Where Did You Find the Pet?</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="e.g., Chicago"
                    className={errors.city ? inputErrorStyle : inputStyle}
                  />
                  {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="e.g., IL"
                    maxLength={2}
                    className={errors.state ? inputErrorStyle : inputStyle}
                  />
                  {errors.state && <p className="mt-1 text-sm text-red-600">{errors.state}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    placeholder="e.g., 60601"
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    When did you find the pet?
                  </label>
                  <input
                    type="datetime-local"
                    name="foundAt"
                    value={formData.foundAt}
                    onChange={handleChange}
                    className={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Specific Location / Landmark
                </label>
                <input
                  type="text"
                  name="lastSeenLandmark"
                  value={formData.lastSeenLandmark}
                  onChange={handleChange}
                  placeholder="e.g., Near Lincoln Park Zoo"
                  className={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold mb-6">Your Contact Information</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                Your contact information will be shared with potential pet owners so they can reach you.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  placeholder="Your full name"
                  className={errors.contactName ? inputErrorStyle : inputStyle}
                />
                {errors.contactName && <p className="mt-1 text-sm text-red-600">{errors.contactName}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleChange}
                    placeholder="(555) 123-4567"
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="contactEmail"
                    value={formData.contactEmail}
                    onChange={handleChange}
                    placeholder="your.email@example.com"
                    className={errors.contactEmail ? inputErrorStyle : inputStyle}
                  />
                  {errors.contactEmail && <p className="mt-1 text-sm text-red-600">{errors.contactEmail}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start">
              <input
                type="checkbox"
                name="agreeToTerms"
                checked={formData.agreeToTerms}
                onChange={handleChange}
                className={`mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 ${
                  errors.agreeToTerms ? 'border-red-500' : ''
                }`}
              />
              <label className="ml-3 text-sm text-gray-700">
                <span className="font-semibold">I agree to the terms <span className="text-red-500">*</span></span>
                <p className="mt-1 text-gray-600">
                  By submitting this report, I confirm that I have actually found this pet and
                  the information provided is accurate. I agree to allow PetRecovery.org to
                  share my contact information with potential pet owners.
                </p>
              </label>
            </div>
            {errors.agreeToTerms && <p className="mt-2 text-sm text-red-600 ml-8">{errors.agreeToTerms}</p>}
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-semibold">Error</p>
              <p className="text-red-600 mt-1">{submitError}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-semibold text-lg"
            >
              {submitting ? 'Submitting...' : 'Submit Found Pet Report'}
            </button>
            <Link
              href="/cases"
              className="px-8 py-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold text-lg"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
