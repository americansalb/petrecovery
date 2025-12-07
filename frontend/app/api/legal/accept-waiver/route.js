/**
 * Simple Waiver Acceptance API
 *
 * Accepts the liability waiver without requiring specific document versions.
 * This is a simplified endpoint that just updates the user's waiver acceptance timestamp.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

export async function POST(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'You must be logged in to accept the waiver'
      }, { status: 401 });
    }

    console.log(`📄 [Waiver Accept] User ${session.user.email} accepting waiver`);

    // Update user waiver acceptance
    const now = new Date();
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        waiverAcceptedAt: now,
        waiverVersionAccepted: '1.0', // Default version
        tosAcceptedAt: now, // Also accept ToS
        tosVersionAccepted: '1.0'
      }
    });

    // Log the acceptance
    logEvent({
      event_type: 'legal.waiver_accepted',
      resource_type: 'legal_document',
      action: 'create',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role,
      metadata: {
        user_email: session.user.email,
        acceptance_timestamp: now.toISOString(),
        simplified_endpoint: true
      }
    });

    console.log(`✅ [Waiver Accept] Completed for user ${session.user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Waiver accepted successfully',
      acceptedAt: now.toISOString()
    });

  } catch (error) {
    console.error('❌ [Waiver Accept] Error:', error);

    logEvent({
      event_type: 'legal.waiver_accept_failed',
      resource_type: 'legal_document',
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || null
    });

    return NextResponse.json({
      error: 'Failed to accept waiver',
      message: error.message
    }, { status: 500 });
  }
}
