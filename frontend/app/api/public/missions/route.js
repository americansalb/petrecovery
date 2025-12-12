/**
 * Public Cases API - List & Report
 * Phase 15-16: Public Lost Pet Case Portal MVP (TASK-P02)
 *
 * GET /api/public/missions - List public cases with filters
 * POST /api/public/missions - Submit public lost pet report
 *
 * NO AUTHENTICATION REQUIRED (public endpoints)
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { sendCaseReportConfirmation, sendAdminPublicReportAlert } from '@/app/lib/notifications';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { normalizePhotoUrl } from '@/app/lib/utils';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Phone validation regex
const PHONE_REGEX = /^[\d\s\-\(\)\+\.]{7,20}$/;
// Valid US state codes
const VALID_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

/**
 * GET /api/public/missions - List public lost pet cases
 * Query params: city, state, species, status, page (default 1), limit (default 20, max 100)
 *
 * IMPORTANT: Now queries the main `Case` model to match where /api/reports/create writes data.
 * Shows all ACTIVE LOST cases (not resolved/closed ones).
 */
export async function GET(request) {
  const startTime = Date.now();

  // Apply rate limiting for public reads (lenient)
  const rateLimitResult = withRateLimit(request, RateLimitPresets.PUBLIC_READ, 'public:cases:list');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const species = searchParams.get('species');
    const status = searchParams.get('status');
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Build where clause - Show active LOST cases
    const where = {
      reportType: 'LOST',
      status: status || 'ACTIVE', // Default to ACTIVE cases
    };

    // Filter by city/state from address if provided
    if (city) where.lastSeenAddress = { contains: city, mode: 'insensitive' };
    if (state) {
      // State might be in address - add OR condition
      where.lastSeenAddress = {
        ...(where.lastSeenAddress || {}),
        contains: state,
        mode: 'insensitive'
      };
    }
    if (species) where.petSpecies = species;

    // Fetch cases from main Case model (NO sensitive fields exposed)
    const [casesRaw, totalCount] = await Promise.all([
      prisma.case.findMany({
        where,
        select: {
          id: true,
          caseNumber: true,
          createdAt: true,
          updatedAt: true,
          // Pet info
          petName: true,
          petSpecies: true,
          petBreed: true,
          petColor: true,
          petSize: true,
          petPhotoUrl: true,
          petDescription: true,
          // Location
          lastSeenAddress: true,
          lastSeenLatitude: true,
          lastSeenLongitude: true,
          lastSeenAt: true,
          searchRadius: true,
          // Status
          status: true,
          priority: true,
          reportType: true,
          // IMPORTANT: Do NOT expose:
          // - reporterId (internal only)
          // - ownerPhone, ownerEmail (privacy - only on detail page)
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.case.count({ where })
    ]);

    // Parse city/state from lastSeenAddress for each case
    const cases = casesRaw.map(caseItem => {
      let city = 'Unknown';
      let state = 'XX';
      if (caseItem.lastSeenAddress) {
        const parts = caseItem.lastSeenAddress.split(',');
        if (parts.length >= 2) {
          city = parts[parts.length - 2]?.trim() || 'Unknown';
          const stateZip = parts[parts.length - 1]?.trim() || '';
          state = stateZip.substring(0, 2).toUpperCase() || 'XX';
        }
      }
      return {
        ...caseItem,
        petPhotoUrl: normalizePhotoUrl(caseItem.petPhotoUrl),
        city,
        state,
        isUrgent: caseItem.priority === 'URGENT',
      };
    });

    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'public_case.list_viewed',
      resource_type: 'public_case',
      action: 'read',
      result: 'success',
      actor_role: null,
      metadata: {
        filters: { city, state, species, status },
        results_count: cases.length,
        total_count: totalCount,
        page,
        limit,
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      cases,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: (page * limit) < totalCount
      },
      filters: { city, state, species, status }
    });

  } catch (error) {
    console.error('Error listing public cases:', error);

    await logEvent({
      event_type: 'public_case.list_failed',
      resource_type: 'public_case',
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_role: null,
      metadata: {
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to list public cases',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

/**
 * POST /api/public/missions - DEPRECATED
 * Please use POST /api/reports/create instead
 */
export async function POST(request) {
  return NextResponse.json({
    error: 'This endpoint has been deprecated',
    message: 'Please use POST /api/reports/create to submit lost pet reports',
    deprecatedAt: '2024-01-01'
  }, { status: 410 }); // 410 Gone
}
