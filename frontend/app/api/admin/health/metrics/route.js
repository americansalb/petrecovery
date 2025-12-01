/**
 * Admin Health - Metrics Endpoint
 * TASK-004: Key operational metrics for admin dashboard
 *
 * Per admin-health-dashboard.md:
 * - Returns total counts for: users, cities, rescue squads
 * - Admin-only access
 * - Simple stat cards on dashboard
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/health/metrics
 * Returns key operational metrics
 */
export async function GET(request) {
  const startTime = Date.now();
  let session = null;

  try {
    // ============================================================================
    // AUTHENTICATION CHECK
    // ============================================================================
    session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      logEvent({
        event_type: 'admin.metrics_view_unauthorized',
        resource_type: 'system',
        action: 'read',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'User attempted to view metrics without admin role',
        metadata: {
          user_id: session?.user?.id || 'anonymous',
          user_role: session?.user?.role || 'none'
        }
      });

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ [Admin Metrics] Fetching operational metrics for admin:', session.user.email);

    // ============================================================================
    // FETCH METRICS IN PARALLEL
    // ============================================================================

    const [
      usersTotal,
      rescueSquadsTotal,
      rescueSquadsActive,
      uniqueCities,
      casesTotal,
      casesOpen,
      casesActiveSearch
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Total rescue squads
      prisma.rescueSquad.count(),

      // Active rescue squads (isActive = true)
      prisma.rescueSquad.count({
        where: { isActive: true }
      }),

      // Unique cities (from rescue squads with city/state)
      prisma.rescueSquad.findMany({
        where: {
          city: { not: null },
          state: { not: null }
        },
        select: {
          city: true,
          state: true
        },
        distinct: ['city', 'state']
      }),

      // Cases (using Case model)
      prisma.case.count(),

      // Cases with ACTIVE status
      prisma.case.count({
        where: { status: 'ACTIVE' }
      }),

      // Cases with IN_PROGRESS status
      prisma.case.count({
        where: { status: 'IN_PROGRESS' }
      })
    ]);

    const citiesTotal = uniqueCities.length;

    // Additional metrics (can be expanded in future)
    const squadMembersTotal = await prisma.rescueSquadMember.count();
    const activeSquadMembers = await prisma.rescueSquadMember.count({
      where: { isActive: true }
    });

    const responseTime = Date.now() - startTime;

    console.log(`📊 [Admin Metrics] Fetched metrics in ${responseTime}ms:`);
    console.log(`   - Users: ${usersTotal}`);
    console.log(`   - Cities: ${citiesTotal}`);
    console.log(`   - Rescue Squads: ${rescueSquadsTotal} (${rescueSquadsActive} active)`);
    console.log(`   - Squad Members: ${squadMembersTotal} (${activeSquadMembers} active)`);
    console.log(`   - Cases: ${casesTotal} (${casesOpen} active, ${casesActiveSearch} in progress)`);

    // ============================================================================
    // EVENT LOGGING
    // ============================================================================
    logEvent({
      event_type: 'admin.metrics_viewed',
      resource_type: 'system',
      action: 'read',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: 'ADMIN',
      metadata: {
        users_total: usersTotal,
        cities_total: citiesTotal,
        rescue_squads_total: rescueSquadsTotal,
        cases_total: casesTotal,
        cases_open: casesOpen,
        cases_active_search: casesActiveSearch,
        response_time_ms: responseTime
      }
    });

    // ============================================================================
    // RESPONSE
    // ============================================================================
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      metrics: {
        // Core metrics (Phase 0 requirements)
        users_total: usersTotal,
        cities_total: citiesTotal,
        rescue_squads_total: rescueSquadsTotal,

        // Additional context
        rescue_squads_active: rescueSquadsActive,
        squad_members_total: squadMembersTotal,
        squad_members_active: activeSquadMembers,

        // Phase 13-14: Lost Pet Cases
        cases_total: casesTotal,
        cases_open: casesOpen,
        cases_active_search: casesActiveSearch,

        // Future expansion placeholders
        // sightings_total: 0,       // Phase 15+
        // notifications_total: 0,   // Phase 25+
      }
    });

  } catch (error) {
    console.error('❌ [Admin Metrics] Failed to fetch metrics:', error);

    logEvent({
      event_type: 'admin.metrics_view_failed',
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
      error: 'Failed to fetch metrics',
      message: error.message
    }, { status: 500 });
  }
}
