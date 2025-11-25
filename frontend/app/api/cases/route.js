/**
 * Lost Pet Cases API - List & Create
 * Phase 13-14: Lost Pet Cases MVP (TASK-C02)
 *
 * GET /api/cases - List cases with filters
 * POST /api/cases - Create new case (with legal gating)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/cases - List lost pet cases with filters
 * Query params: status, city, state, squadId, limit (default 20, max 100)
 */
export async function GET(request) {
  const startTime = Date.now();
  let session = null;

  try {
    // Authentication check
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      await logEvent({
        event_type: 'case.list_failed',
        resource_type: 'case',
        action: 'read',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'Attempted to list cases without authentication',
        metadata: {}
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check waiver acceptance
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { waiverAcceptedAt: true }
    });

    if (!user?.waiverAcceptedAt) {
      await logEvent({
        event_type: 'case.list_failed',
        resource_type: 'case',
        action: 'read',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'User attempted to list cases without accepting liability waiver',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: {}
      });

      return NextResponse.json({
        error: 'Liability waiver required',
        code: 'WAIVER_NOT_ACCEPTED',
        message: 'You must accept the liability waiver before viewing cases.',
        redirectTo: `/legal/consent?returnUrl=${encodeURIComponent('/admin/cases')}`
      }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const squadId = searchParams.get('squadId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // Build where clause
    const where = {};
    if (status) where.status = status;
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (state) where.state = { contains: state, mode: 'insensitive' };
    if (squadId) where.squadId = squadId;

    // Fetch cases
    const cases = await prisma.lostPetCase.findMany({
      where,
      include: {
        squad: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: { notes: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'case.list_viewed',
      resource_type: 'case',
      action: 'read',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        filters: { status, city, state, squadId },
        results_count: cases.length,
        limit,
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      cases,
      count: cases.length,
      filters: { status, city, state, squadId, limit }
    });

  } catch (error) {
    console.error('Error listing cases:', error);

    await logEvent({
      event_type: 'case.list_failed',
      resource_type: 'case',
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'USER',
      metadata: {
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to list cases',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/cases - Create new lost pet case
 * Requires authentication + waiver acceptance
 */
export async function POST(request) {
  const startTime = Date.now();
  let session = null;

  try {
    // Authentication check
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      await logEvent({
        event_type: 'case.create_failed',
        resource_type: 'case',
        action: 'create',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'Attempted to create case without authentication',
        metadata: {}
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const {
      city,
      state,
      zipCode,
      squadId,
      petName,
      petSpecies,
      petBreed,
      petColor,
      petDescription,
      lastSeenLandmark,
      lastSeenAt,
      isUrgent,
      contactName,
      contactPhone,
      contactEmail
    } = body;

    // Validate required fields
    if (!city || !state || !petSpecies) {
      await logEvent({
        event_type: 'case.create_failed',
        resource_type: 'case',
        action: 'create',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: 'Missing required fields: city, state, or petSpecies',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { city, state, petSpecies }
      });
      return NextResponse.json({
        error: 'City, state, and pet species are required'
      }, { status: 400 });
    }

    // Validate petSpecies enum
    const validSpecies = ['DOG', 'CAT', 'BIRD', 'OTHER'];
    if (!validSpecies.includes(petSpecies)) {
      await logEvent({
        event_type: 'case.create_failed',
        resource_type: 'case',
        action: 'create',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: `Invalid pet species: ${petSpecies}`,
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { petSpecies, validSpecies }
      });
      return NextResponse.json({
        error: 'Invalid pet species. Must be DOG, CAT, BIRD, or OTHER'
      }, { status: 400 });
    }

    // Emit create_attempted event
    await logEvent({
      event_type: 'case.create_attempted',
      resource_type: 'case',
      action: 'create',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        city,
        state,
        petSpecies,
        squadId,
        isUrgent: isUrgent || false
      }
    });

    // Check waiver acceptance (legal gating)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        waiverAcceptedAt: true,
        waiverVersionAccepted: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user?.waiverAcceptedAt) {
      // Emit dual events for legal visibility
      await logEvent({
        event_type: 'legal.blocked_action',
        resource_type: 'case',
        action: 'create',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'User attempted to create case without accepting liability waiver',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: {
          blocked_action: 'case_create',
          city,
          state,
          petSpecies
        }
      });

      await logEvent({
        event_type: 'case.create_failed',
        resource_type: 'case',
        action: 'create',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'Case creation blocked - liability waiver not accepted',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { city, state, petSpecies }
      });

      return NextResponse.json({
        error: 'Liability waiver required',
        code: 'WAIVER_NOT_ACCEPTED',
        message: 'You must accept the liability waiver before creating a lost pet case.',
        redirectTo: `/legal/consent?returnUrl=${encodeURIComponent('/admin/cases/new')}`
      }, { status: 403 });
    }

    // Generate case number: CITY-YEAR-SEQUENCE
    // Get count of cases in this city this year
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

    // Create case with transaction (case + initial note)
    const newCase = await prisma.$transaction(async (tx) => {
      const caseRecord = await tx.lostPetCase.create({
        data: {
          caseNumber,
          city,
          state,
          zipCode,
          squadId,
          petName,
          petSpecies,
          petBreed,
          petColor,
          petDescription,
          lastSeenLandmark,
          lastSeenAt: lastSeenAt ? new Date(lastSeenAt) : null,
          isUrgent: isUrgent || false,
          contactName,
          contactPhone,
          contactEmail,
          status: 'OPEN',
          createdById: session.user.id
        },
        include: {
          squad: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true
            }
          }
        }
      });

      // Create initial note
      await tx.lostPetCaseNote.create({
        data: {
          caseId: caseRecord.id,
          authorId: session.user.id,
          type: 'NOTE',
          content: 'Case created.'
        }
      });

      return caseRecord;
    });

    const responseTime = Date.now() - startTime;

    // Emit success event
    await logEvent({
      event_type: 'case.created',
      resource_type: 'case',
      resource_id: newCase.id,
      action: 'create',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        caseId: newCase.id,
        caseNumber: newCase.caseNumber,
        city: newCase.city,
        state: newCase.state,
        petSpecies: newCase.petSpecies,
        squadId: newCase.squadId,
        isUrgent: newCase.isUrgent,
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      case: newCase
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating case:', error);

    await logEvent({
      event_type: 'case.create_failed',
      resource_type: 'case',
      action: 'create',
      result: 'failure',
      error_code: 'DB_WRITE_FAILED',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'USER',
      metadata: {
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to create case',
      message: error.message
    }, { status: 500 });
  }
}
