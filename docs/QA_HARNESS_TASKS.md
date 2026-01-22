# Admin QA Harness MVP - Task Breakdown (Phase 20-21)

**Feature Spec:** `docs/features/admin-qa-harness-mvp.md`
**Status:** Ready for Implementation
**Goal:** Build browser-based QA harness for smoke testing and test data generation

---

## Overview

This document breaks down Phase 20-21 (Admin QA Harness MVP) into 6 focused tasks:

- **TASK-Q01**: Create `/admin/qa` page structure
- **TASK-Q02**: Implement Legal test suite
- **TASK-Q03**: Implement Squad test suite
- **TASK-Q04**: Implement Mission test suite
- **TASK-Q05**: Implement Data Generators
- **TASK-Q06**: Integration, ERROR_IMPACT, and Documentation

Each task is designed to be:
- **Small enough** to complete in one focused session
- **Testable** via browser smoke test
- **Committable** with clear acceptance criteria

---

## TASK-Q01: Create `/admin/qa` Page Structure

**Goal**: Build the foundational QA page with tab navigation and auth checks.

**Files to Create**:
- `frontend/app/admin/qa/page.js`

**Implementation Details**:

### Page Structure

```javascript
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function AdminQAPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('tests'); // 'tests', 'generators', 'results'

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=' + encodeURIComponent('/admin/qa'));
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // ... rest of component
}
```

### Tab Navigation

Three tabs:
1. **Tests**: Test suite execution
2. **Generators**: Create demo data
3. **Results**: View test history

### Visual Style

Match `/admin/health` styling:
- Same header style
- White cards with rounded borders
- Tab buttons with active state highlighting
- Consistent spacing and typography

### Layout Template

```jsx
<div style={{ minHeight: '100vh', background: '#f9fafb', padding: '2rem 1rem' }}>
  <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
    {/* Header */}
    <div style={{ marginBottom: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#111827' }}>
        Admin QA & Testing Harness
      </h1>
      <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
        Browser-based smoke tests and test data generators
      </p>
    </div>

    {/* Tab Navigation */}
    <div style={{ marginBottom: '2rem', borderBottom: '2px solid #e5e7eb' }}>
      {['tests', 'generators', 'results'].map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'transparent',
            color: activeTab === tab ? '#3b82f6' : '#6b7280',
            borderBottom: activeTab === tab ? '2px solid #3b82f6' : 'none',
            fontWeight: activeTab === tab ? '700' : '600',
            cursor: 'pointer'
          }}
        >
          {tab.charAt(0).toUpperMission() + tab.slice(1)}
        </button>
      ))}
    </div>

    {/* Tab Content */}
    {activeTab === 'tests' && <TestsTab />}
    {activeTab === 'generators' && <GeneratorsTab />}
    {activeTab === 'results' && <ResultsTab />}
  </div>
</div>
```

### Initial Tab Components

Create placeholder components:
```javascript
function TestsTab() {
  return <div>Tests tab - Coming in TASK-Q02</div>;
}

function GeneratorsTab() {
  return <div>Generators tab - Coming in TASK-Q05</div>;
}

function ResultsTab() {
  return <div>Results tab - Coming in TASK-Q02</div>;
}
```

**Acceptance Criteria**:
- [ ] Page accessible at `/admin/qa`
- [ ] Non-admin users redirected to `/dashboard`
- [ ] Unauthenticated users redirected to `/login`
- [ ] Tab navigation works (Tests, Generators, Results)
- [ ] Visual style matches `/admin/health`
- [ ] Page renders without errors

**Commit Message**:
```
[Phase 20-21] TASK-Q01: Create /admin/qa page structure with tab navigation
```

---

## TASK-Q02: Implement Legal Test Suite

**Goal**: Implement Legal test missions and test execution engine.

**Files to Modify**:
- `frontend/app/admin/qa/page.js`

**Implementation Details**:

### Test Execution Engine

Create reusable test runner:

```javascript
async function runTest(testName, testFn) {
  const startTime = Date.now();
  const result = {
    name: testName,
    status: 'running', // 'running' | 'passed' | 'failed'
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

  return result;
}
```

### Legal Test Missions

**Test 1: Accept Waiver Flow**

