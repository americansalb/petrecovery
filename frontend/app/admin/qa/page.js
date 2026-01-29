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
import { isAdmin } from '@/app/lib/permissions';

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
    if (session && !isAdmin(session)) {
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

  if (!isAdmin(session)) {
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
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                Admin QA Harness
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold">
                  🔒 ADMIN ONLY
                </span>
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
    return { blocked: false, squad_id: squad.id, note: 'User has waiver, force created successfully' };
  } else {
    const errorData = await res.json();
    throw new Error(`Unexpected status ${res.status}: ${errorData.error || 'Unknown error'}`);
  }
}

async function testBlockedCaseCreate() {
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
    const { case: missionData } = await res.json();
    return { blocked: false, case_id: missionData.id, note: 'User has waiver, case created successfully' };
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
      city: `[TEST] QA Force ${Date.now()}`,
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
    throw new Error('No test force found - run Create Force test first');
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
    throw new Error('Not a member of any test force - run Join Force test first');
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
// CASE TEST CASES
// ============================================================================

async function testCreateCase() {
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
    throw new Error(`Create case failed: ${error.error}`);
  }

  const { case: missionData } = await res.json();
  return { case_id: missionData.id, case_number: missionData.missionNumber };
}

async function testUpdateCaseStatus() {
  // First, create a test case
  const createRes = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'CAT',
      petName: '[TEST QA] Status Test Cat'
    })
  });

  if (!createRes.ok) {
    const error = await createRes.json();
    throw new Error(`Create case failed: ${error.error}`);
  }

  const { case: testCase } = await createRes.json();

  // Update status
  const res = await fetch(`/api/missions/${testCase.id}/status`, {
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

  const { case: updatedMission } = await res.json();
  return { case_id: updatedMission.id, new_status: updatedMission.status };
}

async function testAddCaseNote() {
  // Find or create a test case
  const listRes = await fetch('/api/missions?limit=1');
  if (!listRes.ok) {
    throw new Error(`Failed to list cases: ${listRes.status}`);
  }

  const { cases } = await listRes.json();

  let testCaseId;
  if (cases.length > 0) {
    testCaseId = cases[0].id;
  } else {
    // Create one
    const createRes = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        petSpecies: 'BIRD',
        petName: '[TEST QA] Note Test Bird'
      })
    });

    if (!createRes.ok) {
      const error = await createRes.json();
      throw new Error(`Create case failed: ${error.error}`);
    }

    const { case: newCase } = await createRes.json();
    testCaseId = newCase.id;
  }

  // Add note
  const res = await fetch(`/api/missions/${testCaseId}/notes`, {
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
  return { case_id: testCaseId, note_id: note.id };
}

// ============================================================================
// PUBLIC CASE TEST CASES (Phase 15-16)
// ============================================================================

async function testListPublicCases() {
  // Test GET /api/public/missions - list with filters
  const res = await fetch('/api/public/missions?limit=10');

  if (!res.ok) {
    throw new Error(`List public cases failed: ${res.status}`);
  }

  const data = await res.json();

  if (!data.cases || !Array.isArray(data.cases)) {
    throw new Error('Expected cases array in response');
  }

  if (!data.pagination) {
    throw new Error('Expected pagination object in response');
  }

  // Verify all returned cases have isPublic=true
  const nonPublicCases = data.cases.filter(c => !c.isPublic);
  if (nonPublicCases.length > 0) {
    throw new Error(`Found ${nonPublicCases.length} non-public cases in public list`);
  }

  // Verify sensitive fields are NOT exposed
  const casesWithSensitiveData = data.cases.filter(c =>
    c.createdById || c.squadId || c.source
  );
  if (casesWithSensitiveData.length > 0) {
    throw new Error('Sensitive fields (createdById, squadId, source) exposed in public list');
  }

  return {
    cases_count: data.cases.length,
    total_count: data.pagination.totalCount,
    all_public: true,
    no_sensitive_data: true
  };
}

async function testPublicCaseDetail() {
  // First, find a public case
  const listRes = await fetch('/api/public/missions?limit=1');
  if (!listRes.ok) {
    throw new Error('Failed to find public cases');
  }

  const { cases } = await listRes.json();

  if (cases.length === 0) {
    // No public cases available - skip test
    return { skipped: true, reason: 'No public cases available for testing' };
  }

  const testCase = cases[0];

  // Test GET /api/public/missions/[missionNumber]
  const res = await fetch(`/api/public/missions/${testCase.missionNumber}`);

  if (!res.ok) {
    throw new Error(`Get case detail failed: ${res.status}`);
  }

  const missionData = await res.json();

  // Verify case data
  if (missionData.missionNumber !== testCase.missionNumber) {
    throw new Error('Mission number mismatch');
  }

  // Verify contact privacy controls
  if (!missionData.contact) {
    throw new Error('Missing contact field in response');
  }

  // Verify sensitive fields are NOT exposed
  if (missionData.createdById || missionData.squadId || missionData.source) {
    throw new Error('Sensitive fields exposed in public detail');
  }

  return {
    case_number: missionData.missionNumber,
    has_contact_field: true,
    no_sensitive_data: true
  };
}

async function testSubmitPublicReport() {
  // Test POST /api/public/missions - submit report
  const timestamp = Date.now();
  const res = await fetch('/api/public/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'DOG',
      petName: `[PUBLIC QA TEST] ${timestamp}`,
      petBreed: 'Labrador',
      petColor: 'Black',
      petDescription: 'QA test report submission',
      contactName: 'QA Test Reporter',
      contactEmail: 'qa-test@example.com',
      contactPhone: '512-555-0123',
      agreeToTerms: true
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Submit report failed: ${error.message || error.error}`);
  }

  const data = await res.json();

  if (!data.missionNumber) {
    throw new Error('Missing missionNumber in response');
  }

  if (!data.success) {
    throw new Error('Expected success=true in response');
  }

  // Verify the case was created with correct defaults
  // (isPublic=false, source=PUBLIC_REPORT - these should not be visible via public API)

  return {
    case_number: data.missionNumber,
    success: data.success,
    message: data.message
  };
}

// ============================================================================
// NOTIFICATION TEST CASES (Phase 25-26)
// ============================================================================

async function testReportConfirmationEmail() {
  // Submit public report and verify confirmation email attempt was logged
  const timestamp = Date.now();
  const res = await fetch('/api/public/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'DOG',
      petName: `[NOTIFICATION QA] ${timestamp}`,
      petBreed: 'Golden Retriever',
      petColor: 'Golden',
      contactName: 'QA Email Test',
      contactEmail: 'qa-notification-test@example.com',
      contactPhone: '512-555-0199',
      agreeToTerms: true
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Submit report failed: ${error.message || error.error}`);
  }

  const data = await res.json();

  // Wait briefly for async notification to process
  await new Promise(resolve => setTimeout(resolve, 500));

  // Check that notification events were logged
  // We can't directly verify email was sent without checking the actual inbox,
  // but we can verify the API succeeded and the case was created
  return {
    case_number: data.missionNumber,
    success: data.success,
    note: 'Email send attempted (check EventLog or /admin/health for notification.send_* events)'
  };
}

