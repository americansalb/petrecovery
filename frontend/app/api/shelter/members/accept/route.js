/**
 * POST /api/shelter/members/accept - the signed-in invitee accepts their
 * PENDING seat (matched by their account email, so a forwarded invite
 * can't seat the wrong person). Sets ACTIVE + links userId.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { logEvent } from '@/lib/logging';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const email = session.user.email.toLowerCase();
    const invite = await prisma.shelterMember.findFirst({
      where: { status: 'PENDING', OR: [{ email }, { userId: session.user.id }] },
    });
    if (!invite) {
      return NextResponse.json({ error: 'No pending invite for this account' }, { status: 404 });
    }

    await prisma.shelterMember.update({
      where: { id: invite.id },
      data: { status: 'ACTIVE', userId: session.user.id, respondedAt: new Date() },
    });

    const shelter = await prisma.shelter.findUnique({
      where: { id: invite.shelterId },
      select: { name: true },
    });

    createInAppNotification({
      userId: invite.invitedById,
      type: 'SHELTER_MEMBER_JOINED',
      title: 'Your invite was accepted',
      message: `${email} joined the ${shelter?.name || 'shelter'} team.`,
      actionUrl: '/shelter/dashboard',
    }).catch(() => {});

    logEvent({
      event_type: 'shelter.member.accepted',
      resource_type: 'shelter',
      resource_id: invite.shelterId,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
    }).catch(() => {});

    return NextResponse.json({ ok: true, shelterName: shelter?.name || null });
  } catch (error) {
    console.error('[SHELTER-MEMBERS] accept failed:', error);
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }
}