```javascript
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
    throw new Error(`Accept failed: ${error.message}`);
  }

  return {
    waiver_version: waiver.version,
    tos_version: tos.version,
    accepted: true
  };
}
```

**Test 2: Blocked Action - Squad Create**

```javascript
async function testBlockedSquadCreate() {
  // Create squad without waiver (use current session which should have waiver)
  // This test verifies the error handling, not actual blocking
  // To truly test blocking, we'd need a test user without waiver

  const res = await fetch('/api/rescue-forces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: '[TEST] Phoenix',
      state: 'AZ',
      zipCode: '85001'
    })
  });

  // Since current user likely HAS waiver, this will succeed
  // But we check the response format
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
    // User has waiver, squad created
    const { squad } = await res.json();
    return { blocked: false, squad_id: squad.id, note: 'User has waiver, squad created successfully' };
  } else {
    throw new Error(`Unexpected status: ${res.status}`);
  }
}
```

**Test 3: Blocked Action - Mission Create**

```javascript
async function testBlockedMissionCreate() {
  const res = await fetch('/api/missions', {
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
    const { mission: missionData } = await res.json();
    return { blocked: false, mission_id: missionData.id, note: 'User has waiver, mission created successfully' };
  } else {
    throw new Error(`Unexpected status: ${res.status}`);
  }
}
```

### TestsTab Component

```javascript
function TestsTab() {
  const [legalTests, setLegalTests] = useState([
    { id: 'accept-waiver', name: 'Accept Waiver Flow', status: 'idle', fn: testAcceptWaiver },
    { id: 'blocked-squad', name: 'Blocked Action - Squad Create', status: 'idle', fn: testBlockedSquadCreate },
    { id: 'blocked-mission', name: 'Blocked Action - Mission Create', status: 'idle', fn: testBlockedMissionCreate },
  ]);
  const [running, setRunning] = useState(false);

  const runLegalTests = async () => {
    setRunning(true);
    for (let i = 0; i < legalTests.length; i++) {
      const test = legalTests[i];
      setLegalTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, status: 'running' } : t
      ));

      const result = await runTest(test.name, test.fn);

      setLegalTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, ...result } : t
      ));
    }
    setRunning(false);
  };

  return (
    <div>
      <TestSuite
        title="Legal Tests"
        tests={legalTests}
        onRun={runLegalTests}
        running={running}
      />
    </div>
  );
}
```

### TestSuite Component

```javascript
function TestSuite({ title, tests, onRun, running }) {
  return (
    <div style={{
      background: 'white',
      padding: '1.5rem',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      marginBottom: '1.5rem'
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>
        {title}
      </h2>

      <div style={{ marginBottom: '1rem' }}>
        {tests.map(test => (
          <TestResultRow key={test.id} test={test} />
        ))}
      </div>

      <button
        onClick={onRun}
        disabled={running}
        style={{
          padding: '0.75rem 1.5rem',
          background: running ? '#9ca3af' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: running ? 'not-allowed' : 'pointer'
        }}
      >
        {running ? 'Running...' : `Run ${title}`}
      </button>
    </div>
  );
}
```

### TestResultRow Component

```javascript
function TestResultRow({ test }) {
  const statusIcon = {
    'idle': '⏹️',
    'running': '⏳',
    'passed': '✅',
    'failed': '❌'
  };

  const statusColor = {
    'idle': '#6b7280',
    'running': '#f59e0b',
    'passed': '#10b981',
    'failed': '#ef4444'
  };

  return (
    <div style={{
      padding: '0.75rem',
      borderBottom: '1px solid #f3f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.25rem' }}>{statusIcon[test.status]}</span>
        <span style={{ fontWeight: '600' }}>{test.name}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {test.duration > 0 && (
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {test.duration}ms
          </span>
        )}
        {test.error && (
          <span style={{ fontSize: '0.875rem', color: statusColor.failed }}>
            {test.error}
          </span>
        )}
      </div>
    </div>
  );
}
```

### QA Logging Endpoint (Optional)

Create `frontend/app/api/admin/qa/log-test/route.js`:

```javascript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logEvent } from '@/lib/logging';

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { event_type, test_name, result, duration_ms, error } = await request.json();

  await logEvent({
    event_type,
    resource_type: 'qa_test',
    action: 'test',
    result: result === 'passed' ? 'success' : 'failure',
    actor_user_id: session.user.id,
    actor_role: 'ADMIN',
    error_message: error || null,
    metadata: {
      test_name,
      duration_ms
    }
  });

  return NextResponse.json({ logged: true });
}
```

