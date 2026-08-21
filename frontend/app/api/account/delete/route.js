import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { authOptions } from '@/app/lib/auth';
import { logEvent } from '@/lib/logging';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { isCaseOpen } from '@/app/lib/caseStatus';

/**
 * POST /api/account/delete
 *
 * Deletes the signed-in person's account.
 *
 * The Danger Zone button in /settings used to ask "Are you sure? This
 * cannot be undone", wait for the person to say yes, and then tell them
 * account deletion was not implemented and to contact support. This is
 * the implementation.
 *
 * It is not a prisma.user.delete(). Case.reporter and
 * CaseSighting.reportedBy are both onDelete: Cascade, so deleting the row
 * outright would take with it every case that person reported - including
 * a search a rescue force and a dozen volunteers might be out running
 * right now - and every sighting they had reported on other people's
 * cases. Someone exercising their own right to erasure must not silently
 * erase the thing other people are out looking for.
 *
 * So:
 *   1. Refuse while they have an open case of their own. Close it or mark
 *      the pet reunited first; the message says so.
 *   2. Move what other people depend on - sightings and updates on other
 *      people's cases, squad posts and comments, volunteer records - onto
 *      a tombstone account, so the case history survives without naming
 *      them.
 *   3. Delete the account. The cascades take what is genuinely theirs:
 *      pets, profile, preferences, sessions, notifications.
 *
 * Re-authentication is required. A logged-in tab left open on a shared
 * machine should not be one click away from destroying an account.
 */

const TOMBSTONE_EMAIL = 'deleted-account@reunitepets.invalid';

/**
 * The account that inherits contributions others still rely on.
 *
 * Created on first use. It can never be signed into: the password hash is
 * random bytes nobody holds the plaintext for, and the address is on the
 * reserved .invalid TLD so no mail can ever reach or verify it.
 */
async function getTombstoneUser() {
  const existing = await prisma.user.findUnique({
    where: { email: TOMBSTONE_EMAIL },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      email: TOMBSTONE_EMAIL,
      firstName: 'Deleted',
      lastName: 'account',
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
      emailVerified: null,
    },
    select: { id: true },
  });
}

export async function POST(request) {
  const correlationId = crypto.randomUUID();

  const limit = await withRateLimitAsync(request, RateLimitPresets.AUTH, 'account:delete');
  if (!limit.success) return rateLimitResponse(limit);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'You need to be signed in.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === 'string' ? body.password : '';

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json(
        { error: 'That password is not right.', code: 'BAD_PASSWORD' },
        { status: 401 }
      );
    }

    // An open case is a search in progress. Deleting it out from under the
    // people running it is not this button's job.
    const ownCases = await prisma.case.findMany({
      where: { reporterId: user.id },
      select: { caseNumber: true, petName: true, status: true },
    });
    const stillOpen = ownCases.filter((c) => isCaseOpen(c.status));

    if (stillOpen.length > 0) {
      return NextResponse.json(
        {
          error:
            stillOpen.length === 1
              ? `Your report for ${stillOpen[0].petName || stillOpen[0].caseNumber} is still open. Close it or mark the pet reunited, then you can delete your account.`
              : `You have ${stillOpen.length} open reports. Close them or mark those pets reunited, then you can delete your account.`,
          code: 'OPEN_CASES',
          cases: stillOpen.map((c) => ({ caseNumber: c.caseNumber, petName: c.petName })),
        },
        { status: 409 }
      );
    }

    const tombstone = await getTombstoneUser();

    const moved = await prisma.$transaction(async (tx) => {
      const counts = {};

      // Sightings on other people's cases: the owner of that case still
      // needs to see where their animal was seen.
      counts.sightings = (await tx.caseSighting.updateMany({
        where: { reportedById: user.id },
        data: { reportedById: tombstone.id },
      })).count;

      counts.caseUpdates = (await tx.caseUpdate.updateMany({
        where: { authorId: user.id },
        data: { authorId: tombstone.id },
      })).count;

      counts.squadPosts = (await tx.squadPost.updateMany({
        where: { authorId: user.id },
        data: { authorId: tombstone.id },
      })).count;

      counts.squadComments = (await tx.squadPostComment.updateMany({
        where: { authorId: user.id },
        data: { authorId: tombstone.id },
      })).count;

      // Volunteer records carry the history of who searched where. The
      // name goes; the record of the search stays.
      counts.volunteerRecords = (await tx.missionVolunteer.updateMany({
        where: { userId: user.id },
        data: { userId: null, isAnonymous: true, displayName: 'Deleted account' },
      })).count;

      // Their own closed cases stay as history, detached from them.
      //
      // One at a time rather than updateMany: Case.reporter is a named
      // relation ("CaseReporter", because Case points at User twice), and
      // Prisma leaves reporterId out of the updateMany input for those.
      // The single-record update takes it. A person has a handful of
      // closed cases, not thousands.
      const ownCaseIds = await tx.case.findMany({
        where: { reporterId: user.id },
        select: { id: true },
      });
      for (const { id } of ownCaseIds) {
        await tx.case.update({
          where: { id },
          data: {
            reporterId: tombstone.id,
            ownerName: 'Deleted account',
            ownerEmail: null,
            ownerPhone: null,
          },
        });
      }
      counts.closedCases = ownCaseIds.length;

      await tx.user.delete({ where: { id: user.id } });

      return counts;
    }, { timeout: 20000, maxWait: 10000 });

    await logEvent({
      event_type: 'account.deleted',
      correlation_id: correlationId,
      actor_user_id: user.id,
      resource_type: 'user',
      resource_id: user.id,
      action: 'delete',
      result: 'success',
      metadata: moved,
    }).catch(() => {});

    return NextResponse.json({ success: true, message: 'Your account has been deleted.' });
  } catch (error) {
    console.error('Account deletion failed:', error);

    await logEvent({
      event_type: 'account.delete_failed',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'delete',
      result: 'failure',
      error_message: error.message,
    }).catch(() => {});

    return NextResponse.json(
      { error: 'We could not delete your account. Nothing was changed.' },
      { status: 500 }
    );
  }
}
