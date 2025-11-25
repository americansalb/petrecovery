'use client';

/**
 * Admin QA Harness - Browser-Based Testing & Data Generation
 * Phase 20-21 Implementation
 *
 * This page provides admins with tools to:
 * - Run smoke tests against key platform features (Legal, Squad, Case)
 * - Generate test data without shell access
 * - Verify functionality in deployed environments (Render, Vercel, etc.)
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminQAPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // Tab navigation
  const [activeTab, setActiveTab] = useState('tests');

  // Test results tracking
  const [testResults, setTestResults] = useState([]);
  const [lastTestRun, setLastTestRun] = useState(null);

  // ============================================================================
  // AUTHENTICATION CHECK
  // ============================================================================

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [session, router]);

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
      {/* HEADER: QA Harness Control Strip */}
      <AdminQAHeader
        lastTestRun={lastTestRun}
        totalResults={testResults.length}
        envName={process.env.NEXT_PUBLIC_ENV_NAME || 'Development'}
      />

      {/* TABS */}
      <AdminQATabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* PANEL CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'tests' && (
          <TestsPanel
            onTestComplete={(result) => {
              setTestResults(prev => [...prev, result]);
              setLastTestRun(new Date());
            }}
          />
        )}

        {activeTab === 'generators' && (
          <GeneratorsPanel
            onDataGenerated={(result) => {
              setTestResults(prev => [...prev, result]);
              setLastTestRun(new Date());
            }}
          />
        )}

        {activeTab === 'results' && (
          <ResultsPanel
            results={testResults}
            onClearResults={() => setTestResults([])}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

function AdminQAHeader({ lastTestRun, totalResults, envName }) {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left: Title + Env */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Admin QA Harness
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {envName}
                </span>
                <span className="text-xs text-gray-500">
                  Browser-based testing & data generation
                </span>
              </div>
            </div>
          </div>

          {/* Right: Status Info */}
          <div className="flex items-center gap-4 flex-wrap">
            {lastTestRun && (
              <span className="text-xs text-gray-500">
                Last test: {lastTestRun.toLocaleTimeString()}
              </span>
            )}
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
              {totalResults} test{totalResults !== 1 ? 's' : ''} run
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TABS COMPONENT
// ============================================================================

function AdminQATabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'tests', label: 'Tests', description: 'Run smoke tests' },
    { id: 'generators', label: 'Generators', description: 'Create test data' },
    { id: 'results', label: 'Results', description: 'View test history' }
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
// TESTS PANEL
// ============================================================================

function TestsPanel({ onTestComplete }) {
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🧪</span>
          <div>
            <h2 className="text-lg font-semibold text-blue-900 mb-1">
              Smoke Test Suites
            </h2>
            <p className="text-sm text-blue-800">
              These tests verify key platform features are working. Each test runs in real-time
              using existing APIs and displays pass/fail status. All test actions emit structured
              events visible in the Admin Health Dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder for test suites */}
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <div className="text-4xl mb-4">🚧</div>
        <div className="text-lg font-medium text-gray-900 mb-2">
          Test Suites Coming Soon
        </div>
        <div className="text-sm text-gray-600">
          Legal, Squad, and Case test suites will be implemented in TASK-Q02, Q03, and Q04.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// GENERATORS PANEL
// ============================================================================

function GeneratorsPanel({ onDataGenerated }) {
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🏗️</span>
          <div>
            <h2 className="text-lg font-semibold text-green-900 mb-1">
              Test Data Generators
            </h2>
            <p className="text-sm text-green-800">
              Generate realistic test data without shell scripts. All generated data is prefixed
              with [TEST] for easy identification and can be bulk-closed using the cleanup tool.
              Perfect for Render deployments without SSH access.
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder for generators */}
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <div className="text-4xl mb-4">🚧</div>
        <div className="text-lg font-medium text-gray-900 mb-2">
          Data Generators Coming Soon
        </div>
        <div className="text-sm text-gray-600">
          Squad and Case generators will be implemented in TASK-Q05.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RESULTS PANEL
// ============================================================================

function ResultsPanel({ results, onClearResults }) {
  if (results.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <div className="text-4xl mb-4">📊</div>
        <div className="text-lg font-medium text-gray-900 mb-2">
          No Test Results Yet
        </div>
        <div className="text-sm text-gray-600">
          Run tests or generate data from the other tabs to see results here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Clear Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Test Run History ({results.length})
        </h2>
        <button
          onClick={onClearResults}
          className="px-4 py-2 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50 transition-colors"
        >
          Clear All Results
        </button>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Test/Generator
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.map((result, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {result.timestamp?.toLocaleTimeString() || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {result.name || 'Unknown Test'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    result.status === 'pass'
                      ? 'bg-green-100 text-green-800'
                      : result.status === 'fail'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {result.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {result.details || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
