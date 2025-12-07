/**
 * Admin Health - Test Geocoding Endpoint
 * TASK-005: Test geocoding flow with admin-provided input
 *
 * Per admin-health-dashboard.md:
 * - Accepts city or ZIP code input
 * - Returns resolved city info or error details
 * - Logs test execution event
 * - Admin-only access
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { geocodeZipCode } from '@/app/lib/geocoding';
import { getZipCodeInfo } from '@/lib/zip-city-mapping';
import { logEvent } from '@/lib/logging';

/**
 * POST /api/admin/health/test-geocode
 * Body: { "query": "78701" } or { "query": "Austin, TX" }
 * Tests geocoding resolution with provided input
 */
export async function POST(request) {
  const startTime = Date.now();

  try {
    // ============================================================================
    // AUTHENTICATION CHECK
    // ============================================================================
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      logEvent({
        event_type: 'admin.test_geocode_unauthorized',
        resource_type: 'system',
        action: 'read',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'User attempted to test geocoding without admin role',
        metadata: {
          user_id: session?.user?.id || 'anonymous',
          user_role: session?.user?.role || 'none'
        }
      });

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ============================================================================
    // PARSE REQUEST BODY
    // ============================================================================
    const body = await request.json();
    const query = body.query?.trim();

    if (!query) {
      logEvent({
        event_type: 'admin.test_geocode_run',
        resource_type: 'system',
        action: 'read',
        result: 'failure',
        error_code: 'INVALID_INPUT',
        error_message: 'No query provided',
        actor_user_id: session.user.id,
        actor_role: 'ADMIN'
      });

      return NextResponse.json({
        error: 'Query is required',
        message: 'Please provide a ZIP code or city name'
      }, { status: 400 });
    }

    console.log(`🧪 [Admin Test Geocode] Testing query: "${query}"`);

    // ============================================================================
    // ATTEMPT GEOCODING
    // ============================================================================

    let result;
    let method;
    let success = false;
    let errorDetails = null;

    // Check if input looks like a ZIP code (5 digits)
    const zipPattern = /^\d{5}$/;
    const isZip = zipPattern.test(query);

    if (isZip) {
      console.log('   → Detected ZIP code format');

      // Try local ZIP mapping first
      const localResult = getZipCodeInfo(query);

      if (localResult && localResult.city) {
        console.log(`   ✅ Resolved via local mapping: ${localResult.city}, ${localResult.state}`);
        result = localResult;
        method = 'local_zip_mapping';
        success = true;
      } else {
        console.log('   → Not in local mapping, trying external geocoding...');

        // Try external geocoding
        const geocodeResult = await geocodeZipCode(query);

        if (geocodeResult.error) {
          console.log(`   ❌ External geocoding failed: ${geocodeResult.error}`);
          result = geocodeResult;
          method = 'external_geocoding_api';
          success = false;
          errorDetails = geocodeResult.error;
        } else {
          console.log(`   ✅ Resolved via external API: ${geocodeResult.cityName}, ${geocodeResult.state}`);
          result = {
            zipCode: geocodeResult.zipCode,
            city: geocodeResult.cityName,
            state: geocodeResult.state,
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude,
            fullAddress: geocodeResult.fullAddress
          };
          method = 'external_geocoding_api';
          success = true;
        }
      }
    } else {
      // Assume it's a city/state query
      console.log('   → Detected city/state format, using external geocoding...');

      // For city queries, we'd need a different geocoding function
      // For now, return a helpful message
      result = {
        message: 'City-based geocoding not yet implemented in test tool',
        suggestion: 'Use a 5-digit ZIP code for testing',
        query: query
      };
      method = 'not_supported';
      success = false;
      errorDetails = 'City queries not yet supported in test tool';
    }

    const responseTime = Date.now() - startTime;

    // ============================================================================
    // EVENT LOGGING
    // ============================================================================
    logEvent({
      event_type: 'admin.test_geocode_run',
      resource_type: 'system',
      action: 'read',
      result: success ? 'success' : 'failure',
      actor_user_id: session.user.id,
      actor_role: 'ADMIN',
      error_code: success ? null : (errorDetails ? 'GEOCODING_FAILED' : 'NOT_SUPPORTED'),
      error_message: success ? null : errorDetails,
      metadata: {
        query: query,
        method: method,
        is_zip: isZip,
        response_time_ms: responseTime
      }
    });

    console.log(`🧪 [Admin Test Geocode] Test complete in ${responseTime}ms - ${success ? 'Success' : 'Failed'}`);

    // ============================================================================
    // RESPONSE
    // ============================================================================
    return NextResponse.json({
      success,
      query,
      method,
      result,
      response_time_ms: responseTime
    });

  } catch (error) {
    console.error('❌ [Admin Test Geocode] Unexpected error:', error);

    logEvent({
      event_type: 'admin.test_geocode_run',
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
      error: 'Test geocoding failed',
      message: error.message
    }, { status: 500 });
  }
}
