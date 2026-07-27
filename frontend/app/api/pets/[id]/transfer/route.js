/**
 * Pet transfer API (owner only): the adoption handoff.
 *
 * GET    /api/pets/[id]/transfer - the pet's pending transfer (or null)
 * POST   /api/pets/[id]/transfer - invite an adopter by email
 * DELETE /api/pets/[id]/transfer - cancel the pending transfer
 *
 * A transfer hands the WHOLE Health Book record (meds, vaccinations,
 * weights, photos) to the invitee. Built for shelter accounts sending a
 * pet home with its adopter, but any owner can use it (rehoming, a foster
 * passing to the forever home). Acceptance happens at
 * /pets/transfer/[token] and is keyed to the invitee's email.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { requirePetOwner } from '@/app/lib/petOwnership';
import { sendEmail, renderBrandedEmail, escapeHtml } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetOwner(id);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const transfer = await prisma.petTransfer.findFirst({
      where: { petId: id, status: 'PENDING' },
      select: { id: true, toEmail: true, createdAt: true },
    });
    return NextResponse.json({ transfer });
  } catch (error) {
    console.error('[PET-TRANSFER] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load transfer' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetOwner(id);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // Sends mail to an arbitrary address, so throttle like any public write.
    const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'pets:transfer');
    if (!rl.success) return rateLimitResponse(rl);

    const body = await request.json();
    const toEmail = String(body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(toEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }
    if (toEmail === auth.user.email.toLowerCase()) {
      return NextResponse.json({ error: 'That\'s already your own email' }, { status: 400 });
    }

    // One pending transfer per pet: a new invite replaces the old one.
    await prisma.petTransfer.updateMany({
      where: { petId: id, status: 'PENDING' },
      data: { status: 'CANCELED', respondedAt: new Date() },
    });

    const token = crypto.randomBytes(24).toString('base64url');
    const transfer = await prisma.petTransfer.create({
      data: { petId: id, toEmail, token, invitedById: auth.user.id },
      select: { id: true, toEmail: true, createdAt: true },
    });

    const acceptUrl = `${getEmailBaseUrl()}/pets/transfer/${token}`;
    // bodyHtml is raw HTML, so escape the user-controlled pet name before it
    // goes to an arbitrary address. heading/preheader/footnote are escaped
    // inside renderBrandedEmail.
    const petNameSafe = escapeHtml(auth.pet.name);
    // Email failure must not fail the request; the owner can re-send or
    // share the accept link directly from the dashboard.
    try {
      await sendEmail({
        to: toEmail,
        subject: `${auth.pet.name}'s health record is ready for you`,
        html: renderBrandedEmail({
          preheader: `Accept ${auth.pet.name}'s full health record on ReunitePets.`,
          heading: `${auth.pet.name} is coming home with you`,
          bodyHtml: `<p>The current caretaker of <strong>${petNameSafe}</strong> wants to hand you the pet's complete health record: medications, vaccinations, weight history, and photos, all in one place.</p><p>Accepting is free and takes a minute. The record becomes yours and the previous caretaker loses access.</p>`,
          ctaLabel: 'Accept the health record',
          ctaUrl: acceptUrl,
          footnote: `This invite was sent to ${toEmail}. If you weren't expecting it, you can ignore this email.`,
        }),
      });
    } catch (e) {
      console.error('[PET-TRANSFER] invite email failed:', e);
    }

    logEvent({
      event_type: 'pet.transfer.invited',
      resource_type: 'pet',
      resource_id: id,
      action: 'create',
      result: 'success',
      actor_user_id: auth.user.id,
    }).catch(() => {});

    return NextResponse.json({ transfer, acceptUrl }, { status: 201 });
  } catch (error) {
    console.error('[PET-TRANSFER] POST failed:', error);
    return NextResponse.json({ error: 'Failed to create transfer' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetOwner(id);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await prisma.petTransfer.updateMany({
      where: { petId: id, status: 'PENDING' },
      data: { status: 'CANCELED', respondedAt: new Date() },
    });
    return NextResponse.json({ ok: true, message: 'Transfer canceled. The invite link no longer works.' });
  } catch (error) {
    console.error('[PET-TRANSFER] DELETE failed:', error);
    return NextResponse.json({ error: 'Failed to cancel transfer' }, { status: 500 });
  }
}
