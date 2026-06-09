/**
 * Single Pet Share API
 *
 * PATCH  /api/pets/[id]/shares/[shareId]
 *        Owner: { role } to change permissions.
 *        Invitee: { action: 'accept' } to accept a pending invite.
 * DELETE /api/pets/[id]/shares/[shareId]
 *        Owner revokes, or invitee declines / leaves.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

const shareSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  user: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
};

/**
 * Loads the share + the caller's relationship to it.
 * Returns { user, share, isOwner, isInvitee } or { error, status }.
 */
async function resolveShare(petId, shareId) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { error: 'Unauthorized', status: 401 };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true },
  });
  if (!user) return { error: 'User not found', status: 404 };

  const share = await prisma.petShare.findUnique({
    where: { id: shareId },
    include: { pet: { select: { id: true, ownerId: true, name: true } } },
  });
  if (!share || share.petId !== petId) {
    return { error: 'Invite not found', status: 404 };
  }

  const isOwner = share.pet.ownerId === user.id;
  const isInvitee = share.userId === user.id || share.email === user.email;
  if (!isOwner && !isInvitee) {
    return { error: 'Invite not found', status: 404 }; // don't leak share ids
  }

  return { user, share, isOwner, isInvitee };
}

// PATCH /api/pets/[id]/shares/[shareId]
export async function PATCH(request, { params }) {
  try {
    const { id, shareId } = await params;
    const ctx = await resolveShare(id, shareId);
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const body = await request.json().catch(() => ({}));

    // Invitee accepting their invite
    if (body.action === 'accept') {
      if (!ctx.isInvitee) {
        return NextResponse.json({ error: 'Only the invited person can accept' }, { status: 403 });
      }
      if (ctx.share.status === 'ACTIVE') {
        return NextResponse.json({ error: 'Already accepted' }, { status: 400 });
      }
      const share = await prisma.petShare.update({
        where: { id: shareId },
        data: { status: 'ACTIVE', userId: ctx.user.id, respondedAt: new Date() },
        select: shareSelect,
      });

      logEvent({
        event_type: 'pet.share_accepted',
        resource_type: 'pet_share',
        resource_id: shareId,
        action: 'update',
        result: 'success',
        actor_user_id: ctx.user.id,
        metadata: { petId: id },
      }).catch(() => {});

      return NextResponse.json({ share, message: `You now help care for ${ctx.share.pet.name}` });
    }

    // Owner changing the role
    if (body.role) {
      if (!ctx.isOwner) {
        return NextResponse.json({ error: 'Only the owner can change permissions' }, { status: 403 });
      }
      if (!['CAREGIVER', 'VIEWER'].includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      const share = await prisma.petShare.update({
        where: { id: shareId },
        data: { role: body.role },
        select: shareSelect,
      });
      return NextResponse.json({ share });
    }

    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  } catch (error) {
    console.error('[SHARES API] Error updating share:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE /api/pets/[id]/shares/[shareId]
export async function DELETE(request, { params }) {
  try {
    const { id, shareId } = await params;
    const ctx = await resolveShare(id, shareId);
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    await prisma.petShare.delete({ where: { id: shareId } });

    logEvent({
      event_type: 'pet.share_removed',
      resource_type: 'pet_share',
      resource_id: shareId,
      action: 'delete',
      result: 'success',
      actor_user_id: ctx.user.id,
      metadata: { petId: id, by: ctx.isOwner ? 'owner' : 'invitee', wasActive: ctx.share.status === 'ACTIVE' },
    }).catch(() => {});

    return NextResponse.json({
      message: ctx.isOwner ? 'Access removed' : ctx.share.status === 'ACTIVE' ? `You left ${ctx.share.pet.name}'s care team` : 'Invite declined',
    });
  } catch (error) {
    console.error('[SHARES API] Error deleting share:', error);
    return NextResponse.json({ error: 'Failed to remove' }, { status: 500 });
  }
}
