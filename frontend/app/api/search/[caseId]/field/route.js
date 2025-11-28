/**
 * Field Mode API
 * Real-time searching interface for volunteers in the field
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  startFieldMode,
  updateLocation,
  handleFieldAction,
} from '@/app/lib/volunteer/fieldMode';

export async function GET(request, { params }) {
  try {
    const { caseId } = params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const result = await startFieldMode(sessionId, null);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Field mode start error:', error);
    return NextResponse.json(
      { error: 'Failed to start field mode' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { sessionId, action, data, location } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Handle location update
    if (action === 'UPDATE_LOCATION') {
      if (!location) {
        return NextResponse.json(
          { error: 'Location required' },
          { status: 400 }
        );
      }
      const result = await updateLocation(sessionId, location);
      return NextResponse.json(result);
    }

    // Handle field actions
    if (action) {
      const result = await handleFieldAction(sessionId, action, {
        ...data,
        location,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Action required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Field action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