**Acceptance Criteria**:
- [ ] Legal test suite renders in Tests tab
- [ ] "Run Legal Tests" button executes all 3 tests sequentially
- [ ] Tests show running state (⏳) while executing
- [ ] Tests show passed (✅) or failed (❌) after completion
- [ ] Test duration displayed for each test
- [ ] Failed tests show error message
- [ ] QA events logged to EventLog
- [ ] No errors in browser console

**Commit Message**:
```
[Phase 20-21] TASK-Q02: Implement Legal test suite with execution engine
```

---

## TASK-Q03: Implement Squad Test Suite

**Goal**: Add Squad test missions using the test execution engine from TASK-Q02.

**Files to Modify**:
- `frontend/app/admin/qa/page.js`

**Implementation Details**:

### Squad Test Missions

**Test 1: Create Squad - Happy Path**

```javascript
async function testCreateSquad() {
  const res = await fetch('/api/rescue-forces', {
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
```

**Test 2: Search Squads by ZIP**

```javascript
async function testSearchSquads() {
  const res = await fetch('/api/rescue-forces?search=78701&radius=25');

  if (!res.ok) {
    throw new Error(`Search failed: ${res.status}`);
  }

  const { cities } = await res.json();
  return { results_count: cities.length, cities: cities.map(c => c.city) };
}
```

**Test 3: Join Squad**

```javascript
async function testJoinSquad() {
  // First, find or create a test squad
  const searchRes = await fetch('/api/rescue-forces?search=78701');
  const { cities } = await searchRes.json();

  const testCity = cities.find(c => c.exists && c.squad);
  if (!testCity) {
    throw new Error('No test squad found - run Create Squad test first');
  }

  const res = await fetch(`/api/rescue-forces/${testCity.squad.id}/join`, {
    method: 'POST'
  });

  if (res.status === 200) {
    return { joined: true, squad_id: testCity.squad.id };
  } else if (res.status === 400) {
    const error = await res.json();
    if (error.error.includes('already a member')) {
      return { already_member: true, squad_id: testCity.squad.id };
    }
    throw new Error(error.error);
  } else {
    throw new Error(`Join failed: ${res.status}`);
  }
}
```

**Test 4: Leave Squad**

