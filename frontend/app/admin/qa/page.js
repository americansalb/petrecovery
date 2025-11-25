'use client';

// /admin/qa/page.js
// QA Test Harness for API endpoints

import { useState } from 'react';
import Link from 'next/link';

const TEST_SUITES = {
  publicPortal: {
    name: 'Public Portal (Phase 15-16)',
    tests: [
      {
        name: 'Public case list loads',
        endpoint: '/api/public/cases',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => Array.isArray(res.cases),
      },
      {
        name: 'Public case list with species filter',
        endpoint: '/api/public/cases?species=DOG',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => Array.isArray(res.cases),
      },
      {
        name: 'Public report validates required fields',
        endpoint: '/api/public/cases',
        method: 'POST',
        body: {},
        expectedStatus: 400,
        validate: (res) => res.error === 'Validation failed',
      },
      {
        name: 'Public report rejects invalid email',
        endpoint: '/api/public/cases',
        method: 'POST',
        body: { reporter: { email: 'invalid', firstName: 'Test' } },
        expectedStatus: 400,
        validate: (res) => res.details && res.details['reporter.email'],
      },
    ],
  },
  permissions: {
    name: 'Permissions (Phase 22-24)',
    tests: [
      {
        name: 'Admin rescue squads requires auth',
        endpoint: '/api/admin/rescue-squads',
        method: 'GET',
        expectedStatus: [401, 403],
        skipAuth: true,
      },
      {
        name: 'Admin users endpoint loads',
        endpoint: '/api/admin/users?role=PATROL',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => Array.isArray(res.users),
      },
    ],
  },
  assignment: {
    name: 'Case Assignment (Phase 22-24)',
    tests: [
      {
        name: 'Assign coordinator validates case exists',
        endpoint: '/api/cases/nonexistent-id/assign-coordinator',
        method: 'POST',
        body: { coordinatorId: 'test' },
        expectedStatus: 404,
      },
      {
        name: 'Assign squad validates case exists',
        endpoint: '/api/cases/nonexistent-id/assign-squad',
        method: 'POST',
        body: { squadId: 'test' },
        expectedStatus: 404,
      },
      {
        name: 'Status update validates status',
        endpoint: '/api/cases/nonexistent-id/status',
        method: 'POST',
        body: { status: 'INVALID_STATUS' },
        expectedStatus: 400,
      },
    ],
  },
};

export default function QAHarnessPage() {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState(null);

  async function runTest(test) {
    const startTime = Date.now();
    try {
      const options = {
        method: test.method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (test.body) {
        options.body = JSON.stringify(test.body);
      }

      const res = await fetch(test.endpoint, options);
      const duration = Date.now() - startTime;

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = { _parseError: true };
      }

      const expectedStatuses = Array.isArray(test.expectedStatus)
        ? test.expectedStatus
        : [test.expectedStatus];

      const statusPass = expectedStatuses.includes(res.status);
      const validatePass = !test.validate || test.validate(data);

      return {
        pass: statusPass && validatePass,
        status: res.status,
        expectedStatus: test.expectedStatus,
        duration,
        response: data,
        statusPass,
        validatePass,
      };
    } catch (error) {
      return {
        pass: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  async function runSuite(suiteKey) {
    setRunning(true);
    setSelectedSuite(suiteKey);

    const suite = TEST_SUITES[suiteKey];
    const suiteResults = {};

    for (const test of suite.tests) {
      suiteResults[test.name] = await runTest(test);
    }

    setResults((prev) => ({ ...prev, [suiteKey]: suiteResults }));
    setRunning(false);
  }

  async function runAllTests() {
    setRunning(true);

    for (const suiteKey of Object.keys(TEST_SUITES)) {
      const suite = TEST_SUITES[suiteKey];
      const suiteResults = {};

      for (const test of suite.tests) {
        suiteResults[test.name] = await runTest(test);
      }

      setResults((prev) => ({ ...prev, [suiteKey]: suiteResults }));
    }

    setRunning(false);
  }

  function getTotalStats() {
    let total = 0;
    let passed = 0;

    for (const suiteKey of Object.keys(results)) {
      const suiteResults = results[suiteKey];
      for (const testName of Object.keys(suiteResults)) {
        total++;
        if (suiteResults[testName].pass) passed++;
      }
    }

    return { total, passed, failed: total - passed };
  }

  const stats = getTotalStats();

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/admin" className="text-blue-600 hover:underline text-sm">
            &larr; Admin Home
          </Link>
          <h1 className="text-2xl font-bold mt-2">QA Test Harness</h1>
          <p className="text-gray-600">
            Automated API endpoint testing
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
              ADMIN ONLY
            </span>
          </p>
        </div>
        <button
          onClick={runAllTests}
          disabled={running}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? 'Running...' : 'Run All Tests'}
        </button>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">Total Tests</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <p className="text-green-600 text-sm">Passed</p>
            <p className="text-2xl font-bold text-green-700">{stats.passed}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <p className="text-red-600 text-sm">Failed</p>
            <p className="text-2xl font-bold text-red-700">{stats.failed}</p>
          </div>
        </div>
      )}

      {/* Test Suites */}
      <div className="space-y-6">
        {Object.entries(TEST_SUITES).map(([suiteKey, suite]) => (
          <div key={suiteKey} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
              <h2 className="font-bold">{suite.name}</h2>
              <button
                onClick={() => runSuite(suiteKey)}
                disabled={running}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
              >
                Run Suite
              </button>
            </div>

            <div className="divide-y">
              {suite.tests.map((test) => {
                const result = results[suiteKey]?.[test.name];
                return (
                  <div
                    key={test.name}
                    className={`px-4 py-3 flex items-center justify-between ${
                      result ? (result.pass ? 'bg-green-50' : 'bg-red-50') : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium">{test.name}</p>
                      <p className="text-xs text-gray-500">
                        {test.method} {test.endpoint}
                      </p>
                    </div>
                    <div className="text-right">
                      {result ? (
                        <div>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              result.pass
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {result.pass ? 'PASS' : 'FAIL'}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            {result.status && `Status: ${result.status}`}
                            {result.duration && ` (${result.duration}ms)`}
                          </p>
                          {result.error && (
                            <p className="text-xs text-red-600">{result.error}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Not run</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
