'use client';

/**
 * Public Lost Pet Report Form
 * Phase 15-16: Public Lost Pet Case Portal MVP (TASK-P05)
 *
 * Route: /cases/report
 * Public-facing form for reporting lost pets
 * NO AUTHENTICATION REQUIRED
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PublicReportPage() {
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState({
    // Pet Info
    petName: '',
    petSpecies: 'DOG',
    petBreed: '',
    petColor: '',
    petDescription: '',
    // Location
    city: '',
    state: '',
    zipCode: '',
    lastSeenLandmark: '',
    lastSeenAt: '',
    // Contact
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    agreeToTerms: false
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [caseNumber, setCaseNumber] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    // Pet Info
    if (!formData.petSpecies) newErrors.petSpecies = 'Pet type is required';

    // Location
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';

    // Contact
    if (!formData.contactName.trim()) newErrors.contactName = 'Your name is required';
    if (!formData.contactEmail.trim() && !formData.contactPhone.trim()) {
      newErrors.contactEmail = 'Either email or phone is required';
      newErrors.contactPhone = 'Either email or phone is required';
    }
    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Invalid email format';
    }

    // Terms
    if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms';

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
      const res = await fetch('/api/public/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit report');
      }

      setCaseNumber(data.caseNumber);
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting report:', err);
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Report Submitted!</h1>
            <p className="text-lg text-gray-600 mb-6">
              Your lost pet report has been received and is pending admin approval.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <p className="text-sm text-gray-600 mb-2">Your Case Number:</p>
              <p className="text-2xl font-bold text-blue-600">{caseNumber}</p>
              <p className="text-sm text-gray-500 mt-2">Please save this number for your records.</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Next Steps:</strong> Your case will be reviewed by our administrators. Once approved,
                it will be visible on the public cases page. This typically takes 24-48 hours.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push('/cases')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                View All Cases
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Report Another Pet
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/cases')}
            className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
          >
            ← Back to Cases
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Report a Lost Pet</h1>
          <p className="text-lg text-gray-600">
            Fill out this form to report a lost pet. Your report will be reviewed by our team before being published.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Pet Information Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold mb-6">Pet Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pet Name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  name="petName"
                  value={formData.petName}
                  onChange={handleChange}
                  placeholder="e.g., Max"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pet Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="petSpecies"
                  value={formData.petSpecies}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.petSpecies ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="DOG">Dog</option>
                  <option value="CAT">Cat</option>
                  <option value="BIRD">Bird</option>
                  <option value="OTHER">Other</option>
                </select>
                {errors.petSpecies && <p className="mt-1 text-sm text-red-600">{errors.petSpecies}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Breed <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  name="petBreed"
                  value={formData.petBreed}
                  onChange={handleChange}
                  placeholder="e.g., Golden Retriever"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Color <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  name="petColor"
                  value={formData.petColor}
                  onChange={handleChange}
                  placeholder="e.g., Brown and white"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  name="petDescription"
                  value={formData.petDescription}
                  onChange={handleChange}
                  placeholder="Any distinguishing marks, behaviors, or other details..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Last Seen Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold mb-6">Last Seen Location</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.city ? 'border-red-500' : 'border-gray-300'
                    }`}
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
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.state ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.state && <p className="mt-1 text-sm text-red-600">{errors.state}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ZIP Code <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  placeholder="e.g., 60601"
                  maxLength={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Landmark or Specific Location <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  name="lastSeenLandmark"
                  value={formData.lastSeenLandmark}
                  onChange={handleChange}
                  placeholder="e.g., Near Lincoln Park"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  When Was Pet Last Seen? <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  name="lastSeenAt"
                  value={formData.lastSeenAt}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold mb-6">Your Contact Information</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Privacy:</strong> Your contact information will NOT be publicly visible by default.
                An administrator will review your case before making it public.
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
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.contactName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.contactName && <p className="mt-1 text-sm text-red-600">{errors.contactName}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number <span className="text-gray-400 font-normal">(optional, but recommended)</span>
                </label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.contactPhone ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.contactPhone && <p className="mt-1 text-sm text-red-600">{errors.contactPhone}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address <span className="text-gray-400 font-normal">(optional, but recommended)</span>
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  placeholder="your.email@example.com"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.contactEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.contactEmail && <p className="mt-1 text-sm text-red-600">{errors.contactEmail}</p>}
              </div>
            </div>
          </div>

          {/* Terms Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start">
              <input
                type="checkbox"
                name="agreeToTerms"
                checked={formData.agreeToTerms}
                onChange={handleChange}
                className={`mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                  errors.agreeToTerms ? 'border-red-500' : ''
                }`}
              />
              <label className="ml-3 text-sm text-gray-700">
                <span className="font-semibold">I agree to the terms and conditions <span className="text-red-500">*</span></span>
                <p className="mt-1 text-gray-600">
                  By submitting this report, I confirm that the information provided is accurate to the best of my knowledge.
                  I understand that my case will be reviewed by administrators before being made public, and that
                  PetRecovery.org is not responsible for the accuracy of user-submitted information or any interactions
                  that result from this posting.
                </p>
              </label>
            </div>
            {errors.agreeToTerms && <p className="mt-2 text-sm text-red-600 ml-8">{errors.agreeToTerms}</p>}
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-semibold">Error submitting report</p>
              <p className="text-red-600 mt-1">{submitError}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-semibold text-lg"
            >
              {submitting ? 'Submitting...' : 'Submit Lost Pet Report'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/cases')}
              className="px-8 py-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold text-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
