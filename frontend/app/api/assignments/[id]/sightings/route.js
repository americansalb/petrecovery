import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { assignmentDoor, cleanPlace } from '@/app/lib/missionControl/guard';
import { safeWebUrl } from '@/app/lib/safeUrl';
import { isCaseOpen } from '@/app/lib/caseStatus';
import { SIGHTINGS_PER_HOUR, OWNER_EMAILS_PER_HOUR } from '@/app/lib/sightingLimits';
import { onlyText, cut, firstWord } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendEmail, escapeHtml } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';

const WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 6, blockDurationMs: 60 * 1000 };
const ADDRESS_MAX = 200;
const NOTE_MAX = 600;
const PHOTOS_MAX = 5;

// GET /api/assignments/[id]/sightings - Get all sightings for a case
export async function GET(request, { params }) {
  try {
    // What a force's helpers saw of one pet: for the owner, the forces looking for the pet and staff. It took no
    // sign-in, and sent each reporter's account id and last name. A reporter is a first name here.
    const { id: assignmentId } = await params;
    const door = await assignmentDoor(request, assignmentId);
    if (door.status !== 200) {
      return NextResponse.json({ error: door.status === 404 ? 'Assignment not found' : 'Only the owner and the forces looking for this pet can see this.', code: door.status === 404 ? 'NOT_FOUND' : 'NOT_ALLOWED' }, { status: door.status });
    }
    const viewerId = door.who.searcher?.userId || null;

    const rows = await prisma.petSpotting.findMany({
      where: { assignmentId: door.assignment.id },
      include: {
        reportedBy: {
          select: {
            firstName: true,
          },
        },
      },
      orderBy: { spottedAt: 'desc' },
      take: 200,
    });

    const sightings = rows.map(({ reportedById, reportedBy, ...sighting }) => ({
      ...sighting,
      mine: Boolean(viewerId && reportedById === viewerId),
      reportedBy: { firstName: firstWord(reportedBy?.firstName) || 'A helper' },
    }));

    return NextResponse.json({ sightings });
  } catch (error) {
    console.error('Error fetching sightings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sightings' },
      { status: 500 }
    );
  }
}

