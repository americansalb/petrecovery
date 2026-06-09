/**
 * Pet Sharing API
 *
 * GET  /api/pets/[id]/shares - List who a pet is shared with (owner only)
 * POST /api/pets/[id]/shares - Invite someone by email (owner only)
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requirePetOwner } from '@/app/lib/petOwnership';
import { sendEmail } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';
import { logEvent } from '@/lib/logging';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SHARES_PER_PET = 10;

const shareSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  user: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
};

// GET /api/pets/[id]/shares
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetOwner(id);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const shares = await prisma.petShare.findMany({
      where: { petId: id },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }], // ACTIVE first
      select: shareSelect,
    });

    return NextResponse.json({ pet: auth.pet, shares });
  } catch (error) {
    console.error('[SHARES API] Error listing shares:', error);
    return NextResponse.json({ error: 'Failed to load sharing' }, { status: 500 });
  }
}

// POST /api/pets/[id]/shares
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetOwner(id);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').toLowerCase().trim();
    const role = body.role === 'VIEWER' ? 'VIEWER' : 'CAREGIVER';

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    if (email === auth.user.email) {
      return NextResponse.json({ error: "That's you — you already have full access" }, { status: 400 });
    }

    const count = await prisma.petShare.count({ where: { petId: id } });
    if (count >= MAX_SHARES_PER_PET) {
      return NextResponse.json({ error: `A pet can be shared with up to ${MAX_SHARES_PER_PET} people` }, { status: 400 });
    }

    const existing = await prisma.petShare.findUnique({
      where: { petId_email: { petId: id, email } },
    });
    if (existing) {
      return NextResponse.json(
        { error: existing.status === 'ACTIVE' ? 'Already shared with that email' : 'An invite for that email is already pending' },
        { status: 409 }
      );
    }

    // Link immediately if they already have an account (status stays PENDING
    // until they accept — access is never granted silently).
    const invitee = await prisma.user.findUnique({
      where: { email },
      select: { id: true, firstName: true },
    });

    const share = await prisma.petShare.create({
      data: {
        petId: id,
        email,
        userId: invitee?.id || null,
        role,
        invitedById: auth.user.id,
      },
      select: shareSelect,
    });

    // Fire-and-forget notification — sharing works even with email unconfigured.
    const inviter = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { firstName: true },
    });
    const baseUrl = getEmailBaseUrl();
    sendEmail({
      to: email,
      subject: `${inviter?.firstName || 'A pet owner'} shared ${auth.pet.name} with you on ReunitePets`,
      html: `
        <p>${inviter?.firstName || 'A pet owner'} invited you to help care for <strong>${auth.pet.name}</strong>.</p>
        <p>You'll be able to ${role === 'CAREGIVER' ? 'see their profile and track their medications' : 'view their profile and medication schedule'}.</p>
        <p><a href="${baseUrl}/pets">${invitee ? 'Open My Pets to accept the invite' : 'Create a free account with this email address to accept'}</a></p>
      `,
    }).catch(() => {});

    logEvent({
      event_type: 'pet.share_created',
      resource_type: 'pet_share',
      resource_id: share.id,
      action: 'create',
      result: 'success',
      actor_user_id: auth.user.id,
      metadata: { petId: id, role, inviteeExists: Boolean(invitee) },
    }).catch(() => {});

    return NextResponse.json({ share, message: `Invite sent to ${email}` }, { status: 201 });
  } catch (error) {
    console.error('[SHARES API] Error creating share:', error);
    return NextResponse.json({ error: 'Failed to share pet' }, { status: 500 });
  }
}
