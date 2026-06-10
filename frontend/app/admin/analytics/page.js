'use client';

/**
 * Phase 10: Admin Analytics Dashboard
 *
 * Comprehensive analytics dashboard with charts and metrics.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AnalyticsDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState(30);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin/analytics');
    } else if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchAnalytics();
    }
  }, [session, dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/admin/analytics?days=${dateRange}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch analytics');
      }

      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    window.location.href = `/api/admin/analytics/export?format=${format}&days=${dateRange}`;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-200 rounded w-1/4" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-64 bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Last updated: {new Date(analytics.generatedAt).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-4 mt-4 md:mt-0">
              {/* Date Range Selector */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>Last year</option>
              </select>

              {/* Export Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('csv')}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Export JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Cases"
            value={analytics.overview.totalCases}
            subtitle={`${analytics.overview.recentMissions} new in last ${dateRange} days`}
            icon="📋"
            color="blue"
          />
          <StatCard
            title="Active Missions"
            value={analytics.overview.activeMissions}
            subtitle={`${analytics.overview.resolutionRate}% resolution rate`}
            icon="🔍"
            color="yellow"
          />
          <StatCard
            title="Reunited Pets"
            value={analytics.overview.resolvedCases}
            subtitle={`${analytics.overview.recentReunions} in last ${dateRange} days`}
            icon="🎉"
            color="green"
          />
          <StatCard
            title="Total Users"
            value={analytics.overview.totalUsers}
            subtitle={`${analytics.overview.activeUsers} active`}
            icon="👥"
            color="purple"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Case Trends Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Trends</h2>
            <SimpleLineChart data={analytics.caseTrends} />
          </div>

          {/* Pet Types Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cases by Pet Type</h2>
            <SimplePieChart data={analytics.petTypes} />
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Resolution Time */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Resolution Time</h2>
            <div className="flex items-center gap-8 mb-6">
              <div>
                <p className="text-3xl font-bold text-blue-600">{analytics.resolution.averageDays}</p>
                <p className="text-sm text-gray-500">Avg. days to resolve</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">{analytics.resolution.medianDays}</p>
                <p className="text-sm text-gray-500">Median days</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-purple-600">{analytics.resolution.totalResolved}</p>
                <p className="text-sm text-gray-500">Total resolved</p>
              </div>
            </div>
            <SimpleBarChart data={analytics.resolution.distribution} labelKey="range" valueKey="count" />
          </div>

          {/* Top Locations */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Locations</h2>
            <div className="space-y-3">
              {analytics.locations.map((loc, idx) => (
                <div key={loc.state} className="flex items-center">
                  <span className="w-8 text-sm text-gray-500">{idx + 1}.</span>
                  <span className="flex-1 font-medium">{loc.state}</span>
                  <span className="text-gray-600">{loc.count} cases</span>
                  <div className="w-24 ml-4">
                    <div className="h-2 bg-gray-200 rounded-full">
                      <div
                        className="h-2 bg-blue-600 rounded-full"
                        style={{
                          width: `${(loc.count / analytics.locations[0].count) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Engagement & Squads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Engagement Metrics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{analytics.engagement.shares.total}</p>
                <p className="text-sm text-gray-500">Total Shares</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{analytics.engagement.sightingReports}</p>
                <p className="text-sm text-gray-500">Sightings</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{analytics.engagement.notificationsSent}</p>
                <p className="text-sm text-gray-500">Notifications</p>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Shares by Platform</h3>
            <div className="space-y-2">
              {analytics.engagement.shares.byPlatform.map((p) => (
                <div key={p.platform} className="flex items-center justify-between">
                  <span className="capitalize">{p.platform}</span>
                  <span className="font-medium">{p.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Squad Metrics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Rescue Forces</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{analytics.squads.totalSquads}</p>
                <p className="text-sm text-gray-500">Total Rescue Forces</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{analytics.squads.totalMembers}</p>
                <p className="text-sm text-gray-500">Total Members</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{analytics.squads.averageMembersPerSquad}</p>
                <p className="text-sm text-gray-500">Avg Members</p>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Top Rescue Forces</h3>
            <div className="space-y-2">
              {analytics.squads.topSquads.slice(0, 5).map((squad) => (
                <div key={squad.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{squad.name}</span>
                  <span className="text-gray-500">{squad.location}</span>
                  <span>{squad.members} members</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Registration Trends */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User Registration Trends</h2>
          <SimpleLineChart data={analytics.userTrends} valueKey="count" />
        </div>
      </div>
    </div>
  );
}

/**
 * Stat Card Component
 */
function StatCard({ title, value, subtitle, icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <span className={`text-2xl p-2 rounded-lg ${colors[color]}`}>{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

/**
 * Simple Line Chart (using CSS)
 */
function SimpleLineChart({ data, valueKey = 'created' }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500">No data available</p>;
  }

  const maxValue = Math.max(...data.map((d) => d[valueKey] || 0)) || 1;

  return (
    <div className="h-48 flex items-end gap-1">
      {data.map((d, idx) => (
        <div
          key={idx}
          className="flex-1 bg-blue-500 hover:bg-blue-600 transition-colors rounded-t"
          style={{ height: `${((d[valueKey] || 0) / maxValue) * 100}%`, minHeight: '2px' }}
          title={`${d.date}: ${d[valueKey]}`}
        />
      ))}
    </div>
  );
}

/**
 * Simple Bar Chart (using CSS)
 */
function SimpleBarChart({ data, labelKey = 'label', valueKey = 'value' }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500">No data available</p>;
  }

  const maxValue = Math.max(...data.map((d) => d[valueKey] || 0)) || 1;

  return (
    <div className="space-y-2">
      {data.map((d, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="w-20 text-sm text-gray-600 truncate">{d[labelKey]}</span>
          <div className="flex-1 h-6 bg-gray-100 rounded">
            <div
              className="h-6 bg-blue-500 rounded flex items-center justify-end pr-2"
              style={{ width: `${((d[valueKey] || 0) / maxValue) * 100}%`, minWidth: '20px' }}
            >
              <span className="text-xs text-white font-medium">{d[valueKey]}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Simple Pie Chart (using CSS)
 */
function SimplePieChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500">No data available</p>;
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];

  return (
    <div className="flex items-center gap-8">
      {/* Pie visualization using conic-gradient */}
      <div
        className="w-32 h-32 rounded-full"
        style={{
          background: `conic-gradient(${data
            .map((d, i) => {
              const startPercent = data.slice(0, i).reduce((s, x) => s + x.count, 0) / total * 100;
              const endPercent = startPercent + (d.count / total * 100);
              return `${colors[i % colors.length]} ${startPercent}% ${endPercent}%`;
            })
            .join(', ')})`,
        }}
      />

      {/* Legend */}
      <div className="space-y-2">
        {data.slice(0, 6).map((d, idx) => (
          <div key={d.type} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors[idx % colors.length] }}
            />
            <span className="text-sm">
              {d.type} ({d.count})
            </span>
          </div>
        ))}
        {data.length > 6 && (
          <span className="text-sm text-gray-500">+{data.length - 6} more</span>
        )}
      </div>
    </div>
  );
}
