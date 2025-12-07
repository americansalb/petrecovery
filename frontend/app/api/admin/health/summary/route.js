/**
 * Admin Health Check Summary Endpoint
 * TASK-002: Backend summary of service health for DB + geocoding + email
 *
 * Per admin-health-dashboard.md:
 * - Enforces admin-only access
 * - Checks DB, geocoding, and email health in parallel
 * - Emits structured events via logEvent()
 * - Returns service status array
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { geocodeZipCode } from '@/app/lib/geocoding';
import { logEvent } from '@/lib/logging';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/health/summary
 * Returns health status for all critical services
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
        event_type: 'admin.health_check_unauthorized',
        resource_type: 'system',
        action: 'read',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'User attempted to access admin health endpoint without admin role',
        metadata: {
          user_id: session?.user?.id || 'anonymous',
          user_role: session?.user?.role || 'none'
        }
      });

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ [Admin Health] Starting health checks for admin:', session.user.email);

    // ============================================================================
    // PARALLEL HEALTH CHECKS
    // ============================================================================
    const [dbResult, geocodingResult, emailResult] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkGeocodingHealth(),
      checkEmailHealth()
    ]);

    // Process results
    const services = [
      processHealthResult('database', dbResult),
      processHealthResult('geocoding', geocodingResult),
      processHealthResult('email', emailResult)
    ];

    const allHealthy = services.every(s => s.status === 'healthy');
    const overallStatus = allHealthy ? 'healthy' : 'degraded';

    const responseTime = Date.now() - startTime;

    // ============================================================================
    // EVENT LOGGING
    // ============================================================================
    logEvent({
      event_type: 'admin.health_check_viewed',
      resource_type: 'system',
      action: 'read',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: 'ADMIN',
      metadata: {
        overall_status: overallStatus,
        response_time_ms: responseTime,
        services_checked: services.length,
        healthy_count: services.filter(s => s.status === 'healthy').length
      }
    });

    console.log(`✅ [Admin Health] Health check complete in ${responseTime}ms - Status: ${overallStatus}`);

    // ============================================================================
    // RESPONSE
    // ============================================================================
    return NextResponse.json({
      overall_status: overallStatus,
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      services
    });

  } catch (error) {
    console.error('❌ [Admin Health] Unexpected error during health check:', error);

    logEvent({
      event_type: 'admin.health_check_failed',
      resource_type: 'system',
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: 'ADMIN',
      metadata: {
        error_stack: error.stack?.substring(0, 500) // Truncate stack trace
      }
    });

    return NextResponse.json({
      error: 'Health check failed',
      message: error.message
    }, { status: 500 });
  }
}

// ============================================================================
// HEALTH CHECK FUNCTIONS
// ============================================================================

/**
 * Check database connectivity and basic query performance
 */
async function checkDatabaseHealth() {
  const startTime = Date.now();

  try {
    // Simple query to verify DB connection
    const result = await prisma.$queryRaw`SELECT 1 as value`;
    const responseTime = Date.now() - startTime;

    // Also check a real query (count users)
    const userCount = await prisma.user.count();

    console.log(`✅ [Health] Database check passed (${responseTime}ms, ${userCount} users)`);

    return {
      status: 'healthy',
      response_time_ms: responseTime,
      details: {
        connection: 'ok',
        user_count: userCount
      }
    };
  } catch (error) {
    console.error('❌ [Health] Database check failed:', error.message);

    return {
      status: 'unhealthy',
      response_time_ms: Date.now() - startTime,
      error: error.message,
      details: {
        connection: 'failed'
      }
    };
  }
}

/**
 * Check geocoding service with a fixed test input
 */
async function checkGeocodingHealth() {
  const startTime = Date.now();
  const testZip = '78701'; // Austin, TX - known good ZIP

  try {
    const result = await geocodeZipCode(testZip);
    const responseTime = Date.now() - startTime;

    if (result.error) {
      console.error(`❌ [Health] Geocoding check failed: ${result.error}`);
      return {
        status: 'unhealthy',
        response_time_ms: responseTime,
        error: result.error,
        details: {
          test_zip: testZip,
          resolution: 'failed'
        }
      };
    }

    console.log(`✅ [Health] Geocoding check passed (${responseTime}ms, resolved to ${result.cityName}, ${result.state})`);

    return {
      status: 'healthy',
      response_time_ms: responseTime,
      details: {
        test_zip: testZip,
        resolved_city: result.cityName,
        resolved_state: result.state,
        resolution: 'ok'
      }
    };
  } catch (error) {
    console.error('❌ [Health] Geocoding check failed:', error.message);

    return {
      status: 'unhealthy',
      response_time_ms: Date.now() - startTime,
      error: error.message,
      details: {
        test_zip: testZip,
        resolution: 'failed'
      }
    };
  }
}

/**
 * Check email service configuration
 * Note: Does NOT send test email - just checks if service is configured
 */
async function checkEmailHealth() {
  const startTime = Date.now();

  try {
    // Check if email environment variables are configured
    const isConfigured = !!(
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASSWORD
    );

    const responseTime = Date.now() - startTime;

    if (!isConfigured) {
      console.log('⚠️  [Health] Email service not configured (missing EMAIL_USER or EMAIL_PASSWORD)');

      return {
        status: 'not_configured',
        response_time_ms: responseTime,
        details: {
          service: process.env.EMAIL_SERVICE || 'not set',
          user_set: !!process.env.EMAIL_USER,
          password_set: !!process.env.EMAIL_PASSWORD,
          message: 'Email service requires EMAIL_USER and EMAIL_PASSWORD environment variables'
        }
      };
    }

    console.log('✅ [Health] Email service configured');

    return {
      status: 'healthy',
      response_time_ms: responseTime,
      details: {
        service: process.env.EMAIL_SERVICE || 'default',
        user: process.env.EMAIL_USER,
        configured: true,
        message: 'Email service is configured. Use test endpoint to verify sending.'
      }
    };
  } catch (error) {
    console.error('❌ [Health] Email health check failed:', error.message);

    return {
      status: 'unhealthy',
      response_time_ms: Date.now() - startTime,
      error: error.message,
      details: {
        configured: false
      }
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Process Promise.allSettled result into consistent format
 */
function processHealthResult(serviceName, settledResult) {
  if (settledResult.status === 'fulfilled') {
    return {
      service: serviceName,
      ...settledResult.value
    };
  } else {
    // Promise was rejected
    return {
      service: serviceName,
      status: 'unhealthy',
      error: settledResult.reason?.message || 'Unknown error',
      details: {}
    };
  }
}
