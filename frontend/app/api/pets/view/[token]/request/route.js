/**
 * Request caretaker access from the public view link
 *
 * POST /api/pets/view/[token]/request
 * Body (signed out): { firstName, email, password }  -> creates the account
 * Body (signed in):  {}                              -> uses the session user
 *
 * The visitor never leaves the page: account creation, the request,
 * and the owner notification all happen in this one call. Approval
 * stays with the owner; a REQUESTED share grants zero access until
 * they say yes. If the owner had already invited this email, the
 * request completes the handshake and access is granted immediately.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { sendEmail, renderBrandedEmail } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SHARES = 10;

export async function POST(request, { params }) {
  // Account creation lives behind this endpoint: strict limiter
  const rate = withRateLimit(request, RateLimitPresets.AUTH, 'pets:view:request');
  if (!rate.success) return rateLimitResponse(rate);

  try {
    const { token } = await params;
    const pet = await prisma.pet.findFirst({
      where: { publicViewToken: token, isDeleted: false },
      select: {
        id: true,
        name: true,
        ownerId: true,
        owner: { select: { id: true, email: true, firstName: true } },
      },
    });
    if (!pet) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Who is asking?
    const session = await getServerSession(authOptions);
    let requester = null;
    let accountCreated = false;

    if (session?.user?.email) {
      requester = await prisma.user.findUnique({
        where: { email: session.user.email.toLowerCase() },
        select: { id: true, email: true, firstName: true },
      });
    } else {
      const body = await request.json().catch(() => ({}));
      const email = String(body.email || '').trim().toLowerCase();
      const firstName = String(body.firstName || '').trim().slice(0, 100);
      const password = String(body.password || '');

      if (!EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: 'Please enter a valid email' }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        // Never authenticate through this endpoint. The client shows
        // its sign-in step and retries with a session.
        return NextResponse.json({ accountExists: true }, { status: 200 });
      }

      if (!firstName) {
        return NextResponse.json({ error: 'Please tell us your first name' }, { status: 400 });
      }
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      requester = await prisma.user.create({
        data: {
          email,
          firstName,
          passwordHash,
          // Same posture as the report wizard's mid-flow signup: the
          // account works immediately; the real gate on pet access is
          // the owner's approval, not the inbox.
          emailVerified: new Date(),
        },
        select: { id: true, email: true, firstName: true },
      });
      accountCreated = true;
    }

    if (!requester) {
      return NextResponse.json({ error: 'Please sign in and try again' }, { status: 401 });
    }
    if (requester.id === pet.ownerId) {
      return NextResponse.json({ error: 'This is your own pet' }, { status: 400 });
    }

    // One share row per (pet, email); the existing row decides the story
    const share = await prisma.petShare.findUnique({
      where: { petId_email: { petId: pet.id, email: requester.email } },
    });

    let outcome;
    if (share?.status === 'ACTIVE') {
      outcome = { alreadyActive: true };
    } else if (share?.status === 'REQUESTED') {
      outcome = { alreadyRequested: true };
    } else if (share?.status === 'PENDING') {
      // The owner already invited this exact person: complete the handshake
      await prisma.petShare.update({
        where: { id: share.id },
        data: { status: 'ACTIVE', userId: requester.id, respondedAt: new Date() },
      });
      outcome = { approved: true, wasInvited: true, role: share.role };
    } else {
      const count = await prisma.petShare.count({ where: { petId: pet.id } });
      if (count >= MAX_SHARES) {
        return NextResponse.json({ error: 'This pet has reached its sharing limit' }, { status: 400 });
      }
      await prisma.petShare.create({
        data: {
          petId: pet.id,
          email: requester.email,
          userId: requester.id,
          role: 'CAREGIVER',
          status: 'REQUESTED',
          invitedById: requester.id,
        },
      });
      outcome = { requested: true };
    }

    // Tell the owner (in-app + branded email), best effort
    if (outcome.requested) {
      const requesterName = requester.firstName || requester.email;
      createInAppNotification({
        userId: pet.ownerId,
        type: 'PET_SHARE',
        title: `${requesterName} wants to help care for ${pet.name}`,
        message: `They asked to join as a caretaker. Approve or decline in ${pet.name}'s sharing settings.`,
        actionUrl: `/pets/${pet.id}/share`,
      }).catch(() => {});

      if (pet.owner?.email) {
        const base = getEmailBaseUrl();
        sendEmail({
          to: pet.owner.email,
          subject: `${requesterName} wants to help care for ${pet.name}`,
          html: renderBrandedEmail({
            preheader: `${requesterName} asked to become a caretaker for ${pet.name}.`,
            heading: 'A caretaker request',
            bodyHtml: `<p>Hi ${pet.owner.firstName || 'there'},</p>
              <p><strong>${requesterName}</strong> (${requester.email}) saw ${pet.name}'s care page and asked to help as a caretaker. Caretakers can log doses and keep the record up to date.</p>
              <p>Nothing changes until you approve.</p>`,
            ctaLabel: 'Review the request',
            ctaUrl: `${base}/pets/${pet.id}/share`,
            footnote: 'You can approve, decline, or turn off link sharing any time.',
          }),
        }).catch((err) => console.error('[PET VIEW] Owner email failed:', err?.message));
      }
    }

    return NextResponse.json({ ...outcome, accountCreated });
  } catch (error) {
    console.error('[PET VIEW] Request failed:', error);
    return NextResponse.json({ error: 'Failed to send the request' }, { status: 500 });
  }
}
