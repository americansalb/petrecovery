/**
 * Admin Health - Error Aggregation Endpoint
 * TASK-003: Aggregated error events for admin dashboard
 *
 * Per admin-health-dashboard.md:
 * - Returns errors grouped by event_type + error_code
 * - Shows count and last_seen_at for each group
 * - Time filtering (default: last 24h)
 * - Admin-only access
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

/**
 * GET /api/admin/health/errors?since=<timestamp>&limit=<number>
 * Returns aggregated error events grouped by event_type and error_code
 */
export async function GET(request) {
  const startTime = Date.now();

  try {
    // ============================================================================
    // AUTHENTICATION CHECK
    // ============================================================================
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      logEvent({
        event_type: 'admin.errors_view_unauthorized',
        resource_type: 'system',
        action: 'read',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'User attempted to view error logs without admin role',
        metadata: {
          user_id: session?.user?.id || 'anonymous',
          user_role: session?.user?.role || 'none'
        }
      });

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ============================================================================
    // PARSE QUERY PARAMETERS
    // ============================================================================
    const { searchParams } = new URL(request.url);

    // Default: last 24 hours
    const sinceParam = searchParams.get('since');
    const since = sinceParam
      ? new Date(sinceParam)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const limit = parseInt(searchParams.get('limit') || '100');

    console.log(`✅ [Admin Errors] Fetching error aggregation since ${since.toISOString()}, limit ${limit}`);

    // ============================================================================
    // QUERY ERROR EVENTS
    // ============================================================================

    // First, get all failure events in the time window
    const failureEvents = await prisma.eventLog.findMany({
      where: {
        result: 'failure',
        timestamp: {
          gte: since
        }
      },
      select: {
        event_type: true,
        error_code: true,
        timestamp: true
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    console.log(`📊 [Admin Errors] Found ${failureEvents.length} failure events`);

    // ============================================================================
    // AGGREGATE BY EVENT_TYPE + ERROR_CODE
    // ============================================================================

    const aggregationMap = new Map();

    for (const event of failureEvents) {
      const key = `${event.event_type}:${event.error_code || 'UNKNOWN'}`;

      if (!aggregationMap.has(key)) {
        aggregationMap.set(key, {
          event_type: event.event_type,
          error_code: event.error_code || 'UNKNOWN',
          count: 0,
          last_seen_at: event.timestamp
        });
      }

      const entry = aggregationMap.get(key);
      entry.count++;

      // Update last_seen_at if this event is more recent
      if (event.timestamp > entry.last_seen_at) {
        entry.last_seen_at = event.timestamp;
      }
    }

    // Convert map to array and sort by count (descending)
    const aggregatedErrors = Array.from(aggregationMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    console.log(`📋 [Admin Errors] Aggregated into ${aggregatedErrors.length} unique error types`);

    const responseTime = Date.now() - startTime;

    // ============================================================================
    // EVENT LOGGING
    // ============================================================================
    logEvent({
      event_type: 'admin.errors_viewed',
      resource_type: 'system',
      action: 'read',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: 'ADMIN',
      metadata: {
        since: since.toISOString(),
        total_failures: failureEvents.length,
        unique_error_types: aggregatedErrors.length,
        response_time_ms: responseTime
      }
    });

    // ============================================================================
    // RESPONSE
    // ============================================================================
    return NextResponse.json({
      since: since.toISOString(),
      total_failures: failureEvents.length,
      unique_error_types: aggregatedErrors.length,
      errors: aggregatedErrors,
      response_time_ms: responseTime
    });

  } catch (error) {
    console.error('❌ [Admin Errors] Failed to fetch error aggregation:', error);

    logEvent({
      event_type: 'admin.errors_view_failed',
      resource_type: 'system',
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: 'ADMIN',
      metadata: {
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to fetch error aggregation',
      message: error.message
    }, { status: 500 });
  }
}
