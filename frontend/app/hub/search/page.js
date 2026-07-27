'use client';

/**
 * Forum Search Results Page
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, ArrowLeft, FileText, MessageSquare, ThumbsUp,
  Heart, CheckCircle, Eye, Clock, Loader2, Filter
} from 'lucide-react';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const type = searchParams.get('type') || 'all';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query, type, page]);

  const performSearch = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/hub/search?q=${encodeURIComponent(query)}&type=${type}&page=${page}`
      );
      const data = await res.json();

      if (data.success) {
        setResults(data.results || []);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/hub/search?q=${encodeURIComponent(searchInput.trim())}&type=${type}`);
    }
  };

  const handleTypeChange = (newType) => {
    router.push(`/hub/search?q=${encodeURIComponent(query)}&type=${newType}`);
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Today';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - sticks just below the h-16 universal navbar, never over it */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            Back to Hub
          </Link>

          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search discussions..."
              className="w-full pl-12 pr-24 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-indigo-600 text-white rounded-md font-medium text-sm hover:bg-indigo-700 transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm text-gray-500 mr-2">Filter:</span>
          {['all', 'threads', 'posts'].map((t) => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                type === t
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
          </div>
        ) : !query ? (
          <div className="text-center py-12">
            <Search size={48} className="mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Search the Hub</h2>
            <p className="text-gray-500">Enter a search term to find discussions</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <Search size={48} className="mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No results found</h2>
            <p className="text-gray-500">
              No discussions matching "{query}" were found.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Found {pagination?.totalCount || results.length} results for "{query}"
            </p>

            <div className="space-y-4">
              {results.map((result) => (
                <div key={`${result.type}-${result.id}`} className="bg-white rounded-xl shadow-sm p-5">
                  {result.type === 'thread' && (
                    <Link href={`/hub/thread/${result.slug}`} className="block">
                      <div className="flex items-start gap-3">
                        <FileText size={20} className="text-indigo-500 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-gray-800 hover:text-indigo-600">
                              {result.title}
                            </h3>
                            {result.isPinned && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">Pinned</span>
                            )}
                            {result.isSolved && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">Solved</span>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mb-2">
                            {result.content?.replace(/\*\*/g, '')}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span
                              className="px-2 py-0.5 rounded text-white"
                              style={{ backgroundColor: result.category?.color || '#6366f1' }}
                            >
                              {result.category?.icon} {result.category?.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare size={12} />
                              {result.replyCount} replies
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye size={12} />
                              {result.viewCount}
                            </span>
                            <span>{formatRelativeTime(result.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}

                  {result.type === 'post' && (
                    <Link href={`/hub/thread/${result.thread?.slug}`} className="block">
                      <div className="flex items-start gap-3">
                        <MessageSquare size={20} className="text-green-500 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-500 mb-1">
                            Reply in <span className="font-medium text-gray-700">{result.thread?.title}</span>
                          </p>
                          <p className="text-gray-700 mb-2">
                            {result.content?.replace(/\*\*/g, '')}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {result.isSolution && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle size={12} />
                                Solution
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <ThumbsUp size={12} />
                              {result.helpfulCount}
                            </span>
                            <span>by {result.author?.firstName}</span>
                            <span>{formatRelativeTime(result.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-4 py-2 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
