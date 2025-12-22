'use client';

/**
 * Category View Page
 *
 * Shows all threads in a specific forum category.
 */

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Plus, MessageSquare, Eye, Clock, Pin,
  Lock, CheckCircle, AlertTriangle, Loader2, ChevronLeft,
  ChevronRight, Filter, SortAsc
} from 'lucide-react';

const URGENCY_STYLES = {
  NORMAL: null,
  URGENT: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  CRITICAL: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
};

export default function CategoryPage({ params }) {
  const { slug } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [category, setCategory] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const sort = searchParams.get('sort') || 'recent';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    fetchCategory();
    fetchThreads();
  }, [slug, sort, page]);

  const fetchCategory = async () => {
    try {
      const res = await fetch('/api/hub/categories');
      const data = await res.json();
      if (data.success) {
        const cat = data.categories.find(c => c.slug === slug);
        setCategory(cat);
      }
    } catch (err) {
      console.error('Error fetching category:', err);
    }
  };

  const fetchThreads = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hub/threads?category=${slug}&sort=${sort}&page=${page}`);
      const data = await res.json();

      if (data.success) {
        setThreads(data.threads || []);
        setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleSortChange = (newSort) => {
    router.push(`/hub/c/${slug}?sort=${newSort}`);
  };

  const handlePageChange = (newPage) => {
    router.push(`/hub/c/${slug}?sort=${sort}&page=${newPage}`);
  };

  if (loading && !category) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading category...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="text-white"
        style={{ backgroundColor: category?.color || '#6366f1' }}
      >
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Hub
          </Link>
          <div className="flex items-center gap-3 mb-2">
            {category?.icon && (
              <span className="text-3xl">{category.icon}</span>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold">
              {category?.name || 'Category'}
            </h1>
          </div>
          <p className="text-white/80">
            {category?.description}
          </p>
          <div className="mt-4 text-sm text-white/60">
            {pagination.total} threads
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSortChange('recent')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sort === 'recent'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => handleSortChange('popular')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sort === 'popular'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Popular
            </button>
            <button
              onClick={() => handleSortChange('unanswered')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sort === 'unanswered'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Unanswered
            </button>
          </div>

          {session && (
            <Link
              href={`/hub/new?category=${slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus size={18} />
              New Thread
            </Link>
          )}
        </div>

        {/* Thread List */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
            <p className="text-gray-500">Loading threads...</p>
          </div>
        ) : threads.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No threads yet
            </h3>
            <p className="text-gray-500 mb-4">
              Be the first to start a discussion in this category!
            </p>
            {session && (
              <Link
                href={`/hub/new?category=${slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                <Plus size={18} />
                Start a Thread
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => {
              const urgencyStyle = URGENCY_STYLES[thread.urgencyLevel];
              return (
                <Link
                  key={thread.id}
                  href={`/hub/thread/${thread.slug}`}
                  className={`block bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
                    urgencyStyle ? `${urgencyStyle.bg} border ${urgencyStyle.border}` : ''
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Author Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {thread.author?.firstName?.[0] || '?'}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {thread.isPinned && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                              <Pin size={12} />
                              Pinned
                            </span>
                          )}
                          {thread.isLocked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                              <Lock size={12} />
                              Locked
                            </span>
                          )}
                          {thread.isSolved && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              <CheckCircle size={12} />
                              Solved
                            </span>
                          )}
                          {urgencyStyle && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${urgencyStyle.badge}`}>
                              <AlertTriangle size={12} />
                              {thread.urgencyLevel}
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2">
                          {thread.title}
                        </h3>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{thread.author?.firstName || 'Unknown'}</span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {formatTime(thread.lastActivityAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare size={14} />
                            {thread.replyCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye size={14} />
                            {thread.viewCount}
                          </span>
                        </div>

                        {thread.locationTag && (
                          <div className="mt-2 text-xs text-gray-400">
                            {thread.locationTag}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="px-4 py-2 text-sm text-gray-600">
              Page {page} of {pagination.pages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= pagination.pages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
