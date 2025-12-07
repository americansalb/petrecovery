import { NextResponse } from 'next/server';
import { TASK_DEFINITIONS } from '@/lib/taskDefinitions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/definitions
 * Returns all task definitions for the UI
 */
export async function GET() {
  try {
    return NextResponse.json({
      tasks: TASK_DEFINITIONS,
    });
  } catch (error) {
    console.error('Error fetching task definitions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task definitions' },
      { status: 500 }
    );
  }
}
