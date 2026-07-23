/**
 * POST /api/shelters/[id]/inquiries - adoption interest from the public
 * shelter page. Replaces the old mailto CTA so inquiries land in the
 * shelter's portal inbox instead of getting lost in email.
 *
 * Public and unauthenticated, so: rate limited, validated, and only
 * claimed + active shelters accept inquiries (the same shelters that
 * have a public page at all; everything else 404s, non-probeable).
 * Staff are notified in-app + push, each recipient isolated.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendPushToUser } from '@/app/lib/push';
import { getShelterStaffUserIds } from '@/app/lib/shelterAuth';
import { logEvent } from '@/lib/logging';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 100;
const PHONE_MAX = 30;
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'shelter:inquiry');
    if (!rl.success) return rateLimitResponse(rl);

    const [shelter, profile] = await Promise.all([
      prisma.shelter.findUnique({ where: { id }, select: { id: true, isActive: true, name: true } }),
      prisma.shelterProfile.findUnique({ where: { shelterId: id }, select: { claimedById: true } }),
    ]);
    if (!shelter || !shelter.isActive || !profile?.claimedById) {
      return NextResponse.json({ error: 'Shelter not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim().slice(0, NAME_MAX);
    const email = String(body?.email || '').trim().toLowerCase();
    const phone = String(body?.phone || '').trim().slice(0, PHONE_MAX) || null;
    const message = String(body?.message || '').trim();

    if (name.length < 2) {
      return NextResponse.json({ error: 'Please tell the shelter your name' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email so the shelter can reply' }, { status: 400 });
    }
    if (message.length < MESSAGE_MIN) {
      return NextResponse.json({ error: 'Tell the shelter a little more (at least a sentence)' }, { status: 400 });
    }
    if (message.length > MESSAGE_MAX) {
      return NextResponse.json({ error: `Messages are capped at ${MESSAGE_MAX} characters` }, { status: 400 });
    }

    // A petId that isn't this shelter's animal becomes a general inquiry
    // rather than an error; the message still matters more than the tag.
    let petId = null;
    if (body?.petId) {
      const pet = await prisma.pet.findFirst({
        where: { id: String(body.petId), managedByShelterId: id, isDeleted: false },
        select: { id: true },
      });
      petId = pet?.id || null;
    }

    const inquiry = await prisma.shelterInquiry.create({
      data: { shelterId: id, petId, name, email, phone, message },
      select: { id: true },
    });

    // Notify staff; one person failing must not sink the rest.
    const userIds = await getShelterStaffUserIds(id);
    for (const userId of userIds) {
      try {
        await createInAppNotification({
          userId,
          type: 'SHELTER_INQUIRY',
          title: 'New adoption inquiry',
          message: `${name} asked about ${petId ? 'one of your animals' : 'adopting'} on your public page.`,
          actionUrl: '/my-shelter/inquiries',
        });
        await sendPushToUser(prisma, userId, {
          title: 'New adoption inquiry',
          body: `${name} is interested in adopting. Reply from your shelter portal.`,
          url: '/my-shelter/inquiries',
          type: 'SHELTER_INQUIRY',
        });
      } catch (err) {
        console.error('[SHELTER-INQUIRY] notify failed:', err.message);
      }
    }

    logEvent({
      event_type: 'shelter.inquiry.created',
      resource_type: 'shelter',
      resource_id: id,
      action: 'create',
      result: 'success',
    }).catch(() => {});

    return NextResponse.json({ ok: true, inquiryId: inquiry.id }, { status: 201 });
  } catch (error) {
    console.error('[SHELTER-INQUIRY] POST failed:', error);
    return NextResponse.json({ error: 'Failed to send your message' }, { status: 500 });
  }
}
