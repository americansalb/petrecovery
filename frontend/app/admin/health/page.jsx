'use client';

/**
 * Admin Health Dashboard - Mission Control for Platform Observability
 * TASK-006, 007, 008, 009: Complete admin dashboard UI
 *
 * This is the primary interface for non-developer admins to:
 * - Check system health at a glance
 * - Investigate errors and failures
 * - Test critical flows (geocoding, email)
 * - Monitor key operational metrics
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminHealthPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // Tab navigation
  const [activeTab, setActiveTab] = useState('overview');

  // Global controls
  const [timeRange, setTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Data from APIs
  const [healthSummary, setHealthSummary] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [errors, setErrors] = useState(null);

  // Loading & error states
  const [loading, setLoading] = useState({
    summary: false,
    metrics: false,
    errors: false
  });
  const [apiErrors, setApiErrors] = useState({});

  // ============================================================================
  // AUTHENTICATION CHECK
  // ============================================================================

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [session, router]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchHealthSummary = useCallback(async () => {
    setLoading(prev => ({ ...prev, summary: true }));
    setApiErrors(prev => ({ ...prev, summary: null }));

    try {
      const res = await fetch('/api/admin/health/summary');

      if (!res.ok) {
        throw new Error('Failed to fetch health summary');
      }

      const data = await res.json();
      setHealthSummary(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching health summary:', error);
      setApiErrors(prev => ({ ...prev, summary: error.message }));
    } finally {
      setLoading(prev => ({ ...prev, summary: false }));
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    setLoading(prev => ({ ...prev, metrics: true }));
    setApiErrors(prev => ({ ...prev, metrics: null }));

    try {
      const res = await fetch('/api/admin/health/metrics');

      if (!res.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await res.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setApiErrors(prev => ({ ...prev, metrics: error.message }));
    } finally {
      setLoading(prev => ({ ...prev, metrics: false }));
    }
  }, []);

  const fetchErrors = useCallback(async () => {
    setLoading(prev => ({ ...prev, errors: true }));
    setApiErrors(prev => ({ ...prev, errors: null }));

    try {
      // Calculate since timestamp based on time range
      const now = Date.now();
      const sinceMs = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      }[timeRange];

      const since = new Date(now - sinceMs).toISOString();
      const res = await fetch(`/api/admin/health/errors?since=${since}&limit=100`);

      if (!res.ok) {
        throw new Error('Failed to fetch errors');
      }

      const data = await res.json();
      setErrors(data);
    } catch (error) {
      console.error('Error fetching errors:', error);
      setApiErrors(prev => ({ ...prev, errors: error.message }));
    } finally {
      setLoading(prev => ({ ...prev, errors: false }));
    }
  }, [timeRange]);

  const refreshAll = useCallback(() => {
    fetchHealthSummary();
    fetchMetrics();
    fetchErrors();
  }, [fetchHealthSummary, fetchMetrics, fetchErrors]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initial data load
  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      refreshAll();
    }
  }, [session, refreshAll]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshAll();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  // Refetch errors when time range changes
  useEffect(() => {
    if (session?.user?.role === 'ADMIN' && activeTab === 'errors') {
      fetchErrors();
    }
  }, [timeRange, session, activeTab, fetchErrors]);

  // ============================================================================
  // EARLY RETURNS
  // ============================================================================

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (session.user.role !== 'ADMIN') {
    return null; // Will redirect via useEffect
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER: Mission Control Strip */}
      <AdminHealthHeader
        overallStatus={healthSummary?.overall_status || 'unknown'}
        lastUpdated={lastUpdated}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        onRefreshAll={refreshAll}
        envName={process.env.NEXT_PUBLIC_ENV_NAME || 'Development'}
      />

      {/* TABS */}
      <AdminHealthTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* PANEL CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewPanel
            healthSummary={healthSummary}
            metrics={metrics}
            loading={loading}
            errors={apiErrors}
            onRefresh={refreshAll}
          />
        )}

        {activeTab === 'errors' && (
          <ErrorsPanel
            errors={errors}
            loading={loading.errors}
            error={apiErrors.errors}
            timeRange={timeRange}
            onRefresh={fetchErrors}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsPanel
            adminEmail={session.user.email}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

function AdminHealthHeader({
  overallStatus,
  lastUpdated,
  timeRange,
  onTimeRangeChange,
  autoRefresh,
  onToggleAutoRefresh,
  onRefreshAll,
  envName
}) {
  const statusConfig = {
    healthy: { color: 'bg-green-100 text-green-800', label: 'Healthy' },
    degraded: { color: 'bg-amber-100 text-amber-800', label: 'Degraded' },
    unhealthy: { color: 'bg-red-100 text-red-800', label: 'Unhealthy' },
    unknown: { color: 'bg-gray-100 text-gray-800', label: 'Unknown' }
  };

  const status = statusConfig[overallStatus] || statusConfig.unknown;

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left: Title + Env + Status */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Admin Health Dashboard
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {envName}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Time Range */}
            <select
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              className="text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
            </select>

            {/* Auto-refresh Toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={onToggleAutoRefresh}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Auto-refresh (30s)</span>
            </label>

            {/* Last Updated */}
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}

            {/* Refresh Button */}
            <button
              onClick={onRefreshAll}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Refresh All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TABS COMPONENT
// ============================================================================

function AdminHealthTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'errors', label: 'Errors' },
    { id: 'tools', label: 'Tools' }
  ];

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

