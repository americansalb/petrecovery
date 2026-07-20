/**
 * Pet transfer acceptance (invitee side).
 *
 * GET  /api/pets/transfer/[token] - preview the invite (auth + matching email)
 * POST /api/pets/transfer/[token] - accept: the record changes hands
 *
 * Acceptance is keyed to the invited email, not just the token, so a
 * forwarded or leaked link can't move a pet to the wrong account. On
 * accept, in one transaction: ownership flips to the invitee, the shelter
 * roster tag clears, every old share is removed, and the public view token
 * rotates off, so the record starts clean in its new home with its full
 * medical history intact.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

async function loadContext(token) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: 'Authentication required', status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true },
  });
  if (!user) return { error: 'User not found', status: 404 };

  const transfer = await prisma.petTransfer.findFirst({
    where: { token, status: 'PENDING' },
    include: {
      pet: {
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          primaryPhotoUrl: true,
          isDeleted: true,
          managedByShelter: { select: { name: true } },
        },
      },
      invitedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!transfer || transfer.pet.isDeleted) {
    return { error: 'This invite is no longer valid', status: 404 };
  }
  if (transfer.toEmail !== user.email.toLowerCase()) {
    return {
      error: 'This invite was sent to a different email address. Sign in with the account it was sent to.',
      status: 403,
    };
  }
  return { user, transfer };
}

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const ctx = await loadContext(token);
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { transfer } = ctx;
    const fromName =
      transfer.pet.managedByShelter?.name ||
      [transfer.invitedBy?.firstName, transfer.invitedBy?.lastName].filter(Boolean).join(' ') ||
      'The current caretaker';

    return NextResponse.json({
      pet: {
        name: transfer.pet.name,
        species: transfer.pet.species,
        breed: transfer.pet.breed,
        primaryPhotoUrl: transfer.pet.primaryPhotoUrl,
      },
      fromName,
    });
  } catch (error) {
    console.error('[PET-TRANSFER] token GET failed:', error);
    return NextResponse.json({ error: 'Failed to load invite' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const ctx = await loadContext(token);
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { user, transfer } = ctx;
    const petId = transfer.pet.id;

    await prisma.$transaction([
      prisma.pet.update({
        where: { id: petId },
        data: {
          ownerId: user.id,
          managedByShelterId: null, // leaves the shelter roster
          publicViewToken: null, // old shared links stop working
        },
      }),
      // Old care team (shelter staff etc.) loses access; the new owner
      // invites their own people fresh.
      prisma.petShare.deleteMany({ where: { petId } }),
      prisma.petTransfer.update({
        where: { id: transfer.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      }),
    ]);

    logEvent({
      event_type: 'pet.transfer.accepted',
      resource_type: 'pet',
      resource_id: petId,
      action: 'update',
      result: 'success',
      actor_user_id: user.id,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      petId,
      message: `${transfer.pet.name}'s record is now yours.`,
    });
  } catch (error) {
    console.error('[PET-TRANSFER] accept failed:', error);
    return NextResponse.json({ error: 'Failed to accept transfer' }, { status: 500 });
  }
}
