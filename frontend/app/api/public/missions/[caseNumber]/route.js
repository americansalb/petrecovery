/**
 * Public Case Detail API
 * Phase 15-16: Public Lost Pet Case Portal MVP (TASK-P02)
 *
 * GET /api/public/missions/[missionNumber] - View public case detail
 *
 * NO AUTHENTICATION REQUIRED (public endpoint)
 *
 * IMPORTANT: This now queries the main `Case` model (not LostPetCase)
 * to match where /api/reports/create writes data.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { normalizePhotoUrl } from '@/app/lib/utils';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/public/missions/[missionNumber] - View public case detail
 * Returns 404 if case not found
 * Contact info shown for LOST reports (owner wants to be contacted)
 */
export async function GET(request, { params }) {
  const startTime = Date.now();
  const { caseNumber } = params;

  try {
    // Fetch case by caseNumber OR raw id (legacy /reports/{id} links
    // resolve through here). Cuids are c + 24 lowercase alphanumerics.
    const isId = /^c[a-z0-9]{24}$/.test(caseNumber);
    const missionData = await prisma.case.findUnique({
      where: isId ? { id: caseNumber } : { caseNumber },
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
        resolution: true,
        resolvedAt: true,
        // Owner/Reporter info
        reporterId: true,
        ownerName: true,
        ownerPhone: true,
        ownerEmail: true,
        // Engagement metrics
        viewCount: true,
        shareCount: true,
        activeSearchers: true,
        // Sightings for map and timeline
        sightings: {
          orderBy: { sightedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            sightedAt: true,
            latitude: true,
            longitude: true,
            address: true,
            description: true,
            certaintyLevel: true,
            photoUrls: true,
            isVerified: true,
            reportedBy: {
              select: { firstName: true }
            }
          }
        },
        // Updates for timeline
        updates: {
          where: { isUpdate: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            content: true,
            createdAt: true,
            isPinned: true
          }
        }
      }
    });

    // Return 404 if case not found
    if (!missionData) {
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
        error: 'Mission not found',
        code: 'CASE_NOT_FOUND',
        message: 'This case does not exist or is not publicly available'
      }, { status: 404 });
    }

    // Parse city/state from lastSeenAddress if available
    // Format is typically "123 Main St, City, ST 12345"
    let city = 'Unknown';
    let state = 'XX';
    if (missionData.lastSeenAddress) {
      const parts = missionData.lastSeenAddress.split(',');
      if (parts.length >= 2) {
        city = parts[parts.length - 2]?.trim() || 'Unknown';
        const stateZip = parts[parts.length - 1]?.trim() || '';
        state = stateZip.substring(0, 2).toUpperCase() || 'XX';
      }
    }

    // Build response
    const response = {
      id: missionData.id,
      missionNumber: missionData.caseNumber,
      createdAt: missionData.createdAt,
      updatedAt: missionData.updatedAt,
      // Pet info
      petName: missionData.petName,
      petSpecies: missionData.petSpecies,
      petBreed: missionData.petBreed,
      petColor: missionData.petColor,
      petSize: missionData.petSize,
      petPhotoUrl: normalizePhotoUrl(missionData.petPhotoUrl),
      petDescription: missionData.petDescription,
      // Location
      city,
      state,
      lastSeenAddress: missionData.lastSeenAddress,
      lastSeenLatitude: missionData.lastSeenLatitude,
      lastSeenLongitude: missionData.lastSeenLongitude,
      lastSeenAt: missionData.lastSeenAt,
      searchRadius: missionData.searchRadius,
      // Status
      status: missionData.status,
      priority: missionData.priority,
      reportType: missionData.reportType,
      resolution: missionData.resolution,
      resolvedAt: missionData.resolvedAt,
      isUrgent: missionData.priority === 'URGENT',
      // Reporter ID (for checking ownership)
      reporterId: missionData.reporterId,
      // Engagement metrics
      viewCount: missionData.viewCount || 0,
      shareCount: missionData.shareCount || 0,
      activeSearchers: missionData.activeSearchers || 0,
      // Sightings for map and timeline
      sightings: (missionData.sightings || []).map(s => ({
        id: s.id,
        sightedAt: s.sightedAt,
        latitude: s.latitude,
        longitude: s.longitude,
        address: s.address,
        description: s.description,
        certaintyLevel: s.certaintyLevel,
        photoUrls: s.photoUrls,
        isVerified: s.isVerified,
        reporterName: s.reportedBy?.firstName || 'Community member'
      })),
      sightingsCount: missionData.sightings?.length || 0,
      // Updates for timeline
      updates: missionData.updates || []
    };

    // Include contact info for LOST reports (owner wants to be contacted)
    if (missionData.reportType === 'LOST') {
      response.contact = {
        name: missionData.ownerName,
        phone: missionData.ownerPhone,
        email: missionData.ownerEmail,
        disclaimer: 'Contact information provided by reporter. Please exercise caution when communicating with strangers.'
      };
    } else {
      response.contact = {
        available: true,
        name: missionData.ownerName,
        phone: missionData.ownerPhone,
        disclaimer: 'Contact information provided by reporter. Please exercise caution when communicating with strangers.'
      };
    }

    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'public_case.detail_viewed',
      resource_type: 'public_case',
      resource_id: missionData.id,
      action: 'read',
      result: 'success',
      actor_role: null, // anonymous public user
      metadata: {
        caseNumber,
        missionId: missionData.id,
        city,
        state,
        petSpecies: missionData.petSpecies,
        reportType: missionData.reportType,
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
      actor_role: null, // anonymous public user
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