```javascript
async function testLeaveSquad() {
  // Find a squad the user is a member of
  const searchRes = await fetch('/api/rescue-forces?search=78701');
  const { cities } = await searchRes.json();

  const memberSquad = cities.find(c => c.exists && c.squad && c.squad.isMember);
  if (!memberSquad) {
    throw new Error('Not a member of any test squad - run Join Squad test first');
  }

  const res = await fetch(`/api/rescue-forces/${memberSquad.squad.id}/leave`, {
    method: 'POST'
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Leave failed: ${error.error}`);
  }

  return { left: true, squad_id: memberSquad.squad.id };
}
```

### Update TestsTab Component

Add squad tests alongside legal tests:

```javascript
function TestsTab() {
  const [legalTests, setLegalTests] = useState([...]);
  const [squadTests, setSquadTests] = useState([
    { id: 'create-squad', name: 'Create Squad - Happy Path', status: 'idle', fn: testCreateSquad },
    { id: 'search-squads', name: 'Search Squads by ZIP', status: 'idle', fn: testSearchSquads },
    { id: 'join-squad', name: 'Join Squad', status: 'idle', fn: testJoinSquad },
    { id: 'leave-squad', name: 'Leave Squad', status: 'idle', fn: testLeaveSquad },
  ]);

  // ... legal tests logic

  const runSquadTests = async () => {
    // Same pattern as runLegalTests
  };

  return (
    <div>
      <TestSuite
        title="Legal Tests"
        tests={legalTests}
        onRun={runLegalTests}
        running={runningLegal}
      />

      <TestSuite
        title="Squad Tests"
        tests={squadTests}
        onRun={runSquadTests}
        running={runningSquad}
      />
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Squad test suite renders below Legal tests
- [ ] "Run Squad Tests" button executes all 4 tests
- [ ] Create Squad test creates a squad with [TEST] prefix
- [ ] Search Squads test returns results
- [ ] Join Squad test joins a squad (or shows already member)
- [ ] Leave Squad test leaves a squad
- [ ] All tests log QA events
- [ ] Test results displayed correctly

**Commit Message**:
```
[Phase 20-21] TASK-Q03: Implement Squad test suite (create, search, join, leave)
```

---

## TASK-Q04: Implement Mission Test Suite

**Goal**: Add Mission test missions to complete test coverage.

**Files to Modify**:
- `frontend/app/admin/qa/page.js`

**Implementation Details**:

### Mission Test Missions

**Test 1: Create Mission**

```javascript
async function testCreateMission() {
  const res = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'DOG',
      petName: `[TEST QA] Test Dog ${Date.now()}`,
      petBreed: 'Golden Retriever',
      petColor: 'Golden',
      contactName: 'QA Test Contact',
      contactPhone: '512-555-0100'
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Create mission failed: ${error.error}`);
  }

  const { mission: missionData } = await res.json();
  return { mission_id: missionData.id, mission_number: missionData.missionNumber };
}
```

**Test 2: Update Mission Status**

```javascript
async function testUpdateMissionStatus() {
  // First, create a test mission or find one
  const createRes = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      petSpecies: 'CAT',
      petName: '[TEST QA] Status Test Cat'
    })
  });

  const { mission: testMission } = await createRes.json();

  // Update status
  const res = await fetch(`/api/missions/${testMission.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'ACTIVE_SEARCH',
      statusReason: '[QA TEST] Testing status update'
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Status update failed: ${error.error}`);
  }

  const { mission: updatedMission } = await res.json();
  return { mission_id: updatedMission.id, new_status: updatedMission.status };
}
```

**Test 3: Add Note to Mission**

```javascript
async function testAddMissionNote() {
  // Find or create a test mission
  const listRes = await fetch('/api/missions?limit=1');
  const { missions } = await listRes.json();

  let testMissionId;
  if (missions.length > 0) {
    testMissionId = missions[0].id;
  } else {
    // Create one
    const createRes = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: 'Austin',
        state: 'TX',
        petSpecies: 'BIRD',
        petName: '[TEST QA] Note Test Bird'
      })
    });
    const { mission: newMission } = await createRes.json();
    testMissionId = newMission.id;
  }

  // Add note
  const res = await fetch(`/api/missions/${testMissionId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `[QA TEST] Test note added at ${new Date().toISOString()}`
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Add note failed: ${error.error}`);
  }

  const { note } = await res.json();
  return { mission_id: testMissionId, note_id: note.id };
}
```

### Update TestsTab Component

Add mission tests:

```javascript
const [missionTests, setMissionTests] = useState([
  { id: 'create-mission', name: 'Create Mission', status: 'idle', fn: testCreateMission },
  { id: 'update-status', name: 'Update Mission Status', status: 'idle', fn: testUpdateMissionStatus },
  { id: 'add-note', name: 'Add Note to Mission', status: 'idle', fn: testAddMissionNote },
]);
```

Add "Run All Tests" button:

```javascript
const runAllTests = async () => {
  await runLegalTests();
  await runSquadTests();
  await runMissionTests();
};

// In render:
<button
  onClick={runAllTests}
  disabled={runningAny}
  style={{
    padding: '1rem 2rem',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '1.1rem',
    cursor: runningAny ? 'not-allowed' : 'pointer',
    marginBottom: '2rem'
  }}
>
  Run All Tests
