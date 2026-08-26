/**
 * Public Cases API - List & Report
 * Phase 15-16: Public Lost Pet Case Portal MVP (TASK-P02)
 *
 * GET /api/public/missions - List public cases with filters
 * POST /api/public/missions - Submit public lost pet report
 *
 * NO AUTHENTICATION REQUIRED (public endpoints)
 */

import { looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';
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
// The real CaseStatus enum (prisma/schema.prisma). A status filter is checked
// against this rather than handed to Prisma to reject with a 500.
const VALID_CASE_STATUSES = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED', 'REUNITED', 'CLOSED_OTHER'];
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
    const type = (searchParams.get('type') || 'LOST').toUpperCase();
    const q = (searchParams.get('q') || '').trim();
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const where = {};

    // type: LOST (default) | FOUND | ALL
    if (type === 'LOST' || type === 'FOUND') where.reportType = type;

    // status groups: LIVE (default) covers every still-open state, so a
    // case does not vanish from the public list the moment a sighting
    // flips it to SIGHTING_REPORTED. Exact enum values still work.
    const statusGroup = (status || 'LIVE').toUpperCase();
    if (statusGroup === 'LIVE') {
      where.status = { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] };
    } else if (statusGroup === 'REUNITED') {
      where.status = 'REUNITED';
    } else if (statusGroup !== 'ALL') {
      // An unrecognised value used to be passed straight to Prisma, which threw
      // an enum validation error and turned a bad query string into a 500. The
      // /alerts page sent status=OPEN - a value this enum has never had - so the
      // whole page rendered an error for every visitor. A caller's typo is a
      // 400, and it says which values are real.
      if (!VALID_CASE_STATUSES.includes(statusGroup)) {
        return NextResponse.json({
          error: `Unknown status "${status}"`,
          code: 'INVALID_STATUS',
          allowed: ['LIVE', 'ALL', ...VALID_CASE_STATUSES],
        }, { status: 400 });
      }
      where.status = statusGroup;
    }

    // One search box covers the obvious questions: name, breed, color, place
    if (q) {
      where.OR = [
        { petName: { contains: q, mode: 'insensitive' } },
        { petBreed: { contains: q, mode: 'insensitive' } },
        { petColor: { contains: q, mode: 'insensitive' } },
        { lastSeenAddress: { contains: q, mode: 'insensitive' } },
      ];
    }

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
          resolvedAt: true,
          // Social proof for cards
          _count: { select: { sightings: true } },
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
      if (caseItem.lastSeenAddress && !looksLikeCoordinates(caseItem.lastSeenAddress)) {
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
        sightingCount: caseItem._count?.sightings || 0,
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
