'use client';

/**
 * Shelter Request Page
 *
 * Form for shelters/rescues to request an account.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, ArrowLeft, Send, Loader2, CheckCircle,
  Clock, XCircle, Home, Users, Heart
} from 'lucide-react';

const SHELTER_TYPES = [
  { value: 'SHELTER', label: 'Animal Shelter', description: 'Municipal or private shelter' },
  { value: 'RESCUE', label: 'Rescue Organization', description: 'Non-profit rescue group' },
  { value: 'FOSTER_NETWORK', label: 'Foster Network', description: 'Foster-based rescue' },
];

const ROLES = [
  { value: 'OWNER', label: 'Owner/Founder' },
  { value: 'MANAGER', label: 'Manager/Director' },
  { value: 'STAFF', label: 'Staff Member' },
  { value: 'VOLUNTEER', label: 'Volunteer Coordinator' },
];

export default function ShelterRequestPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [existingRequest, setExistingRequest] = useState(null);

  const [formData, setFormData] = useState({
    shelterName: '',
    shelterType: 'SHELTER',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    email: '',
    website: '',
    about: '',
    role: 'MANAGER',
    howHeard: '',
  });

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login?redirect=/shelter/request');
      return;
    }

    if (authStatus === 'authenticated') {
      checkExistingRequest();
    }
  }, [authStatus, router]);

  const checkExistingRequest = async () => {
    try {
      const res = await fetch('/api/shelter/request');
      const data = await res.json();

      if (data.success && data.status !== 'NONE') {
        setExistingRequest(data);
      }
    } catch (err) {
      console.error('Error checking request:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.shelterName || !formData.city || !formData.state || !formData.email) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/shelter/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setExistingRequest({
          status: 'PENDING',
          claim: data.claim,
        });
      } else {
        setError(data.error || 'Failed to submit request');
      }
    } catch (err) {
      setError('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  // Show status if request exists
  if (existingRequest) {
    const statusConfig = {
      PENDING: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Pending Review' },
      UNDER_REVIEW: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Under Review' },
      APPROVED: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: 'Approved' },
      REJECTED: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Not Approved' },
    };

    const config = statusConfig[existingRequest.status] || statusConfig.PENDING;
    const StatusIcon = config.icon;

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className={`${config.bg} rounded-2xl p-8 text-center`}>
            <StatusIcon size={64} className={`mx-auto mb-4 ${config.color}`} />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              {config.label}
            </h1>
            <p className="text-gray-600 mb-6">
              {existingRequest.status === 'APPROVED' ? (
                <>Your shelter account for <strong>{existingRequest.shelter?.name}</strong> is ready!</>
              ) : existingRequest.status === 'REJECTED' ? (
                <>Unfortunately, your request was not approved. {existingRequest.claim?.reviewNotes && <span>Reason: {existingRequest.claim.reviewNotes}</span>}</>
              ) : (
                <>Your request for <strong>{existingRequest.claim?.shelterName}</strong> is being reviewed. We'll email you when it's approved.</>
              )}
            </p>
            {existingRequest.status === 'APPROVED' ? (
              <Link
                href="/shelter/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
              >
                <Home size={20} />
                Go to Dashboard
              </Link>
            ) : (
              <Link
                href="/hub"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg font-semibold hover:bg-gray-100 border"
              >
                <Users size={20} />
                Visit Rescue Hub
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 text-indigo-200 hover:text-white mb-4"
          >
            <ArrowLeft size={20} />
            Back
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <Building2 size={32} />
            <h1 className="text-2xl sm:text-3xl font-bold">
              Shelter Account Request
            </h1>
          </div>
          <p className="text-indigo-100">
            Get free tools to manage your animals, connect with lost pet owners, and accept donations.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Benefits */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="font-semibold text-gray-800 mb-4">What you get (free forever):</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={20} className="text-indigo-600" />
              </div>
              <div>
                <div className="font-medium text-gray-800">Public Profile</div>
                <div className="text-sm text-gray-500">Your own page on ReunitePets</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <Heart size={20} className="text-green-600" />
              </div>
              <div>
                <div className="font-medium text-gray-800">Auto-Matching</div>
                <div className="text-sm text-gray-500">Connect with lost pet owners</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Users size={20} className="text-amber-600" />
              </div>
              <div>
                <div className="font-medium text-gray-800">Donations</div>
                <div className="text-sm text-gray-500">Accept donations, no fees</div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Tell us about your organization</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization Info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={formData.shelterName}
                  onChange={(e) => setFormData({ ...formData, shelterName: e.target.value })}
                  placeholder="e.g., Happy Tails Animal Rescue"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Type *
                </label>
                <div className="grid sm:grid-cols-3 gap-3">
                  {SHELTER_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={`flex flex-col p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.shelterType === type.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shelterType"
                        value={type.value}
                        checked={formData.shelterType === type.value}
                        onChange={(e) => setFormData({ ...formData, shelterType: e.target.value })}
                        className="sr-only"
                      />
                      <span className="font-medium text-gray-800">{type.label}</span>
                      <span className="text-xs text-gray-500">{type.description}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State *
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="State"
                  maxLength={2}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Contact */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@shelter.org"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://yourshelter.org"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* About */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                About Your Organization
              </label>
              <textarea
                value={formData.about}
                onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                placeholder="Tell us a bit about your organization..."
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Your Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <div className="pt-4 border-t">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Send size={20} />
                )}
                Submit Request
              </button>
              <p className="mt-3 text-sm text-gray-500">
                We'll review your request and get back to you within 1-2 business days.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
