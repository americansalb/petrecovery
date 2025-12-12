'use client';

/**
 * Report Found Pet Page - Updated with PetRecovery Design System
 * Uses: Midnight Blue + Flashlight Yellow color palette
 *
 * Route: /found
 * Public form for reporting a found pet
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dog, Cat, Bird, Rabbit, PawPrint, CheckCircle, ArrowLeft, AlertCircle, MapPin } from 'lucide-react';
import ImageUpload from '@/app/components/ImageUpload';
import { Button, Card } from '@/components/ui';

const SPECIES_OPTIONS = [
  { value: 'DOG', label: 'Dog', icon: Dog },
  { value: 'CAT', label: 'Cat', icon: Cat },
  { value: 'BIRD', label: 'Bird', icon: Bird },
  { value: 'RABBIT', label: 'Rabbit', icon: Rabbit },
  { value: 'OTHER', label: 'Other', icon: PawPrint },
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
      console.log('[FOUND] Submitting found pet report:', formData);
      const res = await fetch('/api/public/found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          photoUrls: images.map(img => img.url),
        })
      });

      console.log('[FOUND] Response status:', res.status);
      const data = await res.json();
      console.log('[FOUND] Response data:', data);

      if (!res.ok) {
        throw new Error(data.error || `Failed to submit report (${res.status})`);
      }

      setResult(data);
      setSubmitted(true);
    } catch (err) {
      console.error('[FOUND] Submission error:', err);
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (submitted && result) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card variant="elevated" className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-midnight-900 mb-4">Thank You!</h1>
            <p className="text-lg text-midnight-600 mb-6">
              Your found pet report has been submitted.
            </p>
            <div className="bg-flash-50 border border-flash-200 rounded-lg p-6 mb-6">
              <p className="text-sm text-midnight-600 mb-2">Reference Number:</p>
              <p className="text-2xl font-bold text-flash-600">{result.missionNumber}</p>
            </div>

            {result.matches?.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 text-left">
                <h2 className="text-lg font-bold text-green-800 mb-3 flex items-center gap-2">
                  <CheckCircle size={20} />
                  Potential Matches Found!
                </h2>
                <p className="text-sm text-green-700 mb-4">
                  We found {result.matches.length} potential match(es) and notified the owners.
                </p>
                <ul className="space-y-2">
                  {result.matches.map((match, i) => (
                    <li key={i} className="flex items-center justify-between bg-white p-3 rounded border border-green-100">
                      <span className="font-medium text-midnight-800">
                        {match.petName || match.missionNumber}
                      </span>
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        match.quality === 'good'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {match.score}% Match
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.matches?.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-800">
                  No matching lost pet reports were found, but don&apos;t worry!
                  If someone reports a pet matching this description, they&apos;ll be notified.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                variant="primary"
                onClick={() => router.push('/missions')}
              >
                View Lost Pets
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Report Another
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight-50 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/missions"
            className="text-flash-500 hover:text-flash-600 mb-4 inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Cases
          </Link>
          <h1 className="text-4xl font-bold text-midnight-900 mb-4">Report a Found Pet</h1>
          <p className="text-lg text-midnight-600">
            Did you find a lost pet? Fill out this form and we&apos;ll try to match it with lost pet reports.
          </p>
        </div>

        {/* Matching Info Banner */}
        <div className="bg-flash-50 border border-flash-200 rounded-lg p-4 mb-8">
          <h2 className="font-bold text-flash-700 mb-2 flex items-center gap-2">
            <MapPin size={18} />
            How Matching Works
          </h2>
          <p className="text-sm text-midnight-700">
            When you submit a found pet report, we automatically compare it against all active
            lost pet cases. If we find potential matches based on species, breed, color, and
            location, we&apos;ll notify the owners immediately.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Pet Information */}
          <Card>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-midnight-900 mb-6">Pet Information</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    What type of pet did you find? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-5 gap-3">
                    {SPECIES_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, petSpecies: opt.value }))}
                          className={`p-4 rounded-lg border-2 text-center transition ${
                            formData.petSpecies === opt.value
                              ? 'border-flash-400 bg-flash-50'
                              : 'border-midnight-200 hover:border-midnight-300'
                          }`}
                        >
                          <Icon size={24} className={`mx-auto mb-1 ${formData.petSpecies === opt.value ? 'text-flash-500' : 'text-midnight-400'}`} />
                          <p className="text-sm font-medium text-midnight-700">{opt.label}</p>
                        </button>
                      );
                    })}
                  </div>
                  {errors.petSpecies && <p className="mt-1 text-sm text-red-600">{errors.petSpecies}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-midnight-700 mb-2">
                      Breed (if known)
                    </label>
                    <input
                      type="text"
                      name="petBreed"
                      value={formData.petBreed}
                      onChange={handleChange}
                      placeholder="e.g., Golden Retriever"
                      className="w-full px-4 py-3 border border-midnight-200 rounded-lg focus:ring-2 focus:ring-flash-400 focus:border-flash-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-midnight-700 mb-2">
                      Color/Markings
                    </label>
                    <input
                      type="text"
                      name="petColor"
                      value={formData.petColor}
                      onChange={handleChange}
                      placeholder="e.g., Black and white"
                      className="w-full px-4 py-3 border border-midnight-200 rounded-lg focus:ring-2 focus:ring-flash-400 focus:border-flash-400 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="petDescription"
                    value={formData.petDescription}
                    onChange={handleChange}
                    placeholder="Describe the pet's appearance, behavior, collar, tags, etc."
                    rows={4}
                    className="w-full px-4 py-3 border border-midnight-200 rounded-lg focus:ring-2 focus:ring-flash-400 focus:border-flash-400 transition-all"
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
          </Card>

          {/* Location */}
          <Card>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-midnight-900 mb-6">Where Did You Find the Pet?</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-midnight-700 mb-2">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="e.g., Chicago"
                      className={`w-full px-4 py-3 rounded-lg focus:ring-2 transition-all ${
                        errors.city
                          ? 'border-2 border-red-500 focus:ring-red-200 bg-red-50'
                          : 'border border-midnight-200 focus:ring-flash-400 focus:border-flash-400'
                      }`}
                    />
                    {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-midnight-700 mb-2">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="e.g., IL"
                      maxLength={2}
                      className={`w-full px-4 py-3 rounded-lg focus:ring-2 transition-all ${
                        errors.state
                          ? 'border-2 border-red-500 focus:ring-red-200 bg-red-50'
                          : 'border border-midnight-200 focus:ring-flash-400 focus:border-flash-400'
                      }`}
                    />
                    {errors.state && <p className="mt-1 text-sm text-red-600">{errors.state}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-midnight-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      placeholder="e.g., 60601"
                      className="w-full px-4 py-3 border border-midnight-200 rounded-lg focus:ring-2 focus:ring-flash-400 focus:border-flash-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-midnight-700 mb-2">
                      When did you find the pet?
                    </label>
                    <input
                      type="datetime-local"
                      name="foundAt"
                      value={formData.foundAt}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-midnight-200 rounded-lg focus:ring-2 focus:ring-flash-400 focus:border-flash-400 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    Specific Location / Landmark
                  </label>
                  <input
                    type="text"
                    name="lastSeenLandmark"
                    value={formData.lastSeenLandmark}
                    onChange={handleChange}
                    placeholder="e.g., Near Lincoln Park Zoo"
                    className="w-full px-4 py-3 border border-midnight-200 rounded-lg focus:ring-2 focus:ring-flash-400 focus:border-flash-400 transition-all"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Contact */}
          <Card>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-midnight-900 mb-6">Your Contact Information</h2>

              <div className="bg-flash-50 border border-flash-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-midnight-700">
                  Your contact information will be shared with potential pet owners so they can reach you.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className={`w-full px-4 py-3 rounded-lg focus:ring-2 transition-all ${
                      errors.contactName
                        ? 'border-2 border-red-500 focus:ring-red-200 bg-red-50'
                        : 'border border-midnight-200 focus:ring-flash-400 focus:border-flash-400'
                    }`}
                  />
                  {errors.contactName && <p className="mt-1 text-sm text-red-600">{errors.contactName}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-midnight-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="contactPhone"
                      value={formData.contactPhone}
                      onChange={handleChange}
                      placeholder="(555) 123-4567"
                      className="w-full px-4 py-3 border border-midnight-200 rounded-lg focus:ring-2 focus:ring-flash-400 focus:border-flash-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-midnight-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="contactEmail"
                      value={formData.contactEmail}
                      onChange={handleChange}
                      placeholder="your.email@example.com"
                      className={`w-full px-4 py-3 rounded-lg focus:ring-2 transition-all ${
                        errors.contactEmail
                          ? 'border-2 border-red-500 focus:ring-red-200 bg-red-50'
                          : 'border border-midnight-200 focus:ring-flash-400 focus:border-flash-400'
                      }`}
                    />
                    {errors.contactEmail && <p className="mt-1 text-sm text-red-600">{errors.contactEmail}</p>}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Terms */}
          <Card>
            <div className="p-6">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  name="agreeToTerms"
                  checked={formData.agreeToTerms}
                  onChange={handleChange}
                  className={`mt-1 h-5 w-5 rounded border-midnight-300 text-flash-500 focus:ring-flash-400 ${
                    errors.agreeToTerms ? 'border-red-500' : ''
                  }`}
                />
                <label className="ml-3 text-sm text-midnight-700">
                  <span className="font-semibold">I agree to the terms <span className="text-red-500">*</span></span>
                  <p className="mt-1 text-midnight-600">
                    By submitting this report, I confirm that I have actually found this pet and
                    the information provided is accurate. I agree to allow PetRecovery.org to
                    share my contact information with potential pet owners.
                  </p>
                </label>
              </div>
              {errors.agreeToTerms && <p className="mt-2 text-sm text-red-600 ml-8">{errors.agreeToTerms}</p>}
            </div>
          </Card>

          {/* Submit Error */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-semibold">Error</p>
                <p className="text-red-600 mt-1">{submitError}</p>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              type="submit"
              variant="success"
              disabled={submitting}
              loading={submitting}
              className="flex-1 text-lg py-4"
            >
              Submit Found Pet Report
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/missions')}
              className="text-lg py-4"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
