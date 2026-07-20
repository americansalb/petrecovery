/**
 * Shelter claim-by-invite (the /shelter/claim page's API).
 *
 * GET  /api/shelter/claim?token= - preview the invite (signed in)
 * POST /api/shelter/claim { token } - accept: become the shelter's
 *      owner. Admin outreach IS the review, so accepting activates and
 *      verifies the shelter immediately. Token is one-time (cleared on
 *      accept) and expires after 7 days.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

async function loadInvite(token) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: 'Authentication required', status: 401 };

  if (!token || typeof token !== 'string' || token.length < 20) {
    return { error: 'This invite link is not valid', status: 404 };
  }

  const profile = await prisma.shelterProfile.findFirst({
    where: { inviteToken: token },
  });
  if (!profile) return { error: 'This invite link is not valid', status: 404 };
  if (profile.claimedById) return { error: 'This shelter is already managed', status: 409 };
  if (profile.inviteExpiresAt && profile.inviteExpiresAt < new Date()) {
    return { error: 'This invite has expired. Reply to the invite email and we will send a fresh one.', status: 410 };
  }

  // One shelter per account, matching the request flow's rule.
  const alreadyManages = await prisma.shelterProfile.findFirst({
    where: { claimedById: session.user.id },
    select: { shelterId: true },
  });
  if (alreadyManages) return { error: 'You already manage a shelter', status: 400 };

  const shelter = await prisma.shelter.findUnique({
    where: { id: profile.shelterId },
    select: { id: true, name: true, city: true, state: true },
  });
  if (!shelter) return { error: 'This invite link is not valid', status: 404 };

  return { session, profile, shelter };
}

export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    const ctx = await loadInvite(token);
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    return NextResponse.json({ shelter: ctx.shelter });
  } catch (error) {
    console.error('[SHELTER-CLAIM] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load invite' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ctx = await loadInvite(body?.token);
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    await prisma.$transaction([
      prisma.shelterProfile.update({
        where: { shelterId: ctx.shelter.id },
        data: {
          claimedById: ctx.session.user.id,
          claimedAt: new Date(),
          inviteToken: null, // one-time
          inviteEmail: null,
          inviteExpiresAt: null,
        },
      }),
      prisma.shelter.update({
        where: { id: ctx.shelter.id },
        data: { isActive: true, isVerified: true },
      }),
    ]);

    logEvent({
      event_type: 'shelter.invite.claimed',
      resource_type: 'shelter',
      resource_id: ctx.shelter.id,
      action: 'update',
      result: 'success',
      actor_user_id: ctx.session.user.id,
    }).catch(() => {});

    return NextResponse.json({ ok: true, shelter: ctx.shelter });
  } catch (error) {
    console.error('[SHELTER-CLAIM] POST failed:', error);
    return NextResponse.json({ error: 'Failed to claim shelter' }, { status: 500 });
  }
}
