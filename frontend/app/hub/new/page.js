'use client';

/**
 * New Thread Page
 *
 * Create a new discussion thread in the forum.
 */

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Send, AlertTriangle, MapPin, Loader2
} from 'lucide-react';

function NewThreadForm() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCategory = searchParams.get('category');

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    categorySlug: preselectedCategory || '',
    locationTag: '',
    urgencyLevel: 'NORMAL',
  });

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login?redirect=/hub/new');
      return;
    }

    fetchCategories();
  }, [authStatus, router]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/hub/categories');
      const data = await res.json();
      if (data.success) {
        // Filter out mod-only categories for regular users
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim() || !formData.categorySlug) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/hub/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/hub/thread/${data.thread.slug}`);
      } else {
        setError(data.error || 'Failed to create thread');
      }
    } catch (err) {
      setError('Failed to create thread. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Hub
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">
            Start a New Discussion
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={formData.categorySlug}
                onChange={(e) => setFormData({ ...formData, categorySlug: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="What's your discussion about?"
                maxLength={200}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <p className="mt-1 text-sm text-gray-400">
                {formData.title.length}/200 characters
              </p>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Share your story, ask your question, or start a discussion..."
                rows={8}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                required
              />
            </div>

            {/* Location Tag */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin size={16} className="inline mr-1" />
                Location (optional)
              </label>
              <input
                type="text"
                value={formData.locationTag}
                onChange={(e) => setFormData({ ...formData, locationTag: e.target.value })}
                placeholder="e.g., Austin, TX or Northeast Ohio"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-400">
                Helps local community members find your post
              </p>
            </div>

            {/* Urgency Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <AlertTriangle size={16} className="inline mr-1" />
                Urgency Level
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="urgency"
                    value="NORMAL"
                    checked={formData.urgencyLevel === 'NORMAL'}
                    onChange={(e) => setFormData({ ...formData, urgencyLevel: e.target.value })}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="text-gray-700">Normal</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="urgency"
                    value="URGENT"
                    checked={formData.urgencyLevel === 'URGENT'}
                    onChange={(e) => setFormData({ ...formData, urgencyLevel: e.target.value })}
                    className="w-4 h-4 text-amber-600"
                  />
                  <span className="text-amber-700">Urgent</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="urgency"
                    value="CRITICAL"
                    checked={formData.urgencyLevel === 'CRITICAL'}
                    onChange={(e) => setFormData({ ...formData, urgencyLevel: e.target.value })}
                    className="w-4 h-4 text-red-600"
                  />
                  <span className="text-red-700">Critical</span>
                </label>
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Only use Urgent/Critical for time-sensitive situations
              </p>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Link
                href="/hub"
                className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                Post Discussion
              </button>
            </div>
          </form>
        </div>

        {/* Tips */}
        <div className="mt-6 bg-indigo-50 rounded-xl p-6">
          <h3 className="font-semibold text-indigo-800 mb-3">Tips for a great post</h3>
          <ul className="space-y-2 text-sm text-indigo-700">
            <li>• Write a clear, descriptive title</li>
            <li>• Provide context and relevant details</li>
            <li>• Add a location if it's relevant to your area</li>
            <li>• Be respectful and constructive</li>
            <li>• Only mark as Urgent/Critical if it truly is time-sensitive</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function NewThreadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-indigo-500" />
      </div>
    }>
      <NewThreadForm />
    </Suspense>
  );
}
