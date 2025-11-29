/**
 * Public Case Detail API
 * Phase 15-16: Public Lost Pet Case Portal MVP (TASK-P02)
 *
 * GET /api/public/cases/[caseNumber] - View public case detail
 *
 * NO AUTHENTICATION REQUIRED (public endpoint)
 *
 * IMPORTANT: This now queries the main `Case` model (not LostPetCase)
 * to match where /api/reports/create writes data.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/public/cases/[caseNumber] - View public case detail
 * Returns 404 if case not found
 * Contact info shown for LOST reports (owner wants to be contacted)
 */
export async function GET(request, { params }) {
  const startTime = Date.now();
  const { caseNumber } = params;

  try {
    // Fetch case by caseNumber from the main Case model
    // This is where /api/reports/create writes data
    const caseData = await prisma.case.findUnique({
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
        petSize: true,
        petPhotoUrl: true,
        petDescription: true,
        // Location
        lastSeenLatitude: true,
        lastSeenLongitude: true,
        lastSeenAddress: true,
        lastSeenAt: true,
        searchRadius: true,
        // Status
        status: true,
        priority: true,
        reportType: true,
        // Owner/Reporter info
        reporterId: true,
        ownerName: true,
        ownerPhone: true,
        ownerEmail: true,
      }
    });

    // Return 404 if case not found
    if (!caseData) {
      await logEvent({
        event_type: 'public_case.detail_failed',
        resource_type: 'public_case',
        action: 'read',
        result: 'failure',
        error_code: 'CASE_NOT_FOUND',
        error_message: `Case ${caseNumber} not found`,
        actor_role: null,
        metadata: {
          caseNumber,
          found: false
        }
      });

      return NextResponse.json({
        error: 'Case not found',
        code: 'CASE_NOT_FOUND',
        message: 'This case does not exist or is not publicly available'
      }, { status: 404 });
    }

    // Parse city/state from lastSeenAddress if available
    // Format is typically "123 Main St, City, ST 12345"
    let city = 'Unknown';
    let state = 'XX';
    if (caseData.lastSeenAddress) {
      const parts = caseData.lastSeenAddress.split(',');
      if (parts.length >= 2) {
        city = parts[parts.length - 2]?.trim() || 'Unknown';
        const stateZip = parts[parts.length - 1]?.trim() || '';
        state = stateZip.substring(0, 2).toUpperCase() || 'XX';
      }
    }

    // Build response
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
      petSize: caseData.petSize,
      petPhotoUrl: caseData.petPhotoUrl,
      petDescription: caseData.petDescription,
      // Location
      city,
      state,
      lastSeenAddress: caseData.lastSeenAddress,
      lastSeenLatitude: caseData.lastSeenLatitude,
      lastSeenLongitude: caseData.lastSeenLongitude,
      lastSeenAt: caseData.lastSeenAt,
      searchRadius: caseData.searchRadius,
      // Status
      status: caseData.status,
      priority: caseData.priority,
      reportType: caseData.reportType,
      isUrgent: caseData.priority === 'URGENT',
      // Reporter ID (for checking ownership)
      reporterId: caseData.reporterId,
    };

    // Include contact info for LOST reports (owner wants to be contacted)
    if (caseData.reportType === 'LOST') {
      response.contact = {
        name: caseData.ownerName,
        phone: caseData.ownerPhone,
        email: caseData.ownerEmail,
        disclaimer: 'Contact information provided by reporter. Please exercise caution when communicating with strangers.'
      };
    } else {
      response.contact = {
        available: true,
        name: caseData.ownerName,
        phone: caseData.ownerPhone,
        disclaimer: 'Contact information provided by reporter. Please exercise caution when communicating with strangers.'
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
        city,
        state,
        petSpecies: caseData.petSpecies,
        reportType: caseData.reportType,
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
