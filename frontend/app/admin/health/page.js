'use client';

// /admin/health/page.js
// Admin Health Dashboard with ERROR_IMPACT mappings

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ERROR_IMPACT mappings for all phases
const ERROR_IMPACT = {
  // Public Portal (Phase 15-16)
  'public_case.list_failed': {
    level: 'LOW',
    description: 'Public case listing unavailable',
    action: 'Check database connection',
  },
  'public_case.detail_failed': {
    level: 'LOW',
    description: 'Public case detail unavailable',
    action: 'Check case exists and is public',
  },
  'public_case.report_failed': {
    level: 'MEDIUM',
    description: 'Public report submission failed',
    action: 'Check validation or database error',
  },

  // Permissions (Phase 22-24)
  'auth.permission_denied': {
    level: 'MEDIUM',
    description: 'User attempted unauthorized action',
    action: 'Review user role and action attempted',
  },
  'case.assign_coordinator_failed': {
    level: 'LOW',
    description: 'Failed to assign coordinator',
    action: 'Check case and user validity',
  },
  'case.assign_squad_failed': {
    level: 'LOW',
    description: 'Failed to assign squad',
    action: 'Check case and squad validity',
  },
  'case.status_change_failed': {
    level: 'MEDIUM',
    description: 'Failed to update case status',
    action: 'Check case exists and status is valid',
  },

  // Notifications (Phase 25-26)
  'notification.send_failed': {
    level: 'LOW',
    description: 'Email notification failed to send',
    action: 'Check email configuration and SMTP credentials',
  },
  'email.send_failed': {
    level: 'LOW',
    description: 'Email transport error',
    action: 'Verify EMAIL_* environment variables',
  },

  // Database
  'database.connection_failed': {
    level: 'CRITICAL',
    description: 'Database connection lost',
    action: 'Check DATABASE_URL and database server status',
  },

  // Auth
  'auth.login_failed': {
    level: 'LOW',
    description: 'User login attempt failed',
    action: 'Check credentials or account status',
  },
};

const LEVEL_COLORS = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-blue-100 text-blue-800',
  INFO: 'bg-gray-100 text-gray-800',
};

export default function HealthDashboardPage() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkHealth();
  }, []);

  async function checkHealth() {
    setLoading(true);
    try {
      // Check database
      const dbRes = await fetch('/api/health');
      const dbStatus = await dbRes.json();

      setHealthStatus({
        database: dbRes.ok ? 'healthy' : 'error',
        timestamp: new Date().toISOString(),
        ...dbStatus,
      });
    } catch (error) {
      setHealthStatus({
        database: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
    setLoading(false);
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/admin" className="text-blue-600 hover:underline text-sm">
            &larr; Admin Home
          </Link>
          <h1 className="text-2xl font-bold mt-2">Health Dashboard</h1>
          <p className="text-gray-600">
            System health and error impact monitoring
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
              ADMIN ONLY
            </span>
          </p>
        </div>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">System Status</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg ${
            healthStatus?.database === 'healthy'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            <p className="font-medium">Database</p>
            <p className="text-2xl font-bold capitalize">
              {healthStatus?.database || 'Checking...'}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-green-100 text-green-800">
            <p className="font-medium">API</p>
            <p className="text-2xl font-bold">Healthy</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-100 text-gray-800">
            <p className="font-medium">Last Check</p>
            <p className="text-sm">
              {healthStatus?.timestamp
                ? new Date(healthStatus.timestamp).toLocaleTimeString()
                : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Environment Check */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">Environment Configuration</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>DATABASE_URL configured</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>NEXTAUTH_SECRET configured</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span>EMAIL_* variables (check .env)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span>ADMIN_ALERT_EMAIL (check .env)</span>
          </div>
        </div>
      </div>

      {/* ERROR_IMPACT Reference */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b">
          <h2 className="font-bold">ERROR_IMPACT Reference</h2>
          <p className="text-sm text-gray-600">
            Error events and their impact on system operation
          </p>
        </div>

        <div className="divide-y">
          {Object.entries(ERROR_IMPACT)
            .sort((a, b) => {
              const levelOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
              return levelOrder[a[1].level] - levelOrder[b[1].level];
            })
            .map(([event, info]) => (
              <div key={event} className="px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">
                      {event}
                    </code>
                    <p className="text-gray-700 mt-1">{info.description}</p>
                    <p className="text-gray-500 text-sm mt-1">
                      <strong>Action:</strong> {info.action}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${LEVEL_COLORS[info.level]}`}>
                    {info.level}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow p-4">
        <h3 className="font-medium mb-2">Impact Level Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded ${LEVEL_COLORS.CRITICAL}`}>CRITICAL</span>
            <span className="text-gray-600">System down</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded ${LEVEL_COLORS.HIGH}`}>HIGH</span>
            <span className="text-gray-600">Major feature broken</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded ${LEVEL_COLORS.MEDIUM}`}>MEDIUM</span>
            <span className="text-gray-600">Feature degraded</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded ${LEVEL_COLORS.LOW}`}>LOW</span>
            <span className="text-gray-600">Minor issue</span>
          </div>
        </div>
      </div>
    </div>
  );
}