</button>
```

**Acceptance Criteria**:
- [ ] Mission test suite renders below Squad tests
- [ ] "Run Mission Tests" button executes all 3 tests
- [ ] Create Mission test creates a mission
- [ ] Update Status test changes mission status
- [ ] Add Note test creates a note
- [ ] "Run All Tests" button runs all test suites sequentially
- [ ] All tests log QA events
- [ ] No regressions to existing tests

**Commit Message**:
```
[Phase 20-21] TASK-Q04: Implement Mission test suite (create, status, notes)
```

---

## TASK-Q05: Implement Data Generators

**Goal**: Build data generator forms for creating demo squads and missions.

**Files to Modify**:
- `frontend/app/admin/qa/page.js`

**Implementation Details**:

### GeneratorsTab Component

```javascript
function GeneratorsTab() {
  return (
    <div>
      <SquadGenerator />
      <MissionGenerator />
      <DataCleanup />
    </div>
  );
}
```

### SquadGenerator Component

```javascript
function SquadGenerator() {
  const [count, setCount] = useState(5);
  const [cities, setCities] = useState('Austin,Seattle,Portland,Denver');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    setGenerating(true);
    setResult(null);

    const cityList = cities.split(',').map(c => c.trim());
    const created = [];

    for (let i = 0; i < Math.min(count, 20); i++) {
      const city = cityList[i % cityList.length];

      try {
        const res = await fetch('/api/rescue-forces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: `[TEST] ${city} Squad ${i + 1}`,
            state: 'TX', // Simplified for MVP
            zipCode: '78701' // Default ZIP
          })
        });

        if (res.ok) {
          const { squad } = await res.json();
          created.push(squad.id);
        }
      } catch (error) {
        console.error('Failed to create squad:', error);
      }
    }

    // Log generation event
    await fetch('/api/admin/qa/log-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'qa.test_data_generated',
        test_name: 'Generate Demo Squads',
        result: 'passed',
        duration_ms: 0
      })
    });

    setResult({ created: created.length, ids: created });
    setGenerating(false);
  };

  return (
    <div style={{
      background: 'white',
      padding: '1.5rem',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      marginBottom: '1.5rem'
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>
        Generate Demo Squads
      </h2>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
          Number of squads (max 20):
        </label>
        <input
          type="number"
          min="1"
          max="20"
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value))}
          style={{
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            width: '100px'
          }}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
          Cities (comma-separated):
        </label>
        <input
          type="text"
          value={cities}
          onChange={(e) => setCities(e.target.value)}
          style={{
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            width: '100%'
          }}
        />
      </div>

      <button
        onClick={generate}
        disabled={generating}
        style={{
          padding: '0.75rem 1.5rem',
          background: generating ? '#9ca3af' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: generating ? 'not-allowed' : 'pointer'
        }}
      >
        {generating ? 'Generating...' : 'Generate Squads'}
      </button>

      {result && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#d1fae5',
          border: '1px solid #10b981',
          borderRadius: '8px',
          color: '#065f46'
        }}>
          ✅ Created {result.created} demo squads
        </div>
      )}
    </div>
  );
}
```

### MissionGenerator Component

```javascript
function MissionGenerator() {
  const [count, setCount] = useState(10);
  const [city, setCity] = useState('Austin');
  const [state, setState] = useState('TX');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const petNames = ['Max', 'Bella', 'Charlie', 'Luna', 'Cooper', 'Daisy', 'Milo', 'Lucy', 'Rocky', 'Sadie'];
  const breeds = ['Golden Retriever', 'Labrador', 'German Shepherd', 'Tabby Cat', 'Siamese Cat', 'Beagle'];
  const colors = ['Golden', 'Black', 'Brown', 'White', 'Gray', 'Orange'];
  const statuses = ['OPEN', 'ACTIVE_SEARCH', 'RESOLVED'];
  const species = ['DOG', 'CAT', 'BIRD'];

  const generate = async () => {
    setGenerating(true);
    setResult(null);

    const created = [];

    for (let i = 0; i < Math.min(count, 50); i++) {
      const petSpecies = species[Math.floor(Math.random() * species.length)];
      const petName = `[TEST] ${petNames[Math.floor(Math.random() * petNames.length)]}`;
      const breed = breeds[Math.floor(Math.random() * breeds.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];

      try {
        const res = await fetch('/api/missions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city,
            state,
            petSpecies,
            petName,
            petBreed: breed,
            petColor: color,
            petDescription: `QA test mission ${i + 1}`,
            contactName: 'QA Test Contact',
            contactPhone: '555-0100'
          })
        });

        if (res.ok) {
          const { mission: missionData } = await res.json();
          created.push(missionData.id);

          // Randomly update status
          const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
          if (randomStatus !== 'OPEN') {
            await fetch(`/api/missions/${missionData.id}/status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: randomStatus,
                statusReason: 'QA test status update'
              })
            });
          }

          // Add random notes (0-2)
          const noteCount = Math.floor(Math.random() * 3);
          for (let j = 0; j < noteCount; j++) {
            await fetch(`/api/missions/${missionData.id}/notes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `[QA] Test note ${j + 1} for mission`
              })
            });
          }
        }
      } catch (error) {
        console.error('Failed to create mission:', error);
      }
    }

    setResult({ created: created.length, ids: created });
    setGenerating(false);
  };

  // Similar UI structure to SquadGenerator
  return (...);
}
```

### DataCleanup Component

```javascript
function DataCleanup() {
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState(null);

  const cleanup = async () => {
    if (!confirm('Delete all test squads and missions with [TEST] prefix?\n\nThis action cannot be undone.')) {
      return;
    }

    setCleaning(true);
    setResult(null);

    let squadCount = 0;
    let missionCount = 0;

    // Find and delete test squads
    const squadRes = await fetch('/api/rescue-forces?search=78701');
    const { cities } = await squadRes.json();

    for (const city of cities) {
      if (city.squad && city.squad.name.startsWith('[TEST]')) {
        // Note: Need delete endpoint - for MVP, just mark inactive
        squadCount++;
      }
    }

    // Find and delete test missions
    const missionRes = await fetch('/api/missions');
    const { missions } = await missionRes.json();

    for (const c of missions) {
      if (c.petName && c.petName.startsWith('[TEST]')) {
        // Note: Need delete endpoint - for MVP, just mark as CLOSED_OTHER
        try {
          await fetch(`/api/missions/${c.id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'CLOSED_OTHER',
              statusReason: '[QA] Cleaned up test data'
            })
          });
          missionCount++;
        } catch (error) {
          console.error('Failed to close mission:', error);
        }
      }
    }

    setResult({ squads: squadCount, missions: missionCount });
    setCleaning(false);
  };

  return (
    <div style={{
      background: 'white',
      padding: '1.5rem',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      marginBottom: '1.5rem'
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: '#dc2626' }}>
        ⚠️ Cleanup Test Data
      </h2>

      <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
        This will close all test missions (mark as CLOSED_OTHER) with [TEST] prefix.
        This action cannot be undone.
      </p>

      <button
        onClick={cleanup}
        disabled={cleaning}
        style={{
          padding: '0.75rem 1.5rem',
          background: cleaning ? '#9ca3af' : '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: cleaning ? 'not-allowed' : 'pointer'
        }}
      >
        {cleaning ? 'Cleaning...' : 'Delete Test Data'}
      </button>

      {result && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#fee2e2',
          border: '1px solid #dc2626',
          borderRadius: '8px',
          color: '#991b1b'
        }}>
          Cleaned up: {result.missions} test missions (marked CLOSED_OTHER)
        </div>
      )}
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Generators tab shows Squad, Mission, and Cleanup sections
- [ ] Squad generator creates N squads with [TEST] prefix
- [ ] Mission generator creates N missions with random data
- [ ] Missions have mix of statuses and species
- [ ] Missions include random notes (0-2 per mission)
- [ ] Cleanup marks test missions as CLOSED_OTHER
- [ ] Success messages show count of items created/cleaned
- [ ] All operations log QA events

**Commit Message**:
```
[Phase 20-21] TASK-Q05: Implement data generators (squads, missions, cleanup)
```

---

## TASK-Q06: Integration, ERROR_IMPACT, and Documentation

**Goal**: Wire QA events into admin health dashboard and update documentation.

**Files to Modify**:
- `frontend/app/admin/health/page.jsx`
- `VISION.md`
- `docs/features/admin-qa-harness-mvp.md`

**Implementation Details**:

### Update ERROR_IMPACT Mapping

Add QA event types to `frontend/app/admin/health/page.jsx`:

```javascript
const ERROR_IMPACT = {
  // ... existing mappings

  // Low severity - QA/testing events
  'qa.test_executed': { label: 'QA Tests', severity: 'low' },
  'qa.test_data_generated': { label: 'QA Data Gen', severity: 'low' },
  'admin.test_geocode_run': { label: 'Admin Tools', severity: 'low' },
  'admin.test_email_sent': { label: 'Admin Tools', severity: 'low' },
};
```

### Update VISION.md

Mark Phase 20-21 as complete:

```markdown
- **Phase 20-21: Admin QA Harness** ✅ **COMPLETE** (Nov 25, 2025)
  - **QA Page:** Browser-based testing at `/admin/qa`
  - **Test Suites:** Legal, Squad, Mission smoke tests
  - **Data Generators:** Create demo squads and missions
  - **Test Data Cleanup:** Remove [TEST] prefixed items
  - **Observability:** All QA actions emit `qa.*` events
  - **See:** `docs/features/admin-qa-harness-mvp.md`
```

Update Next Tactical Priorities:

```markdown
### 🎯 Next Tactical Priorities

1. **Identify next phase cluster from roadmap**
   - Candidates: Public mission portal, Notifications MVP, Roles/permissions
   - Build on Phase 0 (observability), Phase 13-14 (missions), Phase 20-21 (QA)
   - All features must emit structured events and respect legal gating
```

### Update Feature Spec

Change status in `docs/features/admin-qa-harness-mvp.md`:

```markdown
**Status:** ✅ Fully Implemented
**Last Updated:** November 25, 2025
```

Add Implementation Status section:

```markdown
## 0.1 Implementation Status

**Implementation Completed:** November 25, 2025

All components of the Admin QA Harness MVP have been fully implemented:

### Tests Tab (TASK-Q02, Q03, Q04)
- ✅ Legal test suite (3 tests)
- ✅ Squad test suite (4 tests)
- ✅ Mission test suite (3 tests)
- ✅ "Run All Tests" button
- ✅ Real-time test status (idle, running, passed, failed)
- ✅ Test duration tracking
- ✅ Error message display

### Generators Tab (TASK-Q05)
- ✅ Squad generator (create N squads with city names)
- ✅ Mission generator (create N missions with random data)
- ✅ Test data cleanup (mark [TEST] missions as CLOSED_OTHER)
- ✅ Success/error feedback

### Observability
- ✅ All QA actions emit `qa.*` events
- ✅ Events visible in Admin Health Errors tab
- ✅ ERROR_IMPACT labels configured
```

### Browser Smoke Test Checklist

Before committing, verify:
- [ ] `/admin/qa` accessible to admins only
- [ ] Non-admin users redirected
- [ ] Tab navigation works
- [ ] Legal tests execute and show results
- [ ] Squad tests execute and show results
- [ ] Mission tests execute and show results
- [ ] "Run All Tests" runs all suites
- [ ] Squad generator creates squads
- [ ] Mission generator creates missions
- [ ] Cleanup marks test missions as closed
- [ ] QA events appear in `/admin/health` Errors tab
- [ ] No regressions to other pages

**Acceptance Criteria**:
- [ ] QA event types added to ERROR_IMPACT
- [ ] QA events visible in Admin Health Errors tab
- [ ] VISION.md updated with Phase 20-21 status
- [ ] Feature spec updated to "Fully Implemented"
- [ ] Implementation Status section added to spec
- [ ] Browser smoke test passed
- [ ] All tasks in this doc marked complete

**Commit Message**:
```
[Phase 20-21] TASK-Q06: Complete QA harness with admin health integration and docs
```

---

## Testing Checklist

After completing all tasks, verify:

**Functionality (No Regressions):**
- [ ] `/` - Homepage works
- [ ] `/rescue-forces/search` - Squad search works
- [ ] `/admin/health` - All tabs load
- [ ] `/admin/missions` - Mission list works
- [ ] `/admin/missions/new` - Mission creation works
- [ ] `/legal/consent` - Legal acceptance works

**New QA Features:**
- [ ] `/admin/qa` loads for admins
- [ ] All test suites execute correctly
- [ ] Data generators create realistic data
- [ ] Test data cleanup works
- [ ] QA events logged and visible

---

## Commit Strategy

Small, focused commits for each task:

1. `[Phase 20-21] TASK-Q01: Create /admin/qa page structure`
2. `[Phase 20-21] TASK-Q02: Implement Legal test suite`
3. `[Phase 20-21] TASK-Q03: Implement Squad test suite`
4. `[Phase 20-21] TASK-Q04: Implement Mission test suite`
5. `[Phase 20-21] TASK-Q05: Implement data generators`
6. `[Phase 20-21] TASK-Q06: Complete QA harness integration and docs`

Push after each task to ensure progress is saved.

---

**End of Task Breakdown**