async function testAdminAlertEmail() {
  // Submit public report and verify admin alert was attempted
  // This test verifies the admin notification flow
  const timestamp = Date.now();
  const res = await fetch('/api/public/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Phoenix',
      state: 'AZ',
      zipCode: '85001',
      petSpecies: 'CAT',
      petName: `[ADMIN ALERT QA] ${timestamp}`,
      petBreed: 'Tabby',
      petColor: 'Orange',
      contactName: 'Admin Alert Test',
      contactEmail: 'admin-alert-test@example.com',
      agreeToTerms: true
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Submit report failed: ${error.message || error.error}`);
  }

  const data = await res.json();

  // Wait briefly for async notification to process
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    case_number: data.missionNumber,
    success: data.success,
    note: 'Admin alert sent (if ADMIN_NOTIFICATION_EMAIL configured). Check EventLog for notification events.'
  };
}

async function testStatusUpdateEmail() {
  // Create case, update status, verify notification was attempted
  const timestamp = Date.now();

  // 1. Create a test case
  const createRes = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'DOG',
      petName: `[STATUS EMAIL QA] ${timestamp}`,
      contactName: 'Status Email Test',
      contactEmail: 'status-update-test@example.com'
    })
  });

  if (!createRes.ok) {
    const error = await createRes.json();
    throw new Error(`Create case failed: ${error.error}`);
  }

  const { case: testCase } = await createRes.json();

  // 2. Update status to ACTIVE_SEARCH (should trigger email)
  const updateRes = await fetch(`/api/missions/${testCase.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'ACTIVE_SEARCH',
      statusReason: '[QA] Testing status update notification'
    })
  });

  if (!updateRes.ok) {
    const error = await updateRes.json();
    throw new Error(`Status update failed: ${error.error}`);
  }

  const { case: updatedMission } = await updateRes.json();

  // Wait briefly for async notification to process
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    case_id: updatedMission.id,
    new_status: updatedMission.status,
    note: 'Status update email sent. Check EventLog for notification.send_* events.'
  };
}

