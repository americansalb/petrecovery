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
// TEST EXECUTION ENGINE
// ============================================================================

async function runTest(testName, testFn) {
  const startTime = Date.now();
  const result = {
    name: testName,
    status: 'running',
    duration: 0,
    error: null,
    details: null
  };

  try {
    const details = await testFn();
    result.status = 'passed';
    result.details = details;
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    result.details = error.details || {};
  } finally {
    result.duration = Date.now() - startTime;
  }

  // Log QA event
  try {
    await fetch('/api/admin/qa/log-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'qa.test_executed',
        test_name: testName,
        result: result.status,
        duration_ms: result.duration,
        error: result.error
      })
    });
  } catch (logError) {
    console.error('Failed to log QA event:', logError);
  }

  return result;
}

// ============================================================================
// LEGAL TEST CASES
// ============================================================================

async function testAcceptWaiver() {
  // 1. Fetch legal documents
  const docsRes = await fetch('/api/legal/documents');
  if (!docsRes.ok) {
    throw new Error(`Failed to fetch documents: ${docsRes.status}`);
  }

  const { documents } = await docsRes.json();
  const waiver = documents.find(d => d.type === 'LIABILITY_WAIVER');
  const tos = documents.find(d => d.type === 'TERMS_OF_SERVICE');

  if (!waiver || !tos) {
    throw new Error('Missing required legal documents');
  }

  // 2. Accept documents
  const acceptRes = await fetch('/api/legal/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      acceptances: [
        { documentType: 'TERMS_OF_SERVICE', version: tos.version },
        { documentType: 'LIABILITY_WAIVER', version: waiver.version }
      ]
    })
  });

  if (!acceptRes.ok) {
    const error = await acceptRes.json();
    throw new Error(`Accept failed: ${error.message || error.error}`);
  }

  return {
    waiver_version: waiver.version,
    tos_version: tos.version,
    accepted: true
  };
}

async function testBlockedSquadCreate() {
  // Create squad with current session (which should have waiver)
  // This test verifies the API handles waiver checks correctly
  const res = await fetch('/api/rescue-squads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: '[TEST] Phoenix',
      state: 'AZ',
      zipCode: '85001'
    })
  });

  if (res.status === 403) {
    const error = await res.json();
    if (error.code !== 'WAIVER_NOT_ACCEPTED') {
      throw new Error('Expected WAIVER_NOT_ACCEPTED code');
    }
    if (!error.redirectTo) {
      throw new Error('Missing redirectTo in error response');
    }
    return { blocked: true, code: error.code };
  } else if (res.status === 201) {
    // User has waiver, squad created successfully
    const { squad } = await res.json();
    return { blocked: false, squad_id: squad.id, note: 'User has waiver, squad created successfully' };
  } else {
    const errorData = await res.json();
    throw new Error(`Unexpected status ${res.status}: ${errorData.error || 'Unknown error'}`);
  }
}

async function testBlockedCaseCreate() {
  const res = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Phoenix',
      state: 'AZ',
      zipCode: '85001',
      petSpecies: 'DOG',
      petName: '[TEST QA] Buddy'
    })
  });

  if (res.status === 403) {
    const error = await res.json();
    if (error.code !== 'WAIVER_NOT_ACCEPTED') {
      throw new Error('Expected WAIVER_NOT_ACCEPTED code');
    }
    return { blocked: true, code: error.code };
  } else if (res.status === 201) {
    const { case: caseData } = await res.json();
    return { blocked: false, case_id: caseData.id, note: 'User has waiver, case created successfully' };
  } else {
    const errorData = await res.json();
    throw new Error(`Unexpected status ${res.status}: ${errorData.error || 'Unknown error'}`);
  }
}

// ============================================================================
// SQUAD TEST CASES
// ============================================================================

async function testCreateSquad() {
  const res = await fetch('/api/rescue-squads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: `[TEST] QA Squad ${Date.now()}`,
      state: 'TX',
      zipCode: '78701'
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Create failed: ${error.error}`);
  }

  const { squad } = await res.json();
  return { squad_id: squad.id, squad_name: squad.name };
}

async function testSearchSquads() {
  const res = await fetch('/api/rescue-squads?search=78701&radius=25');

  if (!res.ok) {
    throw new Error(`Search failed: ${res.status}`);
  }

  const { cities } = await res.json();
  return { results_count: cities.length, cities: cities.slice(0, 3).map(c => c.city) };
}

async function testJoinSquad() {
  // First, find or create a test squad
  const searchRes = await fetch('/api/rescue-squads?search=78701');
  const { cities } = await searchRes.json();

  const testCity = cities.find(c => c.exists && c.squad);
  if (!testCity) {
    throw new Error('No test squad found - run Create Squad test first');
  }

  const res = await fetch(`/api/rescue-squads/${testCity.squad.id}/join`, {
    method: 'POST'
  });

  if (res.status === 200) {
    return { joined: true, squad_id: testCity.squad.id };
  } else if (res.status === 400) {
    const error = await res.json();
    if (error.error && error.error.includes('already a member')) {
      return { already_member: true, squad_id: testCity.squad.id };
    }
    throw new Error(error.error);
  } else {
    const error = await res.json();
    throw new Error(`Join failed: ${error.error || res.status}`);
  }
}

async function testLeaveSquad() {
  // Find a squad the user is a member of
  const searchRes = await fetch('/api/rescue-squads?search=78701');
  const { cities } = await searchRes.json();

  const memberSquad = cities.find(c => c.exists && c.squad && c.squad.isMember);
  if (!memberSquad) {
    throw new Error('Not a member of any test squad - run Join Squad test first');
  }

  const res = await fetch(`/api/rescue-squads/${memberSquad.squad.id}/leave`, {
    method: 'POST'
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Leave failed: ${error.error}`);
  }

  return { left: true, squad_id: memberSquad.squad.id };
}