// ============================================================================
// OVERVIEW PANEL
// ============================================================================

function OverviewPanel({ healthSummary, metrics, loading, errors, onRefresh }) {
  // Compute system snapshot message
  const getSystemMessage = () => {
    if (!healthSummary) return null;

    const { overall_status, services = [] } = healthSummary;
    const unhealthyServices = services.filter(s => s.status !== 'healthy');

    if (overall_status === 'healthy') {
      return {
        type: 'success',
        message: 'All core services operational. No major incidents detected.',
        action: null
      };
    }

    if (unhealthyServices.length > 0) {
      const service = unhealthyServices[0];
      return {
        type: 'warning',
        message: `${service.service} is ${service.status}. Some functionality may be affected.`,
        action: service.status === 'not_configured'
          ? 'Configure environment variables in deployment settings.'
          : 'Check Errors tab for details.'
      };
    }

    return {
      type: 'warning',
      message: 'System status degraded. Check service details below.',
      action: 'Review service health cards and error logs.'
    };
  };

  const systemSnapshot = getSystemMessage();

  if (loading.summary && !healthSummary) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading health data...</div>
      </div>
    );
  }

  if (errors.summary) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-medium mb-2">Failed to load health data</h3>
        <p className="text-red-700 text-sm mb-4">{errors.summary}</p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Snapshot Bar */}
      {systemSnapshot && (
        <SystemSnapshotBar snapshot={systemSnapshot} />
      )}

      {/* Service Health Grid */}
      {healthSummary?.services && (
        <ServiceHealthGrid services={healthSummary.services} />
      )}

      {/* Metrics Grid */}
      {metrics?.metrics && (
        <MetricsGrid metrics={metrics.metrics} />
      )}
    </div>
  );
}

function SystemSnapshotBar({ snapshot }) {
  const bgColor = {
    success: 'bg-green-50 border-green-200',
    warning: 'bg-amber-50 border-amber-200',
    error: 'bg-red-50 border-red-200'
  }[snapshot.type];

  const textColor = {
    success: 'text-green-800',
    warning: 'text-amber-800',
    error: 'text-red-800'
  }[snapshot.type];

  return (
    <div className={`border rounded-lg p-6 ${bgColor}`}>
      <p className={`text-lg font-medium ${textColor} mb-2`}>
        {snapshot.message}
      </p>
      {snapshot.action && (
        <p className={`text-sm ${textColor} opacity-90`}>
          → {snapshot.action}
        </p>
      )}
    </div>
  );
}

function ServiceHealthGrid({ services }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Health</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map(service => (
          <ServiceHealthCard key={service.service} service={service} />
        ))}
      </div>
    </div>
  );
}

