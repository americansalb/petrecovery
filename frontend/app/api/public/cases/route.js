/**
 * Public Cases API - List & Report
 * Phase 15-16: Public Lost Pet Case Portal MVP (TASK-P02)
 *
 * GET /api/public/cases - List public cases with filters
 * POST /api/public/cases - Submit public lost pet report
 *
 * NO AUTHENTICATION REQUIRED (public endpoints)
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { sendCaseReportConfirmation, sendAdminPublicReportAlert } from '@/app/lib/notifications';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Phone validation regex
const PHONE_REGEX = /^[\d\s\-\(\)\+\.]{7,20}$/;
// Valid US state codes
const VALID_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

/**
 * GET /api/public/cases - List public lost pet cases
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
 * POST /api/public/cases - Submit public lost pet report
 * NO AUTHENTICATION REQUIRED
 * Creates case with isPublic=false (requires admin approval)
 */
export async function POST(request) {
  const startTime = Date.now();

  // Apply rate limiting for public writes (stricter)
  const rateLimitResult = withRateLimit(request, RateLimitPresets.PUBLIC_WRITE, 'public:cases:create');
  if (!rateLimitResult.success) {
    await logEvent({
      event_type: 'public_case.report_rate_limited',
      resource_type: 'public_case',
      action: 'create',
      result: 'failure',
      error_code: 'RATE_LIMITED',
      actor_role: null
    });
    return rateLimitResponse(rateLimitResult);
  }

  try {
    // Parse request body
    const body = await request.json();
    const {
      city,
      state,
      zipCode,
      petName,
      petSpecies,
      petBreed,
      petColor,
      petDescription,
      lastSeenLandmark,
      lastSeenAt,
      contactName,
      contactPhone,
      contactEmail,
      agreeToTerms
    } = body;

    // Validate required fields
    const missingFields = [];
    if (!city) missingFields.push('city');
    if (!state) missingFields.push('state');
    if (!petSpecies) missingFields.push('petSpecies');
    if (!contactName) missingFields.push('contactName');
    if (!contactEmail && !contactPhone) missingFields.push('contactEmail or contactPhone');

    if (missingFields.length > 0) {
      await logEvent({
        event_type: 'public_case.report_failed',
        resource_type: 'public_case',
        action: 'create',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: `Missing required fields: ${missingFields.join(', ')}`,
        actor_role: null,
        metadata: { missingFields }
      });

      return NextResponse.json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        message: `Missing required fields: ${missingFields.join(', ')}`,
        fields: missingFields
      }, { status: 400 });
    }

    // Validate petSpecies enum
    const validSpecies = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'];
    if (!validSpecies.includes(petSpecies)) {
      await logEvent({
        event_type: 'public_case.report_failed',
        resource_type: 'public_case',
        action: 'create',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: `Invalid pet species: ${petSpecies}`,
        actor_role: null,
        metadata: { petSpecies, validSpecies }
      });

      return NextResponse.json({
        error: 'Invalid pet species',
        code: 'VALIDATION_ERROR',
        message: 'Pet species must be DOG, CAT, BIRD, or OTHER'
      }, { status: 400 });
    }

    // Validate terms acceptance
    if (!agreeToTerms) {
      await logEvent({
        event_type: 'public_case.report_failed',
        resource_type: 'public_case',
        action: 'create',
        result: 'failure',
        error_code: 'TERMS_NOT_ACCEPTED',
        error_message: 'Public report submitted without agreeing to terms',
        actor_role: null,
        metadata: {}
      });

      return NextResponse.json({
        error: 'Terms not accepted',
        code: 'TERMS_NOT_ACCEPTED',
        message: 'You must agree to the terms and conditions'
      }, { status: 400 });
    }

    // Emit report_attempted event
    await logEvent({
      event_type: 'public_case.report_attempted',
      resource_type: 'public_case',
      action: 'create',
      result: 'success',
      actor_role: null,
      metadata: {
        city,
        state,
        petSpecies
      }
    });

    // Generate case number: CITY-YEAR-SEQUENCE
    const currentYear = new Date().getFullYear();
    const cityPrefix = city.substring(0, 3).toUpperCase();

    const caseCount = await prisma.lostPetCase.count({
      where: {
        caseNumber: {
          startsWith: `${cityPrefix}-${currentYear}-`
        }
      }
    });

    const sequence = String(caseCount + 1).padStart(4, '0');
    const caseNumber = `${cityPrefix}-${currentYear}-${sequence}`;

    // Create case - IMPORTANT: isPublic=false by default (requires admin approval)
    const newCase = await prisma.lostPetCase.create({
      data: {
        caseNumber,
        city,
        state,
        zipCode,
        petName,
        petSpecies,
        petBreed,
        petColor,
        petDescription,
        lastSeenLandmark,
        lastSeenAt: lastSeenAt ? new Date(lastSeenAt) : null,
        contactName,
        contactPhone,
        contactEmail,
        status: 'OPEN',
        isUrgent: false,
        // Public visibility - SAFE DEFAULTS
        isPublic: false,        // Requires admin approval
        publicContactOk: false, // Contact info protected by default
        source: 'PUBLIC_REPORT' // Track that this came from public form
        // NOTE: createdById is NULL for public reports (no user account)
      },
      select: {
        id: true,
        caseNumber: true,
        createdAt: true,
        city: true,
        state: true,
        zipCode: true,
        petName: true,
        petSpecies: true,
        petBreed: true,
        petColor: true,
        lastSeenLandmark: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true
      }
    });

    const responseTime = Date.now() - startTime;

    // Emit success event
    await logEvent({
      event_type: 'public_case.report_submitted',
      resource_type: 'public_case',
      resource_id: newCase.id,
      action: 'create',
      result: 'success',
      actor_role: null,
      metadata: {
        caseId: newCase.id,
        caseNumber: newCase.caseNumber,
        city: newCase.city,
        state: newCase.state,
        petSpecies: newCase.petSpecies,
        source: 'PUBLIC_REPORT',
        response_time_ms: responseTime
      }
    });

    // NEW (Phase 25-26): Send notifications (non-blocking - errors don't break API response)
    try {
      // 1. Send confirmation to contact (if email provided)
      if (newCase.contactEmail) {
        await sendCaseReportConfirmation({
          caseNumber: newCase.caseNumber,
          petName: newCase.petName,
          petSpecies: newCase.petSpecies,
          city: newCase.city,
          state: newCase.state,
          contactName: newCase.contactName,
          contactEmail: newCase.contactEmail,
          createdAt: newCase.createdAt
        }, { isPublicReport: true });
      }

      // 2. Send alert to admin (if configured)
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      if (adminEmail) {
        await sendAdminPublicReportAlert({
          id: newCase.id,
          caseNumber: newCase.caseNumber,
          petName: newCase.petName,
          petSpecies: newCase.petSpecies,
          petBreed: newCase.petBreed,
          city: newCase.city,
          state: newCase.state,
          zipCode: newCase.zipCode,
          lastSeenLandmark: newCase.lastSeenLandmark,
          contactName: newCase.contactName,
          contactEmail: newCase.contactEmail,
          contactPhone: newCase.contactPhone,
          createdAt: newCase.createdAt
        });
      }
    } catch (notificationError) {
      // Log error but don't break the API response
      console.error('❌ Notification error:', notificationError);

      // Individual notification functions already log their own failures,
      // but log this top-level exception as well
      await logEvent({
        event_type: 'notification.send_failed',
        resource_type: 'notification',
        action: 'create',
        result: 'failure',
        error_code: 'NOTIFICATION_EXCEPTION',
        error_message: notificationError.message,
        metadata: {
          case_number: newCase.caseNumber,
          error_stack: notificationError.stack?.substring(0, 500)
        }
      });
    }

    return NextResponse.json({
      success: true,
      caseNumber: newCase.caseNumber,
      message: 'Your lost pet report has been submitted and is pending admin approval.',
      case: {
        caseNumber: newCase.caseNumber,
        city: newCase.city,
        state: newCase.state,
        petName: newCase.petName,
        petSpecies: newCase.petSpecies,
        createdAt: newCase.createdAt
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating public case report:', error);

    await logEvent({
      event_type: 'public_case.report_failed',
      resource_type: 'public_case',
      action: 'create',
      result: 'failure',
      error_code: 'DB_WRITE_FAILED',
      error_message: error.message,
      actor_role: null,
      metadata: {
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to submit report',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
