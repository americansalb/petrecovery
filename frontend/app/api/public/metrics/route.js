/**
 * Public Metrics API - Phase 0.2
 * GET /api/public/metrics
 *
 * Returns platform-wide metrics for display on public pages.
 * No authentication required.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Cache metrics for 5 minutes (in memory)
let metricsCache = null;
let metricsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request) {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  // Apply rate limiting for public reads
  const rateLimitResult = withRateLimit(request, RateLimitPresets.PUBLIC_READ, 'public:metrics');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  console.log('[PUBLIC-METRICS] Request received');

  try {
    // Check cache
    const now = Date.now();
    if (metricsCache && (now - metricsCacheTime) < CACHE_TTL) {
      console.log('[PUBLIC-METRICS] Returning cached metrics');
      console.log(`[PUBLIC-METRICS] Cache age: ${Math.round((now - metricsCacheTime) / 1000)}s`);

      return NextResponse.json({
        ...metricsCache,
        cached: true,
        cache_age_seconds: Math.round((now - metricsCacheTime) / 1000)
      });
    }

    console.log('[PUBLIC-METRICS] Cache miss - fetching fresh metrics');

    // Fetch metrics from database
    console.log('[PUBLIC-METRICS] Querying database...');

    // Count reunited cases (pets reunited)
    console.log('[PUBLIC-METRICS] Counting reunited cases...');
    const reunitedCases = await prisma.case.count({
      where: { status: 'REUNITED' }
    });
    console.log(`[PUBLIC-METRICS] Reunited cases: ${reunitedCases}`);

    // Total pets reunited
    const totalReunited = reunitedCases;
    console.log(`[PUBLIC-METRICS] Total reunited: ${totalReunited}`);

    // Count total users
    console.log('[PUBLIC-METRICS] Counting users...');
    const totalUsers = await prisma.user.count();
    console.log(`[PUBLIC-METRICS] Total users: ${totalUsers}`);

    // Count active rescue squads
    console.log('[PUBLIC-METRICS] Counting active rescue squads...');
    const activeSquads = await prisma.rescueSquad.count({
      where: { isActive: true }
    });
    console.log(`[PUBLIC-METRICS] Active squads: ${activeSquads}`);

    // Count total squad members
    console.log('[PUBLIC-METRICS] Counting squad members...');
    const totalSquadMembers = await prisma.rescueSquadMember.count({
      where: { isActive: true }
    });
    console.log(`[PUBLIC-METRICS] Total squad members: ${totalSquadMembers}`);

    // Count open/active cases
    console.log('[PUBLIC-METRICS] Counting open cases...');
    const openCases = await prisma.case.count({
      where: {
        status: { in: ['ACTIVE', 'IN_PROGRESS'] }
      }
    });
    console.log(`[PUBLIC-METRICS] Open cases: ${openCases}`);

    // Count cities with squads
    console.log('[PUBLIC-METRICS] Counting cities with squads...');
    const citiesWithSquads = await prisma.rescueSquad.groupBy({
      by: ['city', 'state'],
      where: { isActive: true },
      _count: true
    });
    const uniqueCities = citiesWithSquads.length;
    console.log(`[PUBLIC-METRICS] Cities with squads: ${uniqueCities}`);

    // Build metrics object
    const metrics = {
      pets_reunited: totalReunited,
      total_users: totalUsers,
      active_squads: activeSquads,
      total_volunteers: totalSquadMembers,
      open_cases: openCases,
      cities_covered: uniqueCities,
      timestamp: new Date().toISOString()
    };

    // Update cache
    metricsCache = metrics;
    metricsCacheTime = now;
    console.log('[PUBLIC-METRICS] Cache updated');

    const responseTime = Date.now() - startTime;
    console.log(`[PUBLIC-METRICS] Response time: ${responseTime}ms`);

    // Log event
    await logEvent({
      event_type: 'public.metrics_fetched',
      correlation_id: correlationId,
      resource_type: 'metrics',
      action: 'read',
      result: 'success',
      actor_role: null, // anonymous public user
      metadata: {
        pets_reunited: totalReunited,
        total_users: totalUsers,
        active_squads: activeSquads,
        response_time_ms: responseTime
      }
    });

    console.log('========================================');
    console.log('[PUBLIC-METRICS] Request completed successfully');
    console.log(`[PUBLIC-METRICS] Metrics: ${JSON.stringify(metrics)}`);
    console.log('========================================');

    return NextResponse.json({
      ...metrics,
      cached: false,
      response_time_ms: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('========================================');
    console.error('[PUBLIC-METRICS] FATAL ERROR');
    console.error(`[PUBLIC-METRICS] Error: ${error.message}`);
    console.error(`[PUBLIC-METRICS] Stack: ${error.stack}`);
    console.error('========================================');

    await logEvent({
      event_type: 'public.metrics_failed',
      correlation_id: correlationId,
      resource_type: 'metrics',
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_role: null, // anonymous public user
      metadata: {
        error_stack: error.stack?.substring(0, 500),
        response_time_ms: responseTime
      }
    });

    // Return fallback metrics with zeros
    return NextResponse.json({
      pets_reunited: 0,
      total_users: 0,
      active_squads: 0,
      total_volunteers: 0,
      open_cases: 0,
      cities_covered: 0,
      timestamp: new Date().toISOString(),
      error: true,
      error_message: 'Unable to fetch metrics'
    });
  }
}
