'use client';

/**
 * Admin Location Logs
 *
 * Shows every GPS detection from the lost pet report wizard,
 * including detections where the user never submitted a report.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Search, ChevronLeft, ChevronRight, Navigation,
  CheckCircle, XCircle, Clock, Smartphone, Globe, Filter,
  ArrowLeft, ExternalLink
} from 'lucide-react';

export default function AdminLocationLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, submitted: 0, notSubmitted: 0, today: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, submitted, not_submitted
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin/location-logs');
    } else if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        filter,
      });
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/location-logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      setStats(data.stats || { total: 0, submitted: 0, notSubmitted: 0, today: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchLogs();
    }
  }, [session, page, filter]);

  // Debounced search
  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchLogs();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getAccuracyBadge = (accuracy) => {
    if (!accuracy) return { text: 'Unknown', color: 'bg-gray-100 text-gray-600' };
    if (accuracy < 50) return { text: `${accuracy}m - Excellent`, color: 'bg-green-100 text-green-700' };
    if (accuracy < 150) return { text: `${accuracy}m - Good`, color: 'bg-emerald-100 text-emerald-700' };
    if (accuracy < 1000) return { text: `${accuracy}m - Fair`, color: 'bg-amber-100 text-amber-700' };
    return { text: `${Math.round(accuracy / 1000)}km - Poor`, color: 'bg-red-100 text-red-700' };
  };

  const getDeviceType = (ua) => {
    if (!ua) return 'Unknown';
    if (/iPhone|iPad/i.test(ua)) return 'iOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Mobile/i.test(ua)) return 'Mobile';
    return 'Desktop';
  };

  if (status === 'loading' || (session?.user?.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Navigation size={24} className="text-blue-500" />
              Location Detection Logs
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Every GPS detection from the lost pet wizard — even if no report was submitted
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe size={16} className="text-blue-500" />
              <span className="text-xs font-medium text-gray-500 uppercase">Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={16} className="text-green-500" />
              <span className="text-xs font-medium text-gray-500 uppercase">Submitted</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.submitted}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={16} className="text-orange-500" />
              <span className="text-xs font-medium text-gray-500 uppercase">Not Submitted</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{stats.notSubmitted}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-purple-500" />
              <span className="text-xs font-medium text-gray-500 uppercase">Today</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{stats.today}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by address, city, case number, or session..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex gap-1.5">
              {[
                { value: 'all', label: 'All' },
                { value: 'submitted', label: 'Submitted' },
                { value: 'not_submitted', label: 'Not Submitted' },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => { setFilter(f.value); setPage(1); }}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    filter === f.value
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <Navigation size={32} className="mx-auto mb-3 animate-pulse" />
              <p>Loading location logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <MapPin size={32} className="mx-auto mb-3" />
              <p>No location detections found</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Time</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Location</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Coordinates</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Accuracy</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Device</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const acc = getAccuracyBadge(log.accuracy);
                      const device = getDeviceType(log.userAgent);
                      return (
                        <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-[250px]">
                              <p className="text-gray-900 font-medium truncate">{log.city || 'Unknown city'}</p>
                              <p className="text-gray-400 text-xs truncate">{log.address || 'No address'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <a
                              href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-mono text-xs flex items-center gap-1"
                            >
                              {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
                              <ExternalLink size={10} />
                            </a>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${acc.color}`}>
                              {acc.text}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="flex items-center gap-1.5 text-gray-600 text-xs">
                              <Smartphone size={12} />
                              {device}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {log.submitted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <CheckCircle size={10} />
                                Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                <XCircle size={10} />
                                No report
                              </span>
                            )}
                            {log.caseNumber && (
                              <Link
                                href={`/admin/missions/${log.caseNumber}`}
                                className="block text-xs text-blue-600 hover:underline mt-0.5"
                              >
                                {log.caseNumber}
                              </Link>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-gray-400 font-mono text-xs">
                              {log.sessionId.slice(0, 8)}...
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {logs.map((log) => {
                  const acc = getAccuracyBadge(log.accuracy);
                  const device = getDeviceType(log.userAgent);
                  return (
                    <div key={log.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{log.city || log.address || 'Unknown'}</p>
                          <p className="text-xs text-gray-400 truncate">{log.address}</p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(log.createdAt)}</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${acc.color}`}>
                          {acc.text}
                        </span>
                        {log.submitted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle size={10} /> Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            <XCircle size={10} /> No report
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <Smartphone size={10} /> {device}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <a
                          href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 text-xs font-mono flex items-center gap-1"
                        >
                          {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)} <ExternalLink size={10} />
                        </a>
                        {log.caseNumber && (
                          <Link href={`/admin/missions/${log.caseNumber}`} className="text-xs text-blue-600 hover:underline">
                            {log.caseNumber}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * 50) + 1}-{Math.min(page * 50, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="flex items-center px-3 text-sm text-gray-600">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
