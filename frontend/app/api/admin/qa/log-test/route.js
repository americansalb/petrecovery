import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logEvent } from '@/lib/logging';

/**
 * POST /api/admin/qa/log-test - Log QA test execution events
 *
 * Used by Admin QA Harness to emit structured events for test executions.
 * All QA events are logged with qa.* event types for observability.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    // Admin-only endpoint
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event_type, test_name, result, duration_ms, error } = await request.json();

    // Log the QA test event
    await logEvent({
      event_type: event_type || 'qa.test_executed',
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
  } catch (error) {
    console.error('Failed to log QA test event:', error);
    return NextResponse.json(
      { error: 'Failed to log test event', logged: false },
      { status: 500 }
    );
  }
}
