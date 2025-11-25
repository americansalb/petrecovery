/**
 * Public Case Detail API
 * Phase 15-16: Public Lost Pet Case Portal MVP (TASK-P02)
 *
 * GET /api/public/cases/[caseNumber] - View public case detail
 *
 * NO AUTHENTICATION REQUIRED (public endpoint)
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/public/cases/[caseNumber] - View public case detail
 * Returns 404 if case not found OR not public (isPublic=false)
 * Contact info only shown if publicContactOk=true
 */
export async function GET(request, { params }) {
  const startTime = Date.now();
  const { caseNumber } = params;

  try {
    // Fetch case by caseNumber
    const caseData = await prisma.lostPetCase.findUnique({
      where: { caseNumber },
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
        petDescription: true,
        // Location
        city: true,
        state: true,
        zipCode: true,
        lastSeenLandmark: true,
        lastSeenAt: true,
        // Status
        status: true,
        statusReason: true,
        isUrgent: true,
        // Public visibility
        isPublic: true,
        publicContactOk: true,
        // Contact info (conditionally exposed)
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        // IMPORTANT: Do NOT expose:
        // - createdById
        // - squadId
        // - source
      }
    });

    // Return 404 if case not found OR not public
    if (!caseData || !caseData.isPublic) {
      await logEvent({
        event_type: 'public_case.detail_failed',
        resource_type: 'public_case',
        action: 'read',
        result: 'failure',
        error_code: 'CASE_NOT_FOUND',
        error_message: `Case ${caseNumber} not found or not public`,
        actor_role: 'public',
        metadata: {
          caseNumber,
          found: !!caseData,
          isPublic: caseData?.isPublic || false
        }
      });

      return NextResponse.json({
        error: 'Case not found',
        code: 'CASE_NOT_FOUND',
        message: 'This case does not exist or is not publicly available'
      }, { status: 404 });
    }

    // Build response with privacy controls
    const response = {
      id: caseData.id,
      caseNumber: caseData.caseNumber,
      createdAt: caseData.createdAt,
      updatedAt: caseData.updatedAt,
      // Pet info
      petName: caseData.petName,
      petSpecies: caseData.petSpecies,
      petBreed: caseData.petBreed,
      petColor: caseData.petColor,
      petDescription: caseData.petDescription,
      // Location
      city: caseData.city,
      state: caseData.state,
      zipCode: caseData.zipCode,
      lastSeenLandmark: caseData.lastSeenLandmark,
      lastSeenAt: caseData.lastSeenAt,
      // Status
      status: caseData.status,
      statusReason: caseData.statusReason,
      isUrgent: caseData.isUrgent
    };

    // Only include contact info if publicContactOk=true
    if (caseData.publicContactOk) {
      response.contact = {
        name: caseData.contactName,
        phone: caseData.contactPhone,
        email: caseData.contactEmail,
        disclaimer: 'Contact information provided by reporter. Please exercise caution when communicating with strangers.'
      };
    } else {
      response.contact = {
        available: false,
        message: 'Contact information is not publicly available for this case'
      };
    }

    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'public_case.detail_viewed',
      resource_type: 'public_case',
      resource_id: caseData.id,
      action: 'read',
      result: 'success',
      actor_role: 'public',
      metadata: {
        caseNumber,
        caseId: caseData.id,
        city: caseData.city,
        state: caseData.state,
        petSpecies: caseData.petSpecies,
        publicContactOk: caseData.publicContactOk,
        response_time_ms: responseTime
      }
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching public case detail:', error);

    await logEvent({
      event_type: 'public_case.detail_failed',
      resource_type: 'public_case',
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_role: 'public',
      metadata: {
        caseNumber,
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to fetch case detail',
      code: 'INTERNAL_ERROR',
      message: error.message
    }, { status: 500 });
  }
}
