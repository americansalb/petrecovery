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
import { mayKnowThePeople } from '@/app/lib/missionControl/guard';
import { onlyText, cut, firstWord } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse, RateLimitPresets } from '@/app/lib/rateLimit';

// One shelter on one pet's search, and the calls made to it: for the owner, an active member of a force
// looking for the pet, and staff (`mayKnowThePeople`). It answered any account, and any account could log a
// call with a note of any length on someone else's search.
const REFUSAL = { error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' };
const WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20, blockDurationMs: 60 * 1000 };
const OUTCOMES = ['NO_ANSWER', 'LEFT_VOICEMAIL', 'SPOKE_WITH_STAFF', 'WRONG_NUMBER', 'BUSY'];
const RESPONSES = ['NO_MATCHING_ANIMALS', 'POSSIBLE_MATCH', 'CONFIRMED_MATCH', 'WILL_CHECK_AND_CALL_BACK', 'OTHER'];
const NOTE_MAX = 500;

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

    const limited = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'case:shelters-read');
    if (!limited.success) return rateLimitResponse(limited) as NextResponse;

    const { missionId, shelterId } = await params;
    const who = await mayKnowThePeople(request, missionId);
    if (!who.allowed) return NextResponse.json(REFUSAL, { status: who.status });

    const shelter = await prisma.shelterContact.findFirst({
      where: { id: shelterId, missionId },
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            user: {
              select: { firstName: true },
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
        contactedBy: { firstName: firstWord(attempt.user?.firstName) || 'A helper' },
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
/**
 * Emailing a shelter from the site is switched off (2026-11-12). Nothing on
 * the site offers it. The address it wrote to was whatever a request had
 * stored for the "shelter" (any account can add one, with any address), and
 * the letter was built from the request's own words, picture and link. It
 * comes back when the letter is built here from the pet's own report and
 * goes only to a shelter in the site's own directory.
 */
const EMAIL_FROM_SITE: boolean = false;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string; shelterId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, WRITE_LIMIT, 'case:shelters-write');
    if (!limited.success) return rateLimitResponse(limited) as NextResponse;

    const { missionId, shelterId } = await params;
    const who = await mayKnowThePeople(request, missionId);
    if (!who.allowed) return NextResponse.json(REFUSAL, { status: who.status });

    const sent = await request.json().catch(() => null);
    const body: ShelterActionBody = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : ({} as ShelterActionBody);

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
      if (!EMAIL_FROM_SITE) {
        return NextResponse.json({ error: 'Emailing a shelter from the site is not available.', code: 'NOT_AVAILABLE' }, { status: 410 });
      }
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
  // How the call went is one of the known answers, and a note is text held to a length.
  if (!OUTCOMES.includes(body.outcome)) {
    return NextResponse.json({ error: 'Say how the call went.' }, { status: 400 });
  }
  const outcome = body.outcome;
  const staffResponse = body.staffResponse && RESPONSES.includes(body.staffResponse) ? body.staffResponse : undefined;
  const notes = typeof body.notes === 'string' ? cut(onlyText(body.notes).trim(), NOTE_MAX) || undefined : undefined;

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
