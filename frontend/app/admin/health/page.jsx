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
import { isAdmin } from '@/app/lib/permissions';

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
    if (session && !isAdmin(session)) {
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

  if (!isAdmin(session)) {
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
            onSwitchToErrors={() => setActiveTab('errors')}
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
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                Admin Health Dashboard
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold">
                  🔒 ADMIN ONLY
                </span>
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
  // Derive smart snapshot with impact + next steps (Refinement 2.1)
  const deriveSnapshotHint = () => {
    if (!healthSummary) return null;

    const { overall_status, services = [] } = healthSummary;
    const db = services.find(s => s.service === 'database');
    const geocoding = services.find(s => s.service === 'geocoding');
    const email = services.find(s => s.service === 'email');

    // Critical: Database unhealthy
    if (db?.status === 'unhealthy') {
      return {
        severity: 'critical',
        headline: 'Database is failing health checks.',
        impact: 'All users may be affected. No operations will succeed.',
        suggestedNextStep: 'Check infrastructure status and contact dev on-call immediately.',
        type: 'error'
      };
    }

    // Warning: Geocoding degraded
    if (geocoding?.status === 'unhealthy' || geocoding?.status === 'degraded') {
      return {
        severity: 'warning',
        headline: 'Geocoding service is degraded.',
        impact: 'New cases and rescue force creation may fail for some locations.',
        suggestedNextStep: 'Try "Test Geocoding" in Tools tab, then review related errors.',
        type: 'warning'
      };
    }

    // Info: Email not configured
    if (email?.status === 'not_configured') {
      return {
        severity: 'info',
        headline: 'Email service is not configured.',
        impact: 'Notifications and password resets will not work.',
        suggestedNextStep: 'Set EMAIL_USER and EMAIL_PASSWORD environment variables in deployment settings.',
        type: 'warning'
      };
    }

    // Warning: Email unhealthy but configured
    if (email?.status === 'unhealthy') {
      return {
        severity: 'warning',
        headline: 'Email service is failing.',
        impact: 'User notifications and password resets may not be sent.',
        suggestedNextStep: 'Try "Test Email" in Tools tab, then check Errors for email failures.',
        type: 'warning'
      };
    }

    // Success: All healthy
    if (overall_status === 'healthy') {
      return {
        severity: 'info',
        headline: 'All core services operational.',
        impact: 'No major incidents detected in the last 24 hours.',
        suggestedNextStep: null,
        type: 'success'
      };
    }

    // Fallback
    return {
      severity: 'warning',
      headline: 'System status degraded.',
      impact: 'Some services may not be functioning correctly.',
      suggestedNextStep: 'Review service health cards and error logs below.',
      type: 'warning'
    };
  };

  const systemSnapshot = deriveSnapshotHint();

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

  const severityIcon = {
    critical: '🔴',
    warning: '🟠',
    info: '🟢'
  }[snapshot.severity] || '⚪';

  return (
    <div className={`border rounded-lg p-6 ${bgColor}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{severityIcon}</span>
        <div className="flex-1">
          <p className={`text-lg font-semibold ${textColor} mb-1`}>
            {snapshot.headline}
          </p>
          <p className={`text-sm ${textColor} opacity-90 mb-2`}>
            <strong>Impact:</strong> {snapshot.impact}
          </p>
          {snapshot.suggestedNextStep && (
            <p className={`text-sm ${textColor} opacity-90`}>
              <strong>Next step:</strong> {snapshot.suggestedNextStep}
            </p>
          )}
        </div>
      </div>
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
    { label: 'Total Rescue Forces', value: metrics.rescue_squads_total, key: 'squads' },
    { label: 'Active Squads', value: metrics.rescue_squads_active, key: 'active_squads' },
    { label: 'Squad Members', value: metrics.squad_members_total, key: 'members' },
    { label: 'Active Members', value: metrics.squad_members_active, key: 'active_members' },
    { label: 'Total Cases', value: metrics.cases_total, key: 'missions', highlight: true },
    { label: 'Open Cases', value: metrics.cases_open, key: 'cases_open', highlight: true },
    { label: 'Active Search', value: metrics.cases_active_search, key: 'cases_active', highlight: true }
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

// Error impact mapping (Refinement 2.2)
const ERROR_IMPACT = {
  // High severity - affects user signups, core flows
  'squad.create_failed': { label: 'Squad Creation', severity: 'high' },
  'squad.join_failed': { label: 'Squad Signups', severity: 'high' },
  'user.signup_failed': { label: 'User Signups', severity: 'high' },
  'case.create_failed': { label: 'Case Creation', severity: 'high' },

  // Medium severity - affects functionality but not critical paths
  'squad.search_failed': { label: 'Squad Search', severity: 'medium' },
  'squad.detail_failed': { label: 'Squad Details', severity: 'medium' },
  'case.status_change_failed': { label: 'Case Updates', severity: 'medium' },
  'case.note_add_failed': { label: 'Case Notes', severity: 'medium' },
  'geocoding.failed': { label: 'Location Data', severity: 'medium' },
  'city.resolution_failed': { label: 'City Resolution', severity: 'medium' },
  'notification.send_failed': { label: 'Notifications', severity: 'medium' },
  'email.send_failed': { label: 'Email Delivery', severity: 'medium' },
  'auth.permission_denied': { label: 'Permission Check', severity: 'medium' },

  // Low severity - admin tools, non-critical features
  'squad.leave_failed': { label: 'Squad Management', severity: 'low' },
  'admin.test_geocode_run': { label: 'Admin Tools', severity: 'low' },
  'admin.test_email_sent': { label: 'Admin Tools', severity: 'low' },
  'qa.test_executed': { label: 'QA Tests', severity: 'low' },
  'qa.test_data_generated': { label: 'QA Data Gen', severity: 'low' },

  // Public Case Portal (Phase 15-16)
  'public_case.report_failed': { label: 'Public Reports', severity: 'high' },
  'public_case.list_failed': { label: 'Public Case List', severity: 'medium' },
  'public_case.detail_failed': { label: 'Public Case Detail', severity: 'medium' },
  'public_case.report_submitted': { label: 'Public Reports', severity: 'low' },
  'public_case.list_viewed': { label: 'Public Case List', severity: 'low' },
  'public_case.detail_viewed': { label: 'Public Case Detail', severity: 'low' },
  'public_case.report_attempted': { label: 'Public Reports', severity: 'low' },

  // Notifications (Phase 25-26)
  'notification.send_attempted': { label: 'Notifications', severity: 'low' },
  'notification.send_succeeded': { label: 'Notifications', severity: 'low' },
  // Note: notification.send_failed already defined above in medium severity

  // Permissions & Assignments (Phase 22-24)
  'case.assignment_changed': { label: 'Case Assignment', severity: 'low' },
};

function getErrorImpact(eventType) {
  // Check exact match first
  if (ERROR_IMPACT[eventType]) {
    return ERROR_IMPACT[eventType];
  }

  // Check by prefix (e.g., "squad.*" → Squad Operations)
  const prefix = eventType.split('.')[0];
  const prefixMap = {
    'squad': { label: 'Squad Operations', severity: 'medium' },
    'user': { label: 'User Operations', severity: 'medium' },
    'mission': { label: 'Case Operations', severity: 'medium' },
    'admin': { label: 'Admin Operations', severity: 'low' },
    'system': { label: 'System Operations', severity: 'medium' }
  };

  return prefixMap[prefix] || { label: 'Unknown', severity: 'medium' };
}

function ErrorsPanel({ errors, loading, error, timeRange, onRefresh }) {
  const [selectedError, setSelectedError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Compute recency (Refinement 2.2)
  const getRecencyInfo = () => {
    if (!errors?.errors || errors.errors.length === 0) {
      return null;
    }

    const mostRecentError = errors.errors.reduce((latest, err) => {
      const errTime = new Date(err.last_seen_at).getTime();
      const latestTime = new Date(latest.last_seen_at).getTime();
      return errTime > latestTime ? err : latest;
    });

    const minutesAgo = Math.floor((Date.now() - new Date(mostRecentError.last_seen_at).getTime()) / 60000);

    if (minutesAgo < 1) return 'Last failure: just now';
    if (minutesAgo < 60) return `Last failure: ${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;

    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `Last failure: ${hoursAgo} hour${hoursAgo === 1 ? '' : 's'} ago`;

    const daysAgo = Math.floor(hoursAgo / 24);
    return `Last failure: ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
  };

  const recencyInfo = getRecencyInfo();

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
      {/* Filters + Recency */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap justify-between">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by event type or error code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Time range: {timeRange === '1h' ? 'Last hour' : timeRange === '24h' ? 'Last 24 hours' : 'Last 7 days'}
            </div>
            {recencyInfo && (
              <div className="text-sm font-medium text-red-600">
                {recencyInfo}
              </div>
            )}
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
              Impact
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
          {errors.map((error, idx) => {
            const impact = getErrorImpact(error.event_type);
            const impactColor = {
              high: 'bg-red-100 text-red-800',
              medium: 'bg-amber-100 text-amber-800',
              low: 'bg-gray-100 text-gray-700'
            }[impact.severity];
            const impactIcon = {
              high: '🔴',
              medium: '🟠',
              low: '⚪'
            }[impact.severity];

            return (
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
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${impactColor}`}>
                    <span>{impactIcon}</span>
                    <span>{impact.label}</span>
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                  {error.count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {new Date(error.last_seen_at).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ErrorDetailsDrawer({ error, onClose }) {
  const [samples, setSamples] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSamples, setExpandedSamples] = useState(new Set());
  const [copiedMessage, setCopiedMessage] = useState(false);

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
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
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
                  className={`px-4 py-2 text-white text-sm rounded transition-colors ${
                    copiedMessage ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {copiedMessage ? '✓ Copied!' : 'Copy Incident Summary'}
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

function ToolsPanel({ adminEmail, onSwitchToErrors }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <TestGeocodeCard onSwitchToErrors={onSwitchToErrors} />
      <TestEmailCard adminEmail={adminEmail} onSwitchToErrors={onSwitchToErrors} />
    </div>
  );
}

function TestGeocodeCard({ onSwitchToErrors }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testHistory, setTestHistory] = useState([]); // Refinement 2.3
  const [validationError, setValidationError] = useState(null);

  const runTest = async () => {
    if (!query.trim()) {
      setValidationError('Please enter a ZIP code or city name');
      return;
    }
    setValidationError(null);

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

      // Add to history (Refinement 2.3)
      const historyEntry = {
        query: query.trim(),
        success: data.success,
        method: data.method,
        city: data.result?.city,
        state: data.result?.state,
        timestamp: new Date()
      };
      setTestHistory(prev => [historyEntry, ...prev.slice(0, 4)]); // Keep last 5
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message
      };
      setResult(errorResult);

      // Add error to history too
      setTestHistory(prev => [{
        query: query.trim(),
        success: false,
        error: error.message,
        timestamp: new Date()
      }, ...prev.slice(0, 4)]);
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
          {validationError && (
            <p className="text-sm text-red-600 mt-1">{validationError}</p>
          )}
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
                  If this fails for valid ZIP codes, case creation or force operations may be affected.
                </div>
                {/* Jump to Errors (Refinement 2.3) */}
                {!result.success && onSwitchToErrors && (
                  <button
                    onClick={onSwitchToErrors}
                    className="mt-3 text-sm text-red-700 hover:text-red-900 underline"
                  >
                    → View geocoding errors
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Test History (Refinement 2.3) */}
        {testHistory.length > 0 && (
          <div className="border-t pt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Recent Tests</div>
            <div className="space-y-1">
              {testHistory.map((test, idx) => (
                <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                  <span>{test.success ? '✅' : '❌'}</span>
                  <span className="font-medium">{test.query}</span>
                  <span>→</span>
                  <span>
                    {test.success
                      ? `${test.city}, ${test.state} (${test.method})`
                      : 'failed'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TestEmailCard({ adminEmail, onSwitchToErrors }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testHistory, setTestHistory] = useState([]); // Refinement 2.3

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

      // Add to history (Refinement 2.3)
      setTestHistory(prev => [{
        success: data.success,
        recipient: data.recipient || adminEmail,
        error: data.error,
        timestamp: new Date()
      }, ...prev.slice(0, 4)]); // Keep last 5
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message
      };
      setResult(errorResult);

      // Add error to history
      setTestHistory(prev => [{
        success: false,
        error: error.message,
        timestamp: new Date()
      }, ...prev.slice(0, 4)]);
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
                {/* Jump to Errors (Refinement 2.3) */}
                {!result.success && result.error !== 'Email service not configured' && onSwitchToErrors && (
                  <button
                    onClick={onSwitchToErrors}
                    className="mt-3 text-sm text-amber-700 hover:text-amber-900 underline"
                  >
                    → View email errors
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Test History (Refinement 2.3) */}
        {testHistory.length > 0 && (
          <div className="border-t pt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Recent Tests</div>
            <div className="space-y-1">
              {testHistory.map((test, idx) => (
                <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                  <span>{test.success ? '✅' : '❌'}</span>
                  <span>
                    {test.success
                      ? `Sent to ${test.recipient}`
                      : test.error === 'Email service not configured'
                      ? 'Not configured'
                      : 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