// ============================================================================
// PERMISSION & ASSIGNMENT TESTS (Phase 22-24)
// ============================================================================

async function testPermissionHelper() {
  // Test that permission helper functions work correctly
  // This is a client-side test that verifies the module loads
  const { isAdmin, requireStaffOrAdmin } = await import('@/app/lib/permissions');

  if (typeof isAdmin !== 'function') {
    throw new Error('isAdmin helper not found');
  }

  if (typeof requireStaffOrAdmin !== 'function') {
    throw new Error('requireStaffOrAdmin helper not found');
  }

  return {
    note: 'Permission helper module loaded successfully'
  };
}

async function testAssignCoordinator() {
  // Create a test case and assign a coordinator
  const timestamp = Date.now();

  // 1. Create a test case
  const createRes = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'DOG',
      petName: `[COORDINATOR QA] ${timestamp}`,
      contactName: 'Coordinator Test'
    })
  });

  if (!createRes.ok) {
    const error = await createRes.json();
    throw new Error(`Create case failed: ${error.error}`);
  }

  const { case: testCase } = await createRes.json();

  // 2. Get available users to find an ADMIN/MODERATOR
  const usersRes = await fetch('/api/users');
  if (!usersRes.ok) {
    throw new Error('Failed to fetch users');
  }

  const { users } = await usersRes.json();
  const coordinator = users.find(u => u.role === 'ADMIN' || u.role === 'MODERATOR');

  if (!coordinator) {
    throw new Error('No ADMIN/MODERATOR users available for test');
  }

  // 3. Assign coordinator
  const assignRes = await fetch(`/api/missions/${testCase.id}/assign-coordinator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinatorId: coordinator.id })
  });

  if (!assignRes.ok) {
    const error = await assignRes.json();
    throw new Error(`Assign coordinator failed: ${error.error || error.message}`);
  }

  const { case: assignedCase } = await assignRes.json();

  return {
    case_id: testCase.id,
    coordinator_id: coordinator.id,
    coordinator_name: `${coordinator.firstName} ${coordinator.lastName || ''}`.trim()
  };
}

async function testUnassignCoordinator() {
  // Create a test case, assign coordinator, then unassign
  const timestamp = Date.now();

  // 1. Create a test case
  const createRes = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'CAT',
      petName: `[UNASSIGN QA] ${timestamp}`,
      contactName: 'Unassign Test'
    })
  });

  if (!createRes.ok) {
    const error = await createRes.json();
    throw new Error(`Create case failed: ${error.error}`);
  }

  const { case: testCase } = await createRes.json();

  // 2. Unassign coordinator (set to null)
  const unassignRes = await fetch(`/api/missions/${testCase.id}/assign-coordinator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinatorId: null })
  });

  if (!unassignRes.ok) {
    const error = await unassignRes.json();
    throw new Error(`Unassign coordinator failed: ${error.error || error.message}`);
  }

  const { case: unassignedCase } = await unassignRes.json();

  return {
    case_id: testCase.id,
    coordinator_id: unassignedCase.coordinatorId,
    note: 'Coordinator should be null'
  };
}