// POST /api/assignments/[id]/sightings - Report a pet sighting
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, WRITE_LIMIT, 'assignment:sighting');
    if (!limited.success) return rateLimitResponse(limited);

    const { id: assignmentId } = await params;
    const sent = await request.json().catch(() => null);
    const body = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};

    // A place on the globe, a time, and how sure: a whole number from 1 to 10. The address is one line, the
    // note is text, and a picture is an https address; each is held to a length.
    const place = cleanPlace({ lat: body.latitude, lng: body.longitude });
    const seenAt = new Date(typeof body.spottedAt === 'string' || typeof body.spottedAt === 'number' ? body.spottedAt : '');
    const confidenceLevel = Number(body.confidenceLevel);
    if (!place || Number.isNaN(seenAt.getTime()) || !Number.isFinite(confidenceLevel)) {
      return NextResponse.json(
        { error: 'Location, time, and confidence level required' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(confidenceLevel) || confidenceLevel < 1 || confidenceLevel > 10) {
      return NextResponse.json(
        { error: 'Confidence level must be between 1-10' },
        { status: 400 }
      );
    }
    if (seenAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return NextResponse.json({ error: 'A sighting cannot be in the future.' }, { status: 400 });
    }
    const { lat: latitude, lng: longitude } = place;
    const address = typeof body.address === 'string' ? cut(onlyText(body.address).replace(/\s+/g, ' ').trim(), ADDRESS_MAX) || null : null;
    const notes = typeof body.notes === 'string' ? cut(onlyText(body.notes).trim(), NOTE_MAX) || null : null;
    const photoUrls = (Array.isArray(body.photoUrls) ? body.photoUrls : []).map((url) => safeWebUrl(url)).filter((url) => url && url.startsWith('https://')).slice(0, PHOTOS_MAX);

    // Verify user is a participant
    const participant = typeof assignmentId === 'string' && assignmentId
      ? await prisma.caseParticipant.findUnique({
          where: {
            assignmentId_userId: {
              assignmentId,
              userId: session.user.id,
            },
          },
        })
      : null;

    if (!participant || !participant.isActive) {
      return NextResponse.json(
        { error: 'You must be participating in this case to report sightings' },
        { status: 403 }
      );
    }

    // One assignment takes only so many in an hour, from everyone on it together (the same number a pet's
    // own page holds to, app/lib/witness.js): starting a walk makes any account a participant.
    const thisHour = await prisma.petSpotting.count({ where: { assignmentId, reportedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (thisHour >= SIGHTINGS_PER_HOUR) {
      return NextResponse.json({ error: 'Too many sightings came in this hour to take another. Try again in a few minutes.', code: 'TOO_MANY' }, { status: 429 });
    }

    const created = await prisma.petSpotting.create({
      data: {
        assignmentId,
        reportedById: session.user.id,
        latitude,
        longitude,
        address,
        spottedAt: seenAt,
        confidenceLevel,
        photoUrls: JSON.stringify(photoUrls),
        notes,
      },
      include: {
        reportedBy: {
          select: {
            firstName: true,
          },
        },
      },
    });
    // The reporter's own sighting, back to them: a first name, no account id.
    const { reportedById, reportedBy, ...rest } = created;
    const sighting = { ...rest, mine: true, reportedBy: { firstName: firstWord(reportedBy?.firstName) || 'A helper' } };

    // Update participant stats
    await prisma.caseParticipant.update({
      where: { id: participant.id },
      data: {
        sightingsReported: { increment: 1 },
      },
    });

    // Update case status if high confidence sighting + notify the owner.
    if (confidenceLevel >= 7) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { id: assignmentId },
        select: { missionId: true, case: { select: { status: true } } }, // CaseAssignment.missionId is @map("caseId") - this is the case id
      });

      // Only a search that is still open is marked and announced: this used to set a pet that was home, or a
      // closed report, back to "sighting reported".
      const open = isCaseOpen(assignment?.case?.status);
      const updatedCase = open
        ? await prisma.case.update({
            where: { id: assignment.missionId },
            data: { status: 'SIGHTING_REPORTED' },
            select: {
              caseNumber: true,
              petName: true,
              reporterId: true,
              reporter: { select: { email: true } },
            },
          })
        : null;

      // CRIT-E: a confident sighting of a missing pet must reach the owner.
      // Deliver in-app + email, isolated/best-effort so it can't fail the sighting.
      try {
        if (updatedCase?.reporterId) {
          const petName = updatedCase.petName || 'your pet';
          await createInAppNotification({
            userId: updatedCase.reporterId,
            type: 'SIGHTING',
            title: `Confident sighting of ${petName}`,
            message: `A searcher reported a confident sighting${address ? ` near ${address}` : ''}. Tap to view the details.`,
            actionUrl: updatedCase.caseNumber ? `/cases/${updatedCase.caseNumber}` : null,
            data: { sightingId: sighting.id },
          });
          // The first few of an hour are also emailed. Every word typed by someone else is escaped.
          if (updatedCase.reporter?.email && thisHour < OWNER_EMAILS_PER_HOUR) {
            await sendEmail({
              to: updatedCase.reporter.email,
              subject: `Confident sighting reported for ${petName} - ReunitePets.org`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #10b981;">A confident sighting was reported</h2>
                  <p>A searcher just reported a confident sighting of ${escapeHtml(petName)}${address ? ` near ${escapeHtml(address)}` : ''}.</p>
                  <p><a href="${getEmailBaseUrl()}${updatedCase.caseNumber ? `/cases/${encodeURIComponent(updatedCase.caseNumber)}` : '/dashboard'}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">View the sighting</a></p>
                </div>
              `,
            });
          }
        }
      } catch (err) {
        console.error('Assignment-sighting owner-notify failed:', err?.message);
      }
    }

    // Create a system message in chat
    const confidenceText =
      confidenceLevel >= 8 ? 'Very confident' : confidenceLevel >= 5 ? 'Moderately confident' : 'Possible';
    await prisma.squadMessage.create({
      data: {
        assignmentId,
        authorId: session.user.id,
        type: 'SYSTEM',
        content: `🔍 ${confidenceText} sighting reported at ${address || 'marked location'}`,
        location: JSON.stringify({ lat: latitude, lng: longitude, address }),
      },
    });

    return NextResponse.json({ sighting }, { status: 201 });
  } catch (error) {
    console.error('Error reporting sighting:', error);
    return NextResponse.json(
      { error: 'Failed to report sighting' },
      { status: 500 }
    );
  }
}
