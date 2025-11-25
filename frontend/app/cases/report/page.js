'use client';

// /cases/report/page.js
// Public lost pet report form

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PublicReportPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [caseNumber, setCaseNumber] = useState('');

  const [formData, setFormData] = useState({
    // Reporter
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    // Pet
    petName: '',
    species: 'DOG',
    breed: '',
    color: '',
    size: 'MEDIUM',
    photoUrl: '',
    description: '',
    // Incident
    lastSeenDate: '',
    lastSeenTime: '',
    lastSeenAddress: '',
    lastSeenLatitude: null,
    lastSeenLongitude: null,
    escapeScenario: '',
    escapeDetails: '',
    // Privacy
    isPublic: true,
    publicContactOk: true,
    publicPhoneVisible: false,
    publicEmailVisible: false,
    // Reward
    hasReward: false,
    rewardAmount: '',
  });

  function updateForm(field, value) {
    setFormData({ ...formData, [field]: value });
    // Clear error when field is updated
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  }

  function validateStep(stepNum) {
    const newErrors = {};

    if (stepNum === 1) {
      if (!formData.email) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email';
      }
      if (!formData.firstName) newErrors.firstName = 'First name is required';
    }

    if (stepNum === 2) {
      if (!formData.petName) newErrors.petName = 'Pet name is required';
      if (!formData.color) newErrors.color = 'Color is required';
      if (!formData.photoUrl) newErrors.photoUrl = 'Photo URL is required';
    }

    if (stepNum === 3) {
      if (!formData.lastSeenDate) newErrors.lastSeenDate = 'Date is required';
      if (!formData.lastSeenTime) newErrors.lastSeenTime = 'Time is required';
      if (!formData.lastSeenAddress) newErrors.lastSeenAddress = 'Address is required';
      if (!formData.escapeScenario) newErrors.escapeScenario = 'Please describe how they got out';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function nextStep() {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  }

  function prevStep() {
    setStep(step - 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!validateStep(3)) return;

    setLoading(true);

    try {
      // Combine date and time
      const lastSeenAt = new Date(`${formData.lastSeenDate}T${formData.lastSeenTime}`);

      const payload = {
        reporter: {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
        },
        pet: {
          name: formData.petName,
          species: formData.species,
          breed: formData.breed,
          color: formData.color,
          size: formData.size,
          photoUrl: formData.photoUrl,
          description: formData.description,
        },
        incident: {
          lastSeenAt: lastSeenAt.toISOString(),
          lastSeenAddress: formData.lastSeenAddress,
          lastSeenLatitude: formData.lastSeenLatitude || 41.8781, // Default to Chicago
          lastSeenLongitude: formData.lastSeenLongitude || -87.6298,
          escapeScenario: formData.escapeScenario,
          escapeDetails: formData.escapeDetails,
        },
        visibility: {
          isPublic: formData.isPublic,
          publicContactOk: formData.publicContactOk,
          publicPhoneVisible: formData.publicPhoneVisible,
          publicEmailVisible: formData.publicEmailVisible,
        },
        reward: {
          hasReward: formData.hasReward,
          rewardAmount: formData.hasReward ? parseFloat(formData.rewardAmount) || 0 : null,
        },
      };

      const res = await fetch('/api/public/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          setErrors(data.details);
        } else {
          setErrors({ submit: data.error || 'Failed to submit report' });
        }
        setLoading(false);
        return;
      }

      // Success!
      setCaseNumber(data.caseNumber);
      setSubmitted(true);
    } catch (error) {
      console.error('Submit error:', error);
      setErrors({ submit: 'Failed to submit report. Please try again.' });
    }

    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Submitted!</h1>
          <p className="text-gray-600 mb-4">
            Your lost pet report has been submitted. Check your email for confirmation.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500">Case Number</p>
            <p className="text-xl font-bold text-gray-900 font-mono">{caseNumber}</p>
          </div>
          <div className="space-y-3">
            <Link
              href={`/cases/${caseNumber}`}
              className="block w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700"
            >
              View Your Case
            </Link>
            <Link
              href="/cases"
              className="block w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200"
            >
              Browse All Cases
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link href="/cases" className="text-red-600 hover:underline">
            &larr; Back to Lost Pets
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Report a Lost Pet</h1>
          <p className="text-gray-600 mb-6">
            We'll help spread the word to our community of volunteers.
          </p>

          {/* Progress Steps */}
          <div className="flex mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex-1 flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  s <= step ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {s}
                </div>
                {s < 4 && (
                  <div className={`flex-1 h-1 mx-2 ${s < step ? 'bg-red-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Your Info */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900">Your Information</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="your@email.com"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => updateForm('firstName', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => updateForm('lastName', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateForm('phone', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Pet Info */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900">Pet Information</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pet Name *
                  </label>
                  <input
                    type="text"
                    value={formData.petName}
                    onChange={(e) => updateForm('petName', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 ${errors.petName ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.petName && <p className="text-red-500 text-sm mt-1">{errors.petName}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Species *
                    </label>
                    <select
                      value={formData.species}
                      onChange={(e) => updateForm('species', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="DOG">Dog</option>
                      <option value="CAT">Cat</option>
                      <option value="BIRD">Bird</option>
                      <option value="RABBIT">Rabbit</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Breed
                    </label>
                    <input
                      type="text"
                      value={formData.breed}
                      onChange={(e) => updateForm('breed', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., Golden Retriever"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Color *
                    </label>
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => updateForm('color', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 ${errors.color ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="e.g., Golden, Black & White"
                    />
                    {errors.color && <p className="text-red-500 text-sm mt-1">{errors.color}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Size *
                    </label>
                    <select
                      value={formData.size}
                      onChange={(e) => updateForm('size', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="TINY">Tiny (&lt;10 lbs)</option>
                      <option value="SMALL">Small (10-25 lbs)</option>
                      <option value="MEDIUM">Medium (25-60 lbs)</option>
                      <option value="LARGE">Large (60-90 lbs)</option>
                      <option value="GIANT">Giant (&gt;90 lbs)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Photo URL *
                  </label>
                  <input
                    type="url"
                    value={formData.photoUrl}
                    onChange={(e) => updateForm('photoUrl', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 ${errors.photoUrl ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="https://..."
                  />
                  {errors.photoUrl && <p className="text-red-500 text-sm mt-1">{errors.photoUrl}</p>}
                  <p className="text-gray-500 text-xs mt-1">
                    Tip: Upload to Imgur or Google Photos and paste the link here
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateForm('description', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={3}
                    placeholder="Any distinguishing features, collar, tags, behavior..."
                  />
                </div>
              </div>
            )}

            {/* Step 3: Incident */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900">When & Where</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date Last Seen *
                    </label>
                    <input
                      type="date"
                      value={formData.lastSeenDate}
                      onChange={(e) => updateForm('lastSeenDate', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 ${errors.lastSeenDate ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {errors.lastSeenDate && <p className="text-red-500 text-sm mt-1">{errors.lastSeenDate}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time Last Seen *
                    </label>
                    <input
                      type="time"
                      value={formData.lastSeenTime}
                      onChange={(e) => updateForm('lastSeenTime', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 ${errors.lastSeenTime ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {errors.lastSeenTime && <p className="text-red-500 text-sm mt-1">{errors.lastSeenTime}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Where Last Seen *
                  </label>
                  <input
                    type="text"
                    value={formData.lastSeenAddress}
                    onChange={(e) => updateForm('lastSeenAddress', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 ${errors.lastSeenAddress ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="123 Main St, Chicago, IL 60601"
                  />
                  {errors.lastSeenAddress && <p className="text-red-500 text-sm mt-1">{errors.lastSeenAddress}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    How did they get out? *
                  </label>
                  <input
                    type="text"
                    value={formData.escapeScenario}
                    onChange={(e) => updateForm('escapeScenario', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 ${errors.escapeScenario ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="e.g., Slipped out of backyard gate"
                  />
                  {errors.escapeScenario && <p className="text-red-500 text-sm mt-1">{errors.escapeScenario}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Details
                  </label>
                  <textarea
                    value={formData.escapeDetails}
                    onChange={(e) => updateForm('escapeDetails', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Any additional context..."
                  />
                </div>
              </div>
            )}

            {/* Step 4: Privacy & Submit */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900">Privacy & Reward</h2>

                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={(e) => updateForm('isPublic', e.target.checked)}
                      className="w-4 h-4 text-red-600"
                    />
                    <span className="text-gray-700">Make this case publicly visible</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.publicContactOk}
                      onChange={(e) => updateForm('publicContactOk', e.target.checked)}
                      className="w-4 h-4 text-red-600"
                    />
                    <span className="text-gray-700">Allow people to contact me about this case</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.publicPhoneVisible}
                      onChange={(e) => updateForm('publicPhoneVisible', e.target.checked)}
                      className="w-4 h-4 text-red-600"
                    />
                    <span className="text-gray-700">Show my phone number publicly</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.publicEmailVisible}
                      onChange={(e) => updateForm('publicEmailVisible', e.target.checked)}
                      className="w-4 h-4 text-red-600"
                    />
                    <span className="text-gray-700">Show my email publicly</span>
                  </label>
                </div>

                <div className="border-t pt-4 mt-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.hasReward}
                      onChange={(e) => updateForm('hasReward', e.target.checked)}
                      className="w-4 h-4 text-red-600"
                    />
                    <span className="text-gray-700">Offering a reward</span>
                  </label>

                  {formData.hasReward && (
                    <div className="mt-3 ml-7">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reward Amount ($)
                      </label>
                      <input
                        type="number"
                        value={formData.rewardAmount}
                        onChange={(e) => updateForm('rewardAmount', e.target.value)}
                        className="w-32 border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="500"
                      />
                    </div>
                  )}
                </div>

                {errors.submit && (
                  <div className="bg-red-50 text-red-700 p-3 rounded-lg">
                    {errors.submit}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
