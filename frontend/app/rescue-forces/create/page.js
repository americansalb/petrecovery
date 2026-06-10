'use client';

/**
 * Create Rescue Force Page - Updated with PetRecovery Design System
 * Uses: Midnight Blue + Flashlight Yellow color palette
 *
 * Multi-step form for creating a new rescue force:
 * 1. Basic info (name, description)
 * 2. Location & coverage area
 * 3. Review & create
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, FileText, MapPin, Check, Crown, Loader2, Globe, Lock, CheckCircle } from 'lucide-react';
import { Button, Card } from '@/components/ui';

const STEPS = [
  { id: 'basics', title: 'Rescue Force Basics', icon: FileText },
  { id: 'location', title: 'Coverage Area', icon: MapPin },
  { id: 'review', title: 'Review & Create', icon: Check },
];

export default function CreateSquadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    city: '',
    state: '',
    zipCode: '',
    radiusMiles: 5,
    contactEmail: '',
    contactPhone: '',
    website: '',
    isPublic: true,
  });

  const [coordinates, setCoordinates] = useState(null);

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/rescue-forces/create');
    }
  }, [status, router]);

  // Get coordinates from location
  const geocodeLocation = async () => {
    if (!formData.city || !formData.state) return;

    try {
      const query = `${formData.city}, ${formData.state}`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      const data = await res.json();

      if (data && data.length > 0) {
        setCoordinates({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        });
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  };

  useEffect(() => {
    if (formData.city && formData.state) {
      const timer = setTimeout(geocodeLocation, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.city, formData.state]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep = () => {
    switch (step) {
      case 0: // Basics
        if (!formData.name.trim()) {
          setError('Rescue Force name is required');
          return false;
        }
        if (formData.name.trim().length < 3) {
          setError('Rescue Force name must be at least 3 characters');
          return false;
        }
        break;

      case 1: // Location
        if (!formData.city.trim()) {
          setError('City is required');
          return false;
        }
        if (!formData.state.trim()) {
          setError('State is required');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 0));
    setError('');
  };

  const handleCreate = async () => {
    if (!validateStep()) return;

    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          centerLatitude: coordinates?.lat,
          centerLongitude: coordinates?.lng,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create rescue force');
      }

      // Redirect to the new squad page
      router.push(`/rescue-forces/${data.squad.id}?created=true`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-midnight-100 to-midnight-200">
        <Loader2 className="w-10 h-10 text-flash-400 animate-spin mb-4" />
        <p className="text-midnight-500 font-medium">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <Card className="shadow-xl">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/rescue-forces/search"
              className="inline-flex items-center gap-2 text-flash-600 hover:text-flash-500 font-semibold text-sm mb-4 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Rescue Forces
            </Link>
            <h1 className="text-2xl font-bold text-midnight-900">
              Create a Rescue Force
            </h1>
            <p className="text-midnight-500 mt-1">
              Start a volunteer pet rescue team in your community
            </p>
          </div>

          {/* Progress */}
          <div className="flex justify-between mb-8">
            {STEPS.map((s, i) => {
              const StepIcon = s.icon;
              const isActive = i <= step;
              const isComplete = i < step;

              return (
                <div
                  key={s.id}
                  className={`flex flex-col items-center flex-1 ${isActive ? 'opacity-100' : 'opacity-40'}`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                      isComplete
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-flash-400 text-midnight-900'
                        : 'bg-midnight-200 text-midnight-500'
                    }`}
                  >
                    {isComplete ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-xs text-midnight-600 text-center font-medium">
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Basics */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-midnight-700 mb-2">
                  Rescue Force Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="e.g., Austin Pet Rescue Force"
                  className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                  maxLength={100}
                />
                <p className="text-xs text-midnight-400 mt-2">
                  Choose a name that includes your city or neighborhood
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-midnight-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="Describe your rescue force's mission and what makes it special..."
                  className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400 resize-none"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-midnight-400 text-right mt-1">
                  {formData.description.length}/500
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-midnight-700 mb-2">
                  Contact Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={e => updateField('contactEmail', e.target.value)}
                  placeholder="force@example.com"
                  className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                />
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => updateField('city', e.target.value)}
                    placeholder="Austin"
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={e => updateField('state', e.target.value.toUpperCase())}
                    placeholder="TX"
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400 uppercase"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-midnight-700 mb-2">
                  ZIP Code (Optional)
                </label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={e => updateField('zipCode', e.target.value)}
                  placeholder="78701"
                  className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-midnight-700 mb-2">
                  Coverage Radius
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[3, 5, 10, 15, 25].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateField('radiusMiles', r)}
                      className={`px-4 py-2 rounded-xl font-semibold transition ${
                        formData.radiusMiles === r
                          ? 'bg-flash-400 text-midnight-900'
                          : 'bg-midnight-100 text-midnight-600 hover:bg-midnight-200'
                      }`}
                    >
                      {r} mi
                    </button>
                  ))}
                </div>
                <p className="text-xs text-midnight-400 mt-2">
                  This defines your rescue force's primary coverage area for receiving case alerts
                </p>
              </div>

              {coordinates && (
                <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium">
                    Location found: {formData.city}, {formData.state}
                  </span>
                </div>
              )}

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={e => updateField('isPublic', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-midnight-200 rounded-full peer peer-checked:bg-flash-400 transition"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    {formData.isPublic ? (
                      <Globe className="w-4 h-4 text-flash-600" />
                    ) : (
                      <Lock className="w-4 h-4 text-midnight-500" />
                    )}
                    <span className="font-medium text-midnight-900">
                      {formData.isPublic ? 'Public Rescue Force' : 'Private Rescue Force'}
                    </span>
                  </div>
                </label>
                <p className="text-xs text-midnight-400 mt-2 ml-14">
                  {formData.isPublic
                    ? 'Anyone can find and join this rescue force'
                    : 'Rescue force is invite-only and hidden from search'}
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-midnight-900 mb-4">
                Review Your Rescue Force
              </h3>

              <div className="border-b border-midnight-100 pb-4">
                <p className="text-xs font-semibold text-midnight-400 uppercase mb-1">
                  Rescue Force Name
                </p>
                <p className="text-midnight-900 font-medium">{formData.name}</p>
              </div>

              {formData.description && (
                <div className="border-b border-midnight-100 pb-4">
                  <p className="text-xs font-semibold text-midnight-400 uppercase mb-1">
                    Description
                  </p>
                  <p className="text-midnight-700 text-sm">{formData.description}</p>
                </div>
              )}

              <div className="border-b border-midnight-100 pb-4">
                <p className="text-xs font-semibold text-midnight-400 uppercase mb-1">
                  Location
                </p>
                <p className="text-midnight-900 font-medium">
                  {formData.city}, {formData.state}
                  {formData.zipCode && ` ${formData.zipCode}`}
                </p>
              </div>

              <div className="border-b border-midnight-100 pb-4">
                <p className="text-xs font-semibold text-midnight-400 uppercase mb-1">
                  Coverage
                </p>
                <p className="text-midnight-900 font-medium">
                  {formData.radiusMiles} mile radius
                </p>
              </div>

              <div className="border-b border-midnight-100 pb-4">
                <p className="text-xs font-semibold text-midnight-400 uppercase mb-1">
                  Visibility
                </p>
                <p className="text-midnight-900 font-medium flex items-center gap-2">
                  {formData.isPublic ? (
                    <>
                      <Globe className="w-4 h-4 text-flash-600" />
                      Public - Anyone can join
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-midnight-500" />
                      Private - Invite only
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 bg-flash-100 border border-flash-200 rounded-xl">
                <Crown className="w-6 h-6 text-flash-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-midnight-700">
                  As the rescue force founder, you'll be able to manage members, accept cases,
                  and appoint leaders.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-6 mt-6 border-t border-midnight-100">
            {step > 0 && (
              <Button variant="secondary" onClick={prevStep} leftIcon={ArrowLeft}>
                Back
              </Button>
            )}

            {step < STEPS.length - 1 ? (
              <Button onClick={nextStep} rightIcon={ArrowRight} className="ml-auto">
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                loading={creating}
                variant="success"
                className="ml-auto"
              >
                {creating ? 'Creating Rescue Force...' : 'Create Rescue Force'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