function ServiceHealthCard({ service }) {
  const statusConfig = {
    healthy: { color: 'bg-green-100 text-green-800', icon: '✓' },
    degraded: { color: 'bg-amber-100 text-amber-800', icon: '⚠' },
    unhealthy: { color: 'bg-red-100 text-red-800', icon: '✗' },
    not_configured: { color: 'bg-gray-100 text-gray-800', icon: '○' }
  };

  const status = statusConfig[service.status] || statusConfig.unhealthy;
  const serviceName = service.service.charAt(0).toUpperCase() + service.service.slice(1);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-gray-900">{serviceName}</h3>
        <span className={`text-xs px-2 py-1 rounded font-medium ${status.color}`}>
          {status.icon} {service.status}
        </span>
      </div>

      {service.response_time_ms !== undefined && (
        <div className="text-sm text-gray-600 mb-1">
          Latency: {service.response_time_ms}ms
        </div>
      )}

      {service.details && Object.keys(service.details).length > 0 && (
        <div className="text-xs text-gray-500 mt-2 space-y-1">
          {service.details.message && (
            <div>{service.details.message}</div>
          )}
          {service.details.resolved_city && service.details.resolved_state && (
            <div>Test: {service.details.resolved_city}, {service.details.resolved_state}</div>
          )}
          {service.details.user && (
            <div>User: {service.details.user}</div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricsGrid({ metrics }) {
  const metricCards = [
    { label: 'Total Users', value: metrics.users_total, key: 'users' },
    { label: 'Total Cities', value: metrics.cities_total, key: 'cities' },
    { label: 'Total Rescue Squads', value: metrics.rescue_squads_total, key: 'squads' },
    { label: 'Active Squads', value: metrics.rescue_squads_active, key: 'active_squads' },
    { label: 'Squad Members', value: metrics.squad_members_total, key: 'members' },
    { label: 'Active Members', value: metrics.squad_members_active, key: 'active_members' }
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricCards.map(metric => (
          <MetricCard key={metric.key} label={metric.label} value={metric.value} />
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-2xl font-bold text-gray-900 mb-1">
        {value !== undefined ? value.toLocaleString() : '—'}
      </div>
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-xs text-gray-400 mt-1">Updated now</div>
    </div>
  );
}

// ============================================================================
// ERRORS PANEL
// ============================================================================

function ErrorsPanel({ errors, loading, error, timeRange, onRefresh }) {
  const [selectedError, setSelectedError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (loading && !errors) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading error data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-medium mb-2">Failed to load error data</h3>
        <p className="text-red-700 text-sm mb-4">{error}</p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Filter errors by search query
  const filteredErrors = errors?.errors?.filter(err => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      err.event_type.toLowerCase().includes(query) ||
      err.error_code.toLowerCase().includes(query)
    );
  }) || [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by event type or error code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-gray-600">
            Time range: {timeRange === '1h' ? 'Last hour' : timeRange === '24h' ? 'Last 24 hours' : 'Last 7 days'}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredErrors.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <div className="text-lg font-medium text-gray-900 mb-2">
            No failures in the selected time range
          </div>
          <div className="text-sm text-gray-600">
            {searchQuery ? 'Try adjusting your search query.' : 'System is running smoothly!'}
          </div>
        </div>
      )}

      {/* Errors Table */}
      {filteredErrors.length > 0 && (
        <ErrorsTable
          errors={filteredErrors}
          onSelectError={setSelectedError}
          selectedError={selectedError}
        />
      )}

      {/* Error Details Drawer */}
      {selectedError && (
        <ErrorDetailsDrawer
          error={selectedError}
          onClose={() => setSelectedError(null)}
        />
      )}
    </div>
  );
}

function ErrorsTable({ errors, onSelectError, selectedError }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Event Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Error Code
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Count
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Seen
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {errors.map((error, idx) => (
            <tr
              key={idx}
              onClick={() => onSelectError(error)}
              className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedError === error ? 'bg-blue-50' : ''
              }`}
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {error.event_type}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  {error.error_code}
                </code>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                {error.count}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {new Date(error.last_seen_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorDetailsDrawer({ error, onClose }) {
  const [samples, setSamples] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSamples, setExpandedSamples] = useState(new Set());

  useEffect(() => {
    const fetchSamples = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/health/errors/${encodeURIComponent(error.event_type)}/${encodeURIComponent(error.error_code)}/samples?limit=10`
        );

        if (res.ok) {
          const data = await res.json();
          setSamples(data);
        }
      } catch (err) {
        console.error('Failed to fetch samples:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSamples();
  }, [error]);

  const toggleExpanded = (id) => {
    const newSet = new Set(expandedSamples);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedSamples(newSet);
  };

  const copyIncidentSummary = () => {
    const summary = `
We're seeing ${error.count} errors of type ${error.event_type}/${error.error_code} since ${new Date(error.last_seen_at).toLocaleString()}.

Example correlation ID: ${samples?.samples?.[0]?.correlation_id || 'N/A'}
Resource type: ${samples?.samples?.[0]?.resource_type || 'N/A'}
Error message: ${samples?.samples?.[0]?.error_message || 'N/A'}

This appears to be affecting users when they attempt to ${error.event_type.split('.')[1] || 'perform an action'}.
    `.trim();

    navigator.clipboard.writeText(summary);
    alert('Incident summary copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              {error.event_type}
            </h2>
            <div className="flex items-center gap-2">
              <code className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                {error.error_code}
              </code>
              <span className="text-sm text-gray-600">
                {error.count} occurrences
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading samples...</div>
          ) : (
            <div className="space-y-6">
              {/* Dev Handoff Block */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Developer Handoff</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Copy this summary to share with developers:
                </p>
                <button
                  onClick={copyIncidentSummary}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  Copy Incident Summary
                </button>
              </div>

              {/* Sample Events */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">
                  Sample Events ({samples?.count || 0})
                </h3>
                <div className="space-y-3">
                  {samples?.samples?.map((sample) => (
                    <div
                      key={sample.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-sm text-gray-600">
                          {new Date(sample.timestamp).toLocaleString()}
                        </div>
                        <button
                          onClick={() => toggleExpanded(sample.id)}
                          className="text-blue-600 text-sm hover:text-blue-800"
                        >
                          {expandedSamples.has(sample.id) ? 'Collapse' : 'Expand'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Correlation ID:</span>
                          <code className="ml-2 text-xs bg-gray-100 px-1 py-0.5 rounded">
                            {sample.correlation_id}
                          </code>
                        </div>
                        <div>
                          <span className="text-gray-600">Actor:</span>
                          <span className="ml-2">{sample.actor_user_id || 'anonymous'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Resource:</span>
                          <span className="ml-2">{sample.resource_type}:{sample.resource_id || 'null'}</span>
                        </div>
                      </div>

                      {sample.error_message && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-600">Error:</span>
                          <div className="mt-1 text-red-700 bg-red-50 p-2 rounded">
                            {sample.error_message}
                          </div>
                        </div>
                      )}

                      {expandedSamples.has(sample.id) && sample.metadata && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-600 mb-1">Metadata:</div>
                          <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(sample.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            💡 If this error affects user signups or case creation, escalate to dev within 15 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TOOLS PANEL
// ============================================================================

function ToolsPanel({ adminEmail }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <TestGeocodeCard />
      <TestEmailCard adminEmail={adminEmail} />
    </div>
  );
}

function TestGeocodeCard() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    if (!query.trim()) {
      alert('Please enter a ZIP code or city name');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/health/test-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() })
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Test Geocoding</h2>
      <p className="text-sm text-gray-600 mb-4">
        Verify that ZIP and city resolution is working as expected.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Query
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && runTest()}
            placeholder="e.g. 78701 or Austin, TX"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Note: City queries not yet supported — use 5-digit ZIP code.
          </p>
        </div>

        <button
          onClick={runTest}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Running test...' : 'Run Test'}
        </button>

        {/* Result */}
        {result && (
          <div className={`border rounded-lg p-4 ${
            result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            {result.success ? (
              <div className="space-y-2">
                <div className="text-green-800 font-medium">✅ Test Successful</div>
                <div className="text-sm space-y-1 text-green-800">
                  <div><strong>Resolved City:</strong> {result.result.city}, {result.result.state}</div>
                  <div><strong>ZIP:</strong> {result.result.zipCode}</div>
                  {result.result.latitude && (
                    <div><strong>Coordinates:</strong> {result.result.latitude}, {result.result.longitude}</div>
                  )}
                  <div><strong>Method:</strong> {result.method}</div>
                  <div><strong>Response time:</strong> {result.response_time_ms}ms</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-red-800 font-medium">❌ Test Failed</div>
                <div className="text-sm text-red-700">
                  {result.result?.message || result.result?.error || result.error || 'Unknown error'}
                </div>
                <div className="text-xs text-red-600 mt-2">
                  If this fails for valid ZIP codes, case creation or squad operations may be affected.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TestEmailCard({ adminEmail }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const sendTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/health/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Test Email</h2>
      <p className="text-sm text-gray-600 mb-4">
        Send a test email to your own address to verify email systems are configured and working.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recipient
          </label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
            {adminEmail || 'No email configured'}
          </div>
        </div>

        <button
          onClick={sendTest}
          disabled={loading || !adminEmail}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Sending...' : 'Send Test Email'}
        </button>

        {/* Result */}
        {result && (
          <div className={`border rounded-lg p-4 ${
            result.success ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
          }`}>
            {result.success ? (
              <div className="space-y-2">
                <div className="text-green-800 font-medium">✅ Test Email Sent!</div>
                <div className="text-sm text-green-700">
                  Check your inbox (and spam) at <strong>{result.recipient}</strong>.
                </div>
                <div className="text-xs text-green-600 mt-2">
                  Response time: {result.response_time_ms}ms
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-amber-800 font-medium">
                  {result.error === 'Email service not configured' ? '⚠️' : '❌'} {result.error}
                </div>
                <div className="text-sm text-amber-700">
                  {result.message}
                </div>
                {result.details && (
                  <div className="text-xs text-amber-600 mt-2 space-y-1">
                    <div>Service: {result.details.email_service}</div>
                    <div>EMAIL_USER: {result.details.email_user_set ? '✓ Set' : '✗ Missing'}</div>
                    <div>EMAIL_PASSWORD: {result.details.email_password_set ? '✓ Set' : '✗ Missing'}</div>
                  </div>
                )}
                <div className="text-xs text-amber-600 mt-2">
                  If test email fails, user notifications and password resets may not work.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
