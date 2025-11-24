/**
 * Admin Health - Error Samples Endpoint
 * TASK-003: Fetch sample events for a specific error type
 *
 * Per admin-health-dashboard.md:
 * - Returns up to N sample events for a given event_type + error_code
 * - Includes full event details (correlation_id, metadata, etc.)
 * - Admin-only access
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

/**
 * GET /api/admin/health/errors/[eventType]/[errorCode]/samples?limit=10&since=...
 * Returns sample events for the specified error type
 */
export async function GET(request, { params }) {
  const startTime = Date.now();

  try {
    // ============================================================================
    // AUTHENTICATION CHECK
    // ============================================================================
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      logEvent({
        event_type: 'admin.error_samples_unauthorized',
        resource_type: 'system',
        action: 'read',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'User attempted to view error samples without admin role',
        metadata: {
          user_id: session?.user?.id || 'anonymous',
          user_role: session?.user?.role || 'none'
        }
      });

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ============================================================================
    // PARSE PARAMETERS
    // ============================================================================
    const { eventType, errorCode } = params;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '10');
    const sinceParam = searchParams.get('since');
    const since = sinceParam
      ? new Date(sinceParam)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24h

    console.log(`✅ [Admin Error Samples] Fetching samples for ${eventType}:${errorCode}, limit ${limit}`);

    // ============================================================================
    // QUERY SAMPLE EVENTS
    // ============================================================================

    // Handle UNKNOWN error code (null in database)
    const errorCodeFilter = errorCode === 'UNKNOWN' ? null : errorCode;

    const sampleEvents = await prisma.eventLog.findMany({
      where: {
        event_type: eventType,
        error_code: errorCodeFilter,
        result: 'failure',
        timestamp: {
          gte: since
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      select: {
        id: true,
        timestamp: true,
        correlation_id: true,
        actor_user_id: true,
        actor_role: true,
        resource_type: true,
        resource_id: true,
        action: true,
        result: true,
        error_code: true,
        error_message: true,
        metadata: true
      }
    });

    console.log(`📋 [Admin Error Samples] Found ${sampleEvents.length} sample events`);

    // Parse metadata JSON for each event
    const parsedSamples = sampleEvents.map(event => ({
      ...event,
      metadata: event.metadata ? JSON.parse(event.metadata) : {}
    }));

    const responseTime = Date.now() - startTime;

    // ============================================================================
    // EVENT LOGGING
    // ============================================================================
    logEvent({
      event_type: 'admin.error_samples_viewed',
      resource_type: 'system',
      action: 'read',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: 'ADMIN',
      metadata: {
        queried_event_type: eventType,
        queried_error_code: errorCode,
        samples_returned: sampleEvents.length,
        response_time_ms: responseTime
      }
    });

    // ============================================================================
    // RESPONSE
    // ============================================================================
    return NextResponse.json({
      event_type: eventType,
      error_code: errorCode,
      since: since.toISOString(),
      limit,
      count: sampleEvents.length,
      samples: parsedSamples,
      response_time_ms: responseTime
    });

  } catch (error) {
    console.error('❌ [Admin Error Samples] Failed to fetch samples:', error);

    logEvent({
      event_type: 'admin.error_samples_failed',
      resource_type: 'system',
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: 'ADMIN',
      metadata: {
        queried_event_type: params.eventType,
        queried_error_code: params.errorCode,
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to fetch error samples',
      message: error.message
    }, { status: 500 });
  }
}
