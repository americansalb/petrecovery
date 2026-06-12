'use client';


/**
 * Category View Page
 *
 * Classic forum thread listing with table format.
 * Shows threads with author, replies, views, and last post info.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Plus, MessageSquare, Eye, Clock, Pin,
  Lock, CheckCircle, AlertTriangle, Loader2, ChevronLeft,
  ChevronRight, Home, User
} from 'lucide-react';

export default function CategoryPage({ params }) {
  const { slug } = params;
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [category, setCategory] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
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
      console.error('Error fetching threads:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return 'Never';
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleSortChange = (newSort) => {
    router.push(`/hub/c/${slug}?sort=${newSort}`);
  };

  const handlePageChange = (newPage) => {
    router.push(`/hub/c/${slug}?sort=${sort}&page=${newPage}`);
  };

  // Separate pinned and regular threads
  const pinnedThreads = threads.filter(t => t.isPinned);
  const regularThreads = threads.filter(t => !t.isPinned);

  if (loading && !category) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading forum...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div
        className="text-white"
        style={{ backgroundColor: category?.color || '#3b82f6' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
            <Link href="/hub" className="hover:text-white flex items-center gap-1">
              <Home size={14} />
              Forum Index
            </Link>
            <ChevronRight size={14} />
            <span className="text-white">{category?.name || 'Category'}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{category?.icon || '💬'}</div>
              <div>
                <h1 className="text-2xl font-bold">{category?.name || 'Category'}</h1>
                <p className="text-white/80 text-sm">{category?.description}</p>
              </div>
            </div>

            {session && (
              <Link
                href={`/hub/new?category=${slug}`}
                className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
              >
                <Plus size={18} />
                New Thread
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Sort by:</span>
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              {[
                { value: 'recent', label: 'Recent' },
                { value: 'popular', label: 'Popular' },
                { value: 'unanswered', label: 'No Replies' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${
                    sort === option.value
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-sm text-slate-500">
            {pagination.total} threads
          </div>
        </div>

        {/* Thread Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid sm:grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
            <div className="col-span-6">Topic</div>
            <div className="col-span-2 text-center">Replies</div>
            <div className="col-span-4">Last Post</div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-slate-500">Loading threads...</p>
            </div>
          ) : threads.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare size={48} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No threads yet</h3>
              <p className="text-slate-500 mb-4">Be the first to start a discussion!</p>
              {session && (
                <Link
                  href={`/hub/new?category=${slug}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  Start a Thread
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Pinned Threads */}
              {pinnedThreads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} formatTime={formatTime} isPinned />
              ))}

              {/* Regular Threads */}
              {regularThreads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} formatTime={formatTime} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                let pageNum;
                if (pagination.pages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= pagination.pages - 2) {
                  pageNum = pagination.pages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= pagination.pages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            href="/hub"
            className="text-blue-600 hover:underline text-sm flex items-center gap-1 justify-center"
          >
            <ArrowLeft size={14} />
            Back to Forum Index
          </Link>
        </div>
      </div>
    </div>
  );
}

// Thread Row Component
function ThreadRow({ thread, formatTime, isPinned }) {
  const urgencyBg = thread.urgencyLevel === 'CRITICAL' ? 'bg-red-50' :
                    thread.urgencyLevel === 'URGENT' ? 'bg-amber-50' : '';

  return (
    <div className={`group hover:bg-slate-50 transition-colors ${urgencyBg}`}>
      <div className="grid sm:grid-cols-12 gap-4 px-4 py-4 items-center">
        {/* Topic */}
        <div className="sm:col-span-6">
          <Link href={`/hub/thread/${thread.slug}`} className="block">
            {/* Status Icons */}
            <div className="flex items-center gap-2 mb-1">
              {isPinned && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                  <Pin size={10} />
                  Pinned
                </span>
              )}
              {thread.isLocked && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded font-medium">
                  <Lock size={10} />
                </span>
              )}
              {thread.isSolved && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
                  <CheckCircle size={10} />
                  Solved
                </span>
              )}
              {thread.urgencyLevel === 'URGENT' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                  <AlertTriangle size={10} />
                  Urgent
                </span>
              )}
              {thread.urgencyLevel === 'CRITICAL' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                  <AlertTriangle size={10} />
                  Critical
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
              {thread.title}
            </h3>

            {/* Author */}
            <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
              <User size={12} />
              <span>{thread.author?.firstName || 'Unknown'}</span>
              <span className="text-slate-300">•</span>
              <span>{formatTime(thread.createdAt)}</span>
            </div>
          </Link>
        </div>

        {/* Replies & Views */}
        <div className="sm:col-span-2 flex items-center sm:flex-col sm:items-center gap-4 sm:gap-1">
          <div className="flex items-center gap-1 text-slate-600">
            <MessageSquare size={14} className="text-slate-400" />
            <span className="font-medium">{thread.replyCount || 0}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500 text-sm">
            <Eye size={12} className="text-slate-400" />
            <span>{thread.viewCount || 0}</span>
          </div>
        </div>

        {/* Last Post */}
        <div className="sm:col-span-4">
          {thread.replyCount > 0 ? (
            <Link
              href={`/hub/thread/${thread.slug}`}
              className="block text-slate-600 hover:text-blue-600 transition-colors"
            >
              <div className="text-sm flex items-center gap-1">
                <Clock size={12} className="text-slate-400" />
                {formatTime(thread.lastActivityAt)}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                by {thread.lastPoster?.firstName || thread.author?.firstName || 'Unknown'}
              </div>
            </Link>
          ) : (
            <span className="text-sm text-slate-400 italic">No replies</span>
          )}
        </div>
      </div>
    </div>
  );
}
