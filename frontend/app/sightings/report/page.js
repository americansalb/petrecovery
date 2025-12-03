'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, CheckCircle, ArrowLeft, MapPin, Clock, MessageSquare, Loader2, AlertCircle } from 'lucide-react';
import { Card, Button } from '@/components/ui';

function ReportSightingForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const alertId = searchParams.get('alertId');

  const [formData, setFormData] = useState({
    alertId: alertId || '',
    location: '',
    details: '',
    timeOfSighting: '',
    behavior: '',
    direction: '',
    contactForFollowUp: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      console.log('[SIGHTING-REPORT] User not authenticated, redirecting to login');
      router.push('/login');
    }
  }, [status, router]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('[SIGHTING-REPORT] Submitting sighting report:', formData);

    try {
      const res = await fetch('/api/sightings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      console.log('[SIGHTING-REPORT] Response status:', res.status);
      console.log('[SIGHTING-REPORT] Response data:', data);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit sighting');
      }

      console.log('[SIGHTING-REPORT] Sighting submitted successfully');
      setSuccess(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        if (alertId) {
          console.log('[SIGHTING-REPORT] Redirecting to alert:', alertId);
          router.push(`/alerts/${alertId}`);
        } else {
          console.log('[SIGHTING-REPORT] Redirecting to dashboard');
          router.push('/dashboard');
        }
      }, 2000);
    } catch (err) {
      console.error('[SIGHTING-REPORT] Submission error:', err);
      setError('Failed to submit sighting. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-flash-500 animate-spin" />
          <span className="text-midnight-700 font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center p-4">
        <Card className="max-w-md p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-green-600 mb-4">
            Sighting Reported!
          </h2>
          <p className="text-midnight-600 mb-4">
            Thank you for helping reunite this pet with their family. The owner has been notified.
          </p>
          <p className="text-sm text-midnight-500">
            Redirecting...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight-50">
      {/* Header */}
      <div className="bg-midnight-900 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link
              href={alertId ? `/alerts/${alertId}` : '/dashboard'}
              className="hover:text-flash-400 transition-colors"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Report a Sighting</h1>
              <p className="text-sm text-midnight-300">
                Help reunite a pet with their family
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card className="p-8">
          {/* Info Banner */}
          <div className="bg-flash-50 border-2 border-flash-400 rounded-xl p-4 mb-8">
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-flash-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-midnight-900 mb-1">
                  Your Report Makes a Difference
                </div>
                <div className="text-sm text-midnight-700">
                  Even small details help. Report exactly what you saw, when, and where. The owner will be notified immediately.
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!alertId && (
              <div>
                <label className="block text-sm font-semibold text-midnight-900 mb-2">
                  Alert ID *
                </label>
                <input
                  type="text"
                  name="alertId"
                  value={formData.alertId}
                  onChange={handleChange}
                  placeholder="Enter alert ID from the poster or alert page"
                  required
                  className="w-full px-4 py-3 border-2 border-midnight-200 rounded-lg focus:border-flash-400 focus:ring-2 focus:ring-flash-400 focus:outline-none transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-midnight-900 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                Exact Location *
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="123 Main St or Main St & Oak Ave"
                required
                className="w-full px-4 py-3 border-2 border-midnight-200 rounded-lg focus:border-flash-400 focus:ring-2 focus:ring-flash-400 focus:outline-none transition-colors"
              />
              <p className="text-sm text-midnight-600 mt-2">
                Be as specific as possible - street corner, landmark, building, etc.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-midnight-900 mb-2">
                <Clock className="inline w-4 h-4 mr-1" />
                Time of Sighting *
              </label>
              <select
                name="timeOfSighting"
                value={formData.timeOfSighting}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border-2 border-midnight-200 rounded-lg focus:border-flash-400 focus:ring-2 focus:ring-flash-400 focus:outline-none transition-colors bg-white"
              >
                <option value="">Select time...</option>
                <option value="just_now">Just now (within 15 min)</option>
                <option value="30min">About 30 minutes ago</option>
                <option value="1hour">About 1 hour ago</option>
                <option value="2hours">About 2 hours ago</option>
                <option value="today">Earlier today</option>
                <option value="yesterday">Yesterday</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-midnight-900 mb-2">
                <MessageSquare className="inline w-4 h-4 mr-1" />
                What Did You See? *
              </label>
              <textarea
                name="details"
                value={formData.details}
                onChange={handleChange}
                placeholder="Describe what you saw: appearance, behavior, anything distinctive..."
                required
                rows={4}
                className="w-full px-4 py-3 border-2 border-midnight-200 rounded-lg focus:border-flash-400 focus:ring-2 focus:ring-flash-400 focus:outline-none transition-colors resize-y"
              />
              <p className="text-sm text-midnight-600 mt-2">
                Include: What was the pet doing? Did it seem scared/friendly? Any collar/tags?
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-midnight-900 mb-2">
                Behavior
              </label>
              <select
                name="behavior"
                value={formData.behavior}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-midnight-200 rounded-lg focus:border-flash-400 focus:ring-2 focus:ring-flash-400 focus:outline-none transition-colors bg-white"
              >
                <option value="">Select behavior...</option>
                <option value="friendly">Friendly/Approachable</option>
                <option value="scared">Scared/Timid</option>
                <option value="running">Running/Moving Fast</option>
                <option value="hiding">Hiding</option>
                <option value="stationary">Staying in one area</option>
                <option value="injured">Appears injured</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-midnight-900 mb-2">
                Direction of Travel
              </label>
              <input
                type="text"
                name="direction"
                value={formData.direction}
                onChange={handleChange}
                placeholder="e.g., Heading north toward the park, went into alley behind shops..."
                className="w-full px-4 py-3 border-2 border-midnight-200 rounded-lg focus:border-flash-400 focus:ring-2 focus:ring-flash-400 focus:outline-none transition-colors"
              />
            </div>

            <div className="border-t border-midnight-200 pt-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  name="contactForFollowUp"
                  checked={formData.contactForFollowUp}
                  onChange={handleChange}
                  className="w-5 h-5 mt-0.5 border-2 border-midnight-300 rounded text-flash-500 focus:ring-2 focus:ring-flash-400 cursor-pointer"
                />
                <span className="text-sm text-midnight-700 group-hover:text-midnight-900">
                  Owner can contact me for follow-up questions
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              <Eye size={18} />
              Submit Sighting Report
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function ReportSightingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-flash-500 animate-spin" />
          <span className="text-midnight-700 font-medium">Loading...</span>
        </div>
      </div>
    }>
      <ReportSightingForm />
    </Suspense>
  );
}
