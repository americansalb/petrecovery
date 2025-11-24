/**
 * Unit tests for logging utility
 * Run with: node --experimental-modules lib/__tests__/logging.test.js
 *
 * TODO: Integrate with proper test framework (Jest/Vitest) in TASK-010
 */

import { logEvent, getCorrelationId, createEventContext, EventLogger } from '../logging.js';

// Test counter
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertThrows(fn, message) {
  try {
    fn();
    throw new Error(message || 'Expected function to throw');
  } catch (error) {
    if (error.message === message || error.message.startsWith('logEvent:')) {
      // Expected error
      return;
    }
    throw error;
  }
}

console.log('\n🧪 Running logging utility tests...\n');

// Test 1: Basic successful event
test('emits basic successful event', () => {
  const event = logEvent({
    event_type: 'test.event',
    resource_type: 'test',
    action: 'create',
    result: 'success',
  });

  assert(event.event_type === 'test.event', 'event_type should match');
  assert(event.result === 'success', 'result should be success');
  assert(event.timestamp, 'timestamp should be auto-generated');
  assert(event.correlation_id, 'correlation_id should be auto-generated');
});

// Test 2: Event with all fields
test('emits event with all fields', () => {
  const event = logEvent({
    event_type: 'squad.created',
    timestamp: '2025-11-24T12:00:00Z',
    correlation_id: 'test-correlation-id',
    actor_user_id: 'user-123',
    actor_role: 'VOLUNTEER',
    resource_type: 'squad',
    resource_id: 'squad-456',
    action: 'create',
    result: 'success',
    metadata: { city: 'Austin', state: 'TX' },
  });

  assert(event.timestamp === '2025-11-24T12:00:00Z', 'custom timestamp preserved');
  assert(event.correlation_id === 'test-correlation-id', 'custom correlation_id preserved');
  assert(event.actor_user_id === 'user-123', 'actor_user_id should match');
  assert(event.actor_role === 'VOLUNTEER', 'actor_role should match');
  assert(event.metadata.city === 'Austin', 'metadata should be preserved');
});

// Test 3: Failure event with error details
test('emits failure event with error details', () => {
  const event = logEvent({
    event_type: 'squad.create_failed',
    resource_type: 'squad',
    action: 'create',
    result: 'failure',
    error_code: 'VALIDATION_ERROR',
    error_message: 'City is required',
    metadata: { attempted_city: null },
  });

  assert(event.result === 'failure', 'result should be failure');
  assert(event.error_code === 'VALIDATION_ERROR', 'error_code should match');
  assert(event.error_message === 'City is required', 'error_message should match');
});

// Test 4: Validates required fields
test('throws on missing event_type', () => {
  assertThrows(() => {
    logEvent({
      resource_type: 'test',
      action: 'create',
      result: 'success',
    });
  });
});

test('throws on missing resource_type', () => {
  assertThrows(() => {
    logEvent({
      event_type: 'test.event',
      action: 'create',
      result: 'success',
    });
  });
});

test('throws on invalid action', () => {
  assertThrows(() => {
    logEvent({
      event_type: 'test.event',
      resource_type: 'test',
      action: 'invalid_action',
      result: 'success',
    });
  });
});

test('throws on invalid result', () => {
  assertThrows(() => {
    logEvent({
      event_type: 'test.event',
      resource_type: 'test',
      action: 'create',
      result: 'maybe',
    });
  });
});

test('throws on invalid actor_role', () => {
  assertThrows(() => {
    logEvent({
      event_type: 'test.event',
      resource_type: 'test',
      action: 'create',
      result: 'success',
      actor_role: 'INVALID_ROLE',
    });
  });
});

// Test 5: Metadata size validation
test('throws on oversized metadata', () => {
  const hugeMetadata = { data: 'x'.repeat(11000) };
  assertThrows(() => {
    logEvent({
      event_type: 'test.event',
      resource_type: 'test',
      action: 'create',
      result: 'success',
      metadata: hugeMetadata,
    });
  });
});

// Test 6: getCorrelationId
test('getCorrelationId generates new ID', () => {
  const id1 = getCorrelationId(null);
  const id2 = getCorrelationId(null);

  assert(id1, 'should generate ID');
  assert(id2, 'should generate ID');
  assert(id1 !== id2, 'IDs should be unique');
});

test('getCorrelationId reuses request ID', () => {
  const req = { _correlationId: 'existing-id' };
  const id = getCorrelationId(req);

  assert(id === 'existing-id', 'should reuse existing ID');
});

test('getCorrelationId reads from header', () => {
  const req = { headers: { 'x-correlation-id': 'header-id' } };
  const id = getCorrelationId(req);

  assert(id === 'header-id', 'should use header ID');
});

// Test 7: createEventContext
test('createEventContext creates context from request', () => {
  const req = { headers: { 'x-correlation-id': 'req-123' } };
  const session = { user: { id: 'user-456' } };
  const context = createEventContext(req, session);

  assert(context.correlation_id === 'req-123', 'correlation_id from request');
  assert(context.actor_user_id === 'user-456', 'actor_user_id from session');
});

test('createEventContext handles missing session', () => {
  const req = {};
  const context = createEventContext(req, null);

  assert(context.correlation_id, 'correlation_id should be generated');
  assert(context.actor_user_id === null, 'actor_user_id should be null');
});

// Test 8: EventLogger helpers
test('EventLogger.success helper', () => {
  const event = EventLogger.success('test.success', 'test', 'test-123', { foo: 'bar' });

  assert(event.result === 'success', 'result should be success');
  assert(event.resource_id === 'test-123', 'resource_id should match');
  assert(event.metadata.foo === 'bar', 'metadata should be included');
});

test('EventLogger.failure helper', () => {
  const event = EventLogger.failure(
    'test.failure',
    'test',
    'ERROR_CODE',
    'Something went wrong',
    { context: 'test' }
  );

  assert(event.result === 'failure', 'result should be failure');
  assert(event.error_code === 'ERROR_CODE', 'error_code should match');
  assert(event.error_message === 'Something went wrong', 'error_message should match');
});

test('EventLogger.admin helper', () => {
  const event = EventLogger.admin('admin.action', 'system', 'admin-123', 'success', {
    action: 'health_check',
  });

  assert(event.actor_role === 'ADMIN', 'actor_role should be ADMIN');
  assert(event.actor_user_id === 'admin-123', 'actor_user_id should match');
  assert(event.result === 'success', 'result should match');
});

// Summary
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
