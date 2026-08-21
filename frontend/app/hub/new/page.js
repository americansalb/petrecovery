'use client';

/**
 * New Thread Page
 *
 * Simple form to create a new forum thread.
 */

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Send, AlertTriangle, MapPin, Loader2,
  Home, ChevronRight
} from 'lucide-react';

function NewThreadForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    categorySlug: searchParams.get('category') || '',
    title: '',
    content: '',
    urgencyLevel: 'NORMAL',
    locationTag: '',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/hub/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
        // Auto-select first category if none specified
        if (!formData.categorySlug && data.categories?.length > 0) {
          setFormData(prev => ({ ...prev, categorySlug: data.categories[0].slug }));
        }
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
        body: JSON.stringify({
          title: formData.title.trim(),
          content: formData.content.trim(),
          categorySlug: formData.categorySlug,
          urgencyLevel: formData.urgencyLevel,
          locationTag: formData.locationTag.trim() || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/hub/thread/${data.thread.slug}`);
      } else if (data.code === 'EMAIL_NOT_VERIFIED') {
        setError('Please verify your email before posting. Check your inbox.');
      } else {
        setError(data.error || 'Failed to create thread');
      }
    } catch (err) {
      setError('Failed to create thread. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Redirect if not logged in
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login?redirect=/hub/new');
    return null;
  }

  const selectedCategory = categories.find(c => c.slug === formData.categorySlug);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <Link href="/hub" className="hover:text-blue-600 flex items-center gap-1">
              <Home size={14} />
              Forum
            </Link>
            <ChevronRight size={14} />
            <span className="text-slate-700">New Thread</span>
          </div>

          <h1 className="text-xl font-bold text-slate-800">Create New Thread</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <form method="post" onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            {/* Category Selection */}
            <div className="p-4 border-b border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.categorySlug}
                onChange={(e) => setFormData(prev => ({ ...prev, categorySlug: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
              {selectedCategory?.description && (
                <p className="mt-1 text-sm text-slate-500">{selectedCategory.description}</p>
              )}
            </div>

            {/* Title */}
            <div className="p-4 border-b border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter a descriptive title for your thread..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={200}
                required
              />
              <p className="mt-1 text-xs text-slate-400">{formData.title.length}/200 characters</p>
            </div>

            {/* Content */}
            <div className="p-4 border-b border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Share your question, story, or request. Be as detailed as possible..."
                rows={10}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                required
              />
            </div>

            {/* Optional Fields */}
            <div className="p-4 bg-slate-50">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Optional Details</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Location */}
                <div>
                  <label className="block text-sm text-slate-600 mb-1 flex items-center gap-1">
                    <MapPin size={14} />
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.locationTag}
                    onChange={(e) => setFormData(prev => ({ ...prev, locationTag: e.target.value }))}
                    placeholder="City, State"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-sm text-slate-600 mb-1 flex items-center gap-1">
                    <AlertTriangle size={14} />
                    Urgency
                  </label>
                  <select
                    value={formData.urgencyLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, urgencyLevel: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent (time-sensitive)</option>
                    <option value="CRITICAL">Critical (emergency)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="p-4 flex items-center justify-between bg-white border-t border-slate-200">
              <Link
                href="/hub"
                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft size={18} className="inline mr-1" />
                Cancel
              </Link>

              <button
                type="submit"
                disabled={submitting || !formData.title.trim() || !formData.content.trim() || !formData.categorySlug}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                Post Thread
              </button>
            </div>
          </div>
        </form>

        {/* Tips */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="font-medium text-blue-800 mb-2">Posting Tips</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Use a clear, descriptive title</li>
            <li>• Include all relevant details in your post</li>
            <li>• Add a location if it's relevant to your topic</li>
            <li>• Be respectful and follow community guidelines</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function NewThreadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-blue-600" />
      </div>
    }>
      <NewThreadForm />
    </Suspense>
  );
}