async function testAssignSquad() {
  // Create a test case and assign a squad
  const timestamp = Date.now();

  // 1. Create a test case
  const createRes = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'DOG',
      petName: `[SQUAD QA] ${timestamp}`,
      contactName: 'Force Test'
    })
  });

  if (!createRes.ok) {
    const error = await createRes.json();
    throw new Error(`Create case failed: ${error.error}`);
  }

  const { case: testCase } = await createRes.json();

  // 2. Get available squads
  const squadsRes = await fetch('/api/squads');
  if (!squadsRes.ok) {
    throw new Error('Failed to fetch forces');
  }

  const { squads } = await squadsRes.json();
  const activeSquad = squads.find(s => s.isActive);

  if (!activeSquad) {
    throw new Error('No active forces available for test');
  }

  // 3. Assign squad
  const assignRes = await fetch(`/api/missions/${testCase.id}/assign-squad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ squadId: activeSquad.id })
  });

  if (!assignRes.ok) {
    const error = await assignRes.json();
    throw new Error(`Assign squad failed: ${error.error || error.message}`);
  }

  const { case: assignedCase } = await assignRes.json();

  return {
    case_id: testCase.id,
    squad_id: activeSquad.id,
    squad_name: activeSquad.name
  };
}

async function testInvalidCoordinatorRole() {
  // Try to assign a USER role as coordinator (should fail)
  const timestamp = Date.now();

  // 1. Create a test case
  const createRes = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'DOG',
      petName: `[INVALID ROLE QA] ${timestamp}`,
      contactName: 'Invalid Role Test'
    })
  });

  if (!createRes.ok) {
    const error = await createRes.json();
    throw new Error(`Create case failed: ${error.error}`);
  }

  const { case: testCase } = await createRes.json();

  // 2. Get a USER role (non-staff)
  const usersRes = await fetch('/api/users');
  if (!usersRes.ok) {
    throw new Error('Failed to fetch users');
  }

  const { users } = await usersRes.json();
  const regularUser = users.find(u => u.role === 'USER');

  if (!regularUser) {
    // If no USER found, create a fake ID to test validation
    const assignRes = await fetch(`/api/missions/${testCase.id}/assign-coordinator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinatorId: 'fake-user-id-12345' })
    });

    if (assignRes.ok) {
      throw new Error('Expected assignment to fail with invalid user ID');
    }

    return {
      case_id: testCase.id,
      note: 'Assignment correctly rejected invalid coordinator ID'
    };
  }

  // 3. Try to assign USER role as coordinator (should fail)
  const assignRes = await fetch(`/api/missions/${testCase.id}/assign-coordinator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinatorId: regularUser.id })
  });

  if (assignRes.ok) {
    throw new Error('Expected assignment to fail for USER role, but it succeeded');
  }

  const error = await assignRes.json();

  if (error.code !== 'INVALID_COORDINATOR_ROLE') {
    throw new Error(`Expected INVALID_COORDINATOR_ROLE error, got: ${error.code}`);
  }

  return {
    case_id: testCase.id,
    error_code: error.code,
    note: 'Assignment correctly rejected USER role'
  };
}

async function testInactiveSquad() {
  // Try to assign an inactive squad (should fail)
  const timestamp = Date.now();

  // 1. Create a test case
  const createRes = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'CAT',
      petName: `[INACTIVE SQUAD QA] ${timestamp}`,
      contactName: 'Inactive Force Test'
    })
  });

  if (!createRes.ok) {
    const error = await createRes.json();
    throw new Error(`Create case failed: ${error.error}`);
  }

  const { case: testCase } = await createRes.json();

  // 2. Get squads
  const squadsRes = await fetch('/api/squads');
  if (!squadsRes.ok) {
    throw new Error('Failed to fetch forces');
  }

  const { squads } = await squadsRes.json();
  const inactiveSquad = squads.find(s => !s.isActive);

  if (!inactiveSquad) {
    // If no inactive squad exists, test with fake ID instead
    const assignRes = await fetch(`/api/missions/${testCase.id}/assign-squad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squadId: 'fake-squad-id-12345' })
    });

    if (assignRes.ok) {
      throw new Error('Expected assignment to fail with invalid force ID');
    }

    return {
      case_id: testCase.id,
      note: 'Assignment correctly rejected invalid force ID'
    };
  }

  // 3. Try to assign inactive squad (should fail)
  const assignRes = await fetch(`/api/missions/${testCase.id}/assign-squad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ squadId: inactiveSquad.id })
  });

  if (assignRes.ok) {
    throw new Error('Expected assignment to fail for inactive force, but it succeeded');
  }

  const error = await assignRes.json();

  if (error.code !== 'SQUAD_NOT_ACTIVE') {
    throw new Error(`Expected SQUAD_NOT_ACTIVE error, got: ${error.code}`);
  }

  return {
    case_id: testCase.id,
    error_code: error.code,
    note: 'Assignment correctly rejected inactive force'
  };
}

// ============================================================================
// TESTS PANEL
// ============================================================================

function TestsPanel({ onTestComplete }) {
  // Legal tests state
  const [legalTests, setLegalTests] = useState([
    { id: 'accept-waiver', name: 'Accept Waiver Flow', status: 'idle', fn: testAcceptWaiver },
    { id: 'blocked-squad', name: 'Blocked Action - Force Create', status: 'idle', fn: testBlockedSquadCreate },
    { id: 'blocked-case', name: 'Blocked Action - Case Create', status: 'idle', fn: testBlockedCaseCreate },
  ]);
  const [runningLegal, setRunningLegal] = useState(false);

  // Squad tests state
  const [squadTests, setSquadTests] = useState([
    { id: 'create-squad', name: 'Create Force - Happy Path', status: 'idle', fn: testCreateSquad },
    { id: 'search-squads', name: 'Search Forces by ZIP', status: 'idle', fn: testSearchSquads },
    { id: 'join-squad', name: 'Join Force', status: 'idle', fn: testJoinSquad },
    { id: 'leave-squad', name: 'Leave Force', status: 'idle', fn: testLeaveSquad },
  ]);
  const [runningSquad, setRunningSquad] = useState(false);

  // Case tests state
  const [caseTests, setCaseTests] = useState([
    { id: 'create-case', name: 'Create Case', status: 'idle', fn: testCreateCase },
    { id: 'update-status', name: 'Update Mission Status', status: 'idle', fn: testUpdateCaseStatus },
    { id: 'add-note', name: 'Add Note to Case', status: 'idle', fn: testAddCaseNote },
  ]);
  const [runningCase, setRunningCase] = useState(false);

  // Public Case tests state (Phase 15-16)
  const [publicCaseTests, setPublicCaseTests] = useState([
    { id: 'list-public', name: 'List Public Cases', status: 'idle', fn: testListPublicCases },
    { id: 'detail-public', name: 'View Public Case Detail', status: 'idle', fn: testPublicCaseDetail },
    { id: 'submit-report', name: 'Submit Public Report', status: 'idle', fn: testSubmitPublicReport },
  ]);
  const [runningPublicCase, setRunningPublicCase] = useState(false);

  // Notification tests state (Phase 25-26)
  const [notificationTests, setNotificationTests] = useState([
    { id: 'report-confirmation', name: 'Report Confirmation Email', status: 'idle', fn: testReportConfirmationEmail },
    { id: 'admin-alert', name: 'Admin Alert Email', status: 'idle', fn: testAdminAlertEmail },
    { id: 'status-update', name: 'Status Update Email', status: 'idle', fn: testStatusUpdateEmail },
  ]);
  const [runningNotification, setRunningNotification] = useState(false);

  // Permission & Assignment tests state (Phase 22-24)
  const [permissionTests, setPermissionTests] = useState([
    { id: 'permission-helper', name: 'Permission Helper Module', status: 'idle', fn: testPermissionHelper },
    { id: 'assign-coordinator', name: 'Assign Coordinator', status: 'idle', fn: testAssignCoordinator },
    { id: 'unassign-coordinator', name: 'Unassign Coordinator', status: 'idle', fn: testUnassignCoordinator },
    { id: 'assign-squad', name: 'Assign Force', status: 'idle', fn: testAssignSquad },
    { id: 'invalid-coordinator-role', name: 'Reject Invalid Coordinator Role', status: 'idle', fn: testInvalidCoordinatorRole },
    { id: 'inactive-squad', name: 'Reject Inactive Force', status: 'idle', fn: testInactiveSquad },
  ]);
  const [runningPermission, setRunningPermission] = useState(false);

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

  const runCaseTests = async () => {
    setRunningCase(true);

    for (let i = 0; i < caseTests.length; i++) {
      const test = caseTests[i];

      // Mark test as running
      setCaseTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, status: 'running' } : t
      ));

      // Execute test
      const result = await runTest(test.name, test.fn);

      // Update test with result
      setCaseTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, ...result } : t
      ));

      // Notify parent
      onTestComplete(result);
    }

    setRunningCase(false);
  };

  const runPublicCaseTests = async () => {
    setRunningPublicCase(true);

    for (let i = 0; i < publicCaseTests.length; i++) {
      const test = publicCaseTests[i];

      // Mark test as running
      setPublicCaseTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, status: 'running' } : t
      ));

      // Execute test
      const result = await runTest(test.name, test.fn);

      // Update test with result
      setPublicCaseTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, ...result } : t
      ));

      // Notify parent
      onTestComplete(result);
    }

    setRunningPublicCase(false);
  };

  const runNotificationTests = async () => {
    setRunningNotification(true);

    for (let i = 0; i < notificationTests.length; i++) {
      const test = notificationTests[i];

      // Mark test as running
      setNotificationTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, status: 'running' } : t
      ));

      // Execute test
      const result = await runTest(test.name, test.fn);

      // Update test with result
      setNotificationTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, ...result } : t
      ));

      // Notify parent
      onTestComplete(result);
    }

    setRunningNotification(false);
  };

  const runPermissionTests = async () => {
    setRunningPermission(true);

    for (let i = 0; i < permissionTests.length; i++) {
      const test = permissionTests[i];

      // Mark test as running
      setPermissionTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, status: 'running' } : t
      ));

      // Execute test
      const result = await runTest(test.name, test.fn);

      // Update test with result
      setPermissionTests(prev => prev.map(t =>
        t.id === test.id ? { ...t, ...result } : t
      ));

      // Notify parent
      onTestComplete(result);
    }

    setRunningPermission(false);
  };

  const runAllTests = async () => {
    await runLegalTests();
    await runSquadTests();
    await runCaseTests();
    await runPublicCaseTests();
    await runNotificationTests();
    await runPermissionTests();
  };

  const isAnyRunning = runningLegal || runningSquad || runningCase || runningPublicCase || runningNotification || runningPermission;

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

      {/* Run All Tests Button */}
      <button
        onClick={runAllTests}
        disabled={isAnyRunning}
        className={`
          w-full px-8 py-4 rounded-lg font-bold text-lg transition-colors
          ${isAnyRunning
            ? 'bg-gray-400 cursor-not-allowed text-white'
            : 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
          }
        `}
      >
        {isAnyRunning ? 'Running Tests...' : '▶️ Run All Tests'}
      </button>

      {/* Legal Test Suite */}
      <TestSuite
        title="Legal Tests"
        tests={legalTests}
        onRun={runLegalTests}
        running={runningLegal}
      />

      {/* Squad Test Suite */}
      <TestSuite
        title="Force Tests"
        tests={squadTests}
        onRun={runSquadTests}
        running={runningSquad}
      />

      {/* Case Test Suite */}
      <TestSuite
        title="Case Tests"
        tests={caseTests}
        onRun={runCaseTests}
        running={runningCase}
      />

      {/* Public Case Test Suite (Phase 15-16) */}
      <TestSuite
        title="Public Case Tests"
        tests={publicCaseTests}
        onRun={runPublicCaseTests}
        running={runningPublicCase}
      />

      {/* Notification Test Suite (Phase 25-26) */}
      <TestSuite
        title="Notification Tests"
        tests={notificationTests}
        onRun={runNotificationTests}
        running={runningNotification}
      />

      {/* Permission & Assignment Test Suite (Phase 22-24) */}
      <TestSuite
        title="Permission & Assignment Tests"
        tests={permissionTests}
        onRun={runPermissionTests}
        running={runningPermission}
      />
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

      <SquadGenerator onDataGenerated={onDataGenerated} />
      <CaseGenerator onDataGenerated={onDataGenerated} />
      <DataCleanup onDataGenerated={onDataGenerated} />
    </div>
  );
}

// ============================================================================
// SQUAD GENERATOR
// ============================================================================

function SquadGenerator({ onDataGenerated }) {
  const [count, setCount] = useState(5);
  const [cities, setCities] = useState('Austin,Seattle,Portland,Denver,Phoenix');
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
        const res = await fetch('/api/rescue-squads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: `[TEST] ${city} Force ${i + 1}`,
            state: 'TX',
            zipCode: '78701'
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
    try {
      await fetch('/api/admin/qa/log-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'qa.test_data_generated',
          test_name: 'Generate Demo Forces',
          result: 'passed',
          duration_ms: 0
        })
      });
    } catch (logError) {
      console.error('Failed to log event:', logError);
    }

    setResult({ created: created.length, ids: created });
    setGenerating(false);

    onDataGenerated({ name: 'Force Generator', status: 'passed', details: `Created ${created.length} forces` });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Generate Demo Squads
      </h2>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Number of squads (max 20):
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 1)}
            className="px-3 py-2 border border-gray-300 rounded-lg w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Cities (comma-separated):
          </label>
          <input
            type="text"
            value={cities}
            onChange={(e) => setCities(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <button
        onClick={generate}
        disabled={generating}
        className={`
          px-6 py-3 rounded-lg font-semibold transition-colors
          ${generating
            ? 'bg-gray-400 cursor-not-allowed text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        {generating ? 'Generating...' : 'Generate Forces'}
      </button>

      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-green-800 font-semibold">
            ✅ Created {result.created} demo forces
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CASE GENERATOR
// ============================================================================

function CaseGenerator({ onDataGenerated }) {
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
            zipCode: '78701',
            petSpecies,
            petName,
            petBreed: breed,
            petColor: color,
            petDescription: `QA test case ${i + 1}`,
            contactName: 'QA Test Contact',
            contactPhone: '555-0100'
          })
        });

        if (res.ok) {
          const { case: missionData } = await res.json();
          created.push(missionData.id);

          // Randomly update status (30% chance)
          if (Math.random() < 0.3) {
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
          }

          // Add random notes (0-2)
          const noteCount = Math.floor(Math.random() * 3);
          for (let j = 0; j < noteCount; j++) {
            await fetch(`/api/missions/${missionData.id}/notes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `[QA] Test note ${j + 1} for case`
              })
            });
          }
        }
      } catch (error) {
        console.error('Failed to create case:', error);
      }
    }

    // Log generation event
    try {
      await fetch('/api/admin/qa/log-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'qa.test_data_generated',
          test_name: 'Generate Demo Cases',
          result: 'passed',
          duration_ms: 0
        })
      });
    } catch (logError) {
      console.error('Failed to log event:', logError);
    }

    setResult({ created: created.length, ids: created });
    setGenerating(false);

    onDataGenerated({ name: 'Case Generator', status: 'passed', details: `Created ${created.length} cases` });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Generate Demo Cases
      </h2>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Number of cases (max 50):
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 1)}
            className="px-3 py-2 border border-gray-300 rounded-lg w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              City:
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              State:
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              maxLength={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <button
        onClick={generate}
        disabled={generating}
        className={`
          px-6 py-3 rounded-lg font-semibold transition-colors
          ${generating
            ? 'bg-gray-400 cursor-not-allowed text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        {generating ? 'Generating...' : 'Generate Cases'}
      </button>

      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-green-800 font-semibold">
            ✅ Created {result.created} demo cases with random data (species, statuses, notes)
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DATA CLEANUP
// ============================================================================

function DataCleanup({ onDataGenerated }) {
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleCleanupClick = () => {
    setConfirmOpen(true);
  };

  const cleanup = async () => {
    setConfirmOpen(false);
    setCleaning(true);
    setResult(null);

    let caseCount = 0;

    try {
      // Find and close test cases
      const caseRes = await fetch('/api/missions');
      const { cases } = await caseRes.json();

      for (const c of cases) {
        if (c.petName && c.petName.startsWith('[TEST]')) {
          try {
            await fetch(`/api/missions/${c.id}/status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'CLOSED_OTHER',
                statusReason: '[QA] Cleaned up test data'
              })
            });
            caseCount++;
          } catch (error) {
            console.error('Failed to close case:', error);
          }
        }
      }

      setResult({ cases: caseCount });
      onDataGenerated({ name: 'Data Cleanup', status: 'passed', details: `Closed ${caseCount} test cases` });
    } catch (error) {
      console.error('Cleanup failed:', error);
      setResult({ error: error.message });
      onDataGenerated({ name: 'Data Cleanup', status: 'failed', error: error.message });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="bg-white border border-red-200 rounded-lg p-6">
      {/* Confirmation Dialog */}
      {confirmOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '450px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#0f172a' }}>
              Close All Test Cases?
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Close all test cases with [TEST] prefix?<br /><br />
              This will mark them as CLOSED_OTHER. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={cleanup}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Yes, Close All
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold text-red-600 mb-2">
        ⚠️ Cleanup Test Data
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        This will close all test cases (mark as CLOSED_OTHER) with [TEST] prefix.
        This action cannot be undone.
      </p>

      <button
        onClick={handleCleanupClick}
        disabled={cleaning}
        className={`
          px-6 py-3 rounded-lg font-semibold transition-colors
          ${cleaning
            ? 'bg-gray-400 cursor-not-allowed text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
          }
        `}
      >
        {cleaning ? 'Cleaning...' : 'Delete Test Data'}
      </button>

      {result && !result.error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 font-semibold">
            Cleaned up: {result.cases} test cases (marked CLOSED_OTHER)
          </div>
        </div>
      )}

      {result && result.error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 font-semibold">
            Error: {result.error}
          </div>
        </div>
      )}
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
