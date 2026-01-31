/**
 * Shelter Contact Actions API Routes
 *
 * POST /api/mission/[missionId]/shelters/[shelterId] - Log call or send email
 * GET /api/mission/[missionId]/shelters/[shelterId] - Get shelter details with history
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getVerificationService, getEmailService } from '@/lib/actions';

// =============================================================================
// TYPES
// =============================================================================

interface CallLogBody {
  action: 'call';
  outcome: 'NO_ANSWER' | 'LEFT_VOICEMAIL' | 'SPOKE_WITH_STAFF' | 'WRONG_NUMBER' | 'BUSY';
  staffResponse?: 'NO_MATCHING_ANIMALS' | 'POSSIBLE_MATCH' | 'CONFIRMED_MATCH' | 'WILL_CHECK_AND_CALL_BACK' | 'OTHER';
  notes?: string;
}

interface EmailBody {
  action: 'email';
  petName: string;
  petType: 'DOG' | 'CAT' | 'OTHER';
  petBreed?: string;
  petColor?: string;
  petDescription?: string;
  lastSeenLocation: string;
  lastSeenDate: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  petPhotoUrl?: string;
  caseUrl: string;
}

type ShelterActionBody = CallLogBody | EmailBody;

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/mission/[missionId]/shelters/[shelterId]
 *
 * Get shelter details with contact history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string; shelterId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId, shelterId } = await params;

    const shelter = await prisma.shelterContact.findFirst({
      where: { id: shelterId, missionId },
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!shelter) {
      return NextResponse.json({ error: 'Shelter not found' }, { status: 404 });
    }

    return NextResponse.json({
      shelter: {
        id: shelter.id,
        placeId: shelter.placeId,
        name: shelter.shelterName,
        address: shelter.shelterAddress,
        phone: shelter.shelterPhone,
        email: shelter.shelterEmail,
        type: shelter.shelterType,
        location: {
          lat: shelter.latitude,
          lng: shelter.longitude,
        },
        status: shelter.status,
        lastContactedAt: shelter.lastContactedAt,
        lastContactMethod: shelter.lastContactMethod,
        notes: shelter.notes,
      },
      attempts: shelter.attempts.map((attempt) => ({
        id: attempt.id,
        method: attempt.method,
        createdAt: attempt.createdAt,
        contactedBy: attempt.user,
        callOutcome: attempt.callOutcome,
        staffResponse: attempt.staffResponse,
        notes: attempt.notes,
        pointsEarned: attempt.pointsEarned,
        isVerified: attempt.isVerified,
        emailOpened: attempt.emailOpened,
        emailOpenedAt: attempt.emailOpenedAt,
        emailReplied: attempt.emailReplied,
        emailRepliedAt: attempt.emailRepliedAt,
      })),
    });
  } catch (error) {
    console.error('Shelter GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mission/[missionId]/shelters/[shelterId]
 *
 * Log a call or send an email to this shelter
 *
 * For calls (action: 'call'):
 * - Self-reported, 8 pts (subject to daily cap)
 * - Logs outcome and staff response
 *
 * For emails (action: 'email'):
 * - Verified via platform, 15 pts (no cap)
 * - Sends email via Resend
 * - Tracks opens/clicks via webhooks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string; shelterId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId, shelterId } = await params;
    const body: ShelterActionBody = await request.json();

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get shelter
    const shelter = await prisma.shelterContact.findFirst({
      where: { id: shelterId, missionId },
    });

    if (!shelter) {
      return NextResponse.json({ error: 'Shelter not found' }, { status: 404 });
    }

    // Get case for metadata
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true, createdAt: true },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    if (body.action === 'call') {
      return handleCallLog(user.id, missionId, shelter, body, missionRecord.createdAt);
    } else if (body.action === 'email') {
      return handleEmailSend(user.id, missionId, shelter, body, missionRecord.createdAt);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use: call or email' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Shelter action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

/**
 * Log a call attempt (self-reported)
 */
async function handleCallLog(
  userId: string,
  missionId: string,
  shelter: any,
  body: CallLogBody,
  caseCreatedAt: Date
): Promise<NextResponse> {
  const { outcome, staffResponse, notes } = body;

  // Determine action type based on shelter type
  const actionType = shelter.shelterType === 'VET'
    ? 'contact_vets'
    : shelter.shelterType === 'ANIMAL_CONTROL'
      ? 'contact_animal_control'
      : 'contact_shelters';

  // Use verification service to log call
  const verificationService = getVerificationService(prisma);
  const result = await verificationService.logShelterCall({
    userId,
    missionId,
    shelterContactId: shelter.id,
    actionType: actionType as any,
    callOutcome: outcome,
    staffResponse,
    notes,
  });

  return NextResponse.json({
    success: true,
    attemptId: result.attemptId,
    pointsEarned: result.pointsEarned,
    remainingDaily: result.remainingDaily,
    isVerified: false, // Calls are self-reported
  });
}

/**
 * Send email via platform (verified)
 */
async function handleEmailSend(
  userId: string,
  missionId: string,
  shelter: any,
  body: EmailBody,
  caseCreatedAt: Date
): Promise<NextResponse> {
  // Check if shelter has email
  if (!shelter.shelterEmail) {
    return NextResponse.json(
      { error: 'Shelter does not have an email address' },
      { status: 400 }
    );
  }

  // Determine shelter type for action type
  const shelterType = shelter.shelterType as 'SHELTER' | 'VET' | 'ANIMAL_CONTROL';

  // Use email service to send
  const emailService = getEmailService(prisma);
  const result = await emailService.sendShelterEmail({
    userId,
    missionId,
    shelterContactId: shelter.id,
    shelterName: shelter.shelterName,
    shelterEmail: shelter.shelterEmail,
    shelterType,
    petName: body.petName,
    petType: body.petType,
    petBreed: body.petBreed,
    petColor: body.petColor,
    petDescription: body.petDescription,
    lastSeenLocation: body.lastSeenLocation,
    lastSeenDate: body.lastSeenDate,
    ownerName: body.ownerName,
    ownerPhone: body.ownerPhone,
    ownerEmail: body.ownerEmail,
    petPhotoUrl: body.petPhotoUrl,
    caseUrl: body.caseUrl,
    caseCreatedAt,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Failed to send email' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    emailId: result.emailId,
    attemptId: result.attemptId,
    pointsEarned: result.pointsEarned,
    isVerified: true, // Platform emails are verified
  });
}