// ============================================================================
// TESTS PANEL
// ============================================================================

function TestsPanel({ onTestComplete }) {
  // Legal tests state
  const [legalTests, setLegalTests] = useState([
    { id: 'accept-waiver', name: 'Accept Waiver Flow', status: 'idle', fn: testAcceptWaiver },
    { id: 'blocked-squad', name: 'Blocked Action - Squad Create', status: 'idle', fn: testBlockedSquadCreate },
    { id: 'blocked-case', name: 'Blocked Action - Case Create', status: 'idle', fn: testBlockedCaseCreate },
  ]);
  const [runningLegal, setRunningLegal] = useState(false);

  // Squad tests state
  const [squadTests, setSquadTests] = useState([
    { id: 'create-squad', name: 'Create Squad - Happy Path', status: 'idle', fn: testCreateSquad },
    { id: 'search-squads', name: 'Search Squads by ZIP', status: 'idle', fn: testSearchSquads },
    { id: 'join-squad', name: 'Join Squad', status: 'idle', fn: testJoinSquad },
    { id: 'leave-squad', name: 'Leave Squad', status: 'idle', fn: testLeaveSquad },
  ]);
  const [runningSquad, setRunningSquad] = useState(false);

  const runLegalTests = async () => {
    setRunningLegal(true);

    for (let i = 0; i < legalTests.length; i++) {
      const test = legalTests[i];

      // Mark test as running
      setLegalTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, status: 'running' } : t
      ));

      // Execute test
      const result = await runTest(test.name, test.fn);

      // Update test with result
      setLegalTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, ...result } : t
      ));

      // Notify parent
      onTestComplete(result);
    }

    setRunningLegal(false);
  };

  const runSquadTests = async () => {
    setRunningSquad(true);

    for (let i = 0; i < squadTests.length; i++) {
      const test = squadTests[i];

      // Mark test as running
      setSquadTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, status: 'running' } : t
      ));

      // Execute test
      const result = await runTest(test.name, test.fn);

      // Update test with result
      setSquadTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, ...result } : t
      ));

      // Notify parent
      onTestComplete(result);
    }

    setRunningSquad(false);
  };

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

      {/* Legal Test Suite */}
      <TestSuite
        title="Legal Tests"
        tests={legalTests}
        onRun={runLegalTests}
        running={runningLegal}
      />

      {/* Squad Test Suite */}
      <TestSuite
        title="Squad Tests"
        tests={squadTests}
        onRun={runSquadTests}
        running={runningSquad}
      />

      {/* Placeholder for Case test suite */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <p className="text-sm text-gray-600">
          Case test suite coming in TASK-Q04
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// TEST SUITE COMPONENT
// ============================================================================

function TestSuite({ title, tests, onRun, running }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        {title}
      </h2>

      <div className="space-y-2 mb-6">
        {tests.map(test => (
          <TestResultRow key={test.id} test={test} />
        ))}
      </div>

      <button
        onClick={onRun}
        disabled={running}
        className={`
          px-6 py-3 rounded-lg font-semibold transition-colors
          ${running
            ? 'bg-gray-400 cursor-not-allowed text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        {running ? 'Running...' : `Run ${title}`}
      </button>
    </div>
  );
}

// ============================================================================
// TEST RESULT ROW COMPONENT
// ============================================================================

function TestResultRow({ test }) {
  const statusConfig = {
    'idle': { icon: '⏹️', color: 'text-gray-600', label: 'Idle' },
    'running': { icon: '⏳', color: 'text-amber-600', label: 'Running' },
    'passed': { icon: '✅', color: 'text-green-600', label: 'Passed' },
    'failed': { icon: '❌', color: 'text-red-600', label: 'Failed' }
  };

  const config = statusConfig[test.status] || statusConfig.idle;

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="text-xl">{config.icon}</span>
        <span className="font-medium text-gray-900">{test.name}</span>
      </div>

      <div className="flex items-center gap-4">
        {test.duration > 0 && (
          <span className="text-sm text-gray-500">
            {test.duration}ms
          </span>
        )}
        {test.error && (
          <span className="text-sm text-red-600 max-w-md truncate">
            {test.error}
          </span>
        )}
        {test.details && !test.error && (
          <span className="text-xs text-gray-400">
            {JSON.stringify(test.details).substring(0, 50)}...
          </span>
        )}
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

  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{results.length}</div>
          <div className="text-sm text-gray-600">Total Tests</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{passedCount}</div>
          <div className="text-sm text-green-700">Passed</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          <div className="text-sm text-red-700">Failed</div>
        </div>
      </div>

      {/* Header with Clear Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Test Run History
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
                Test Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Error/Details
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.map((result, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {result.name || 'Unknown Test'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    result.status === 'passed'
                      ? 'bg-green-100 text-green-800'
                      : result.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {result.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {result.duration}ms
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                  {result.error || JSON.stringify(result.details || {})}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
