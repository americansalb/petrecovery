/**
 * GET /api/rescue-forces/[id]/needs
 *
 * The force's open needs (app/lib/forceNeeds.js), what its Needs tab shows,
 * and the latest finished ones. Public, like the tab: a need's notes and
 * where the caller stands on each need come only for a member.
 *
 * POST /api/rescue-forces/[id]/needs
 *
 * A member adds a need for one of the force's pets (createNeed, which says
 * what the body holds). 400 with words for a field to fix; 409 with
 * `duplicate` when the pet already has this need (send `anyway` to add it
 * all the same). The sheet's choices come from .../needs/options.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { listNeeds, recentNeedActivity, createNeed, NeedError } from '@/app/lib/forceNeeds';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const force = await prisma.rescueForce.findFirst({ where: { id, isDeleted: false }, select: { id: true } });
    if (!force) return NextResponse.json({ error: 'Rescue Force not found' }, { status: 404 });

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const member = userId
      ? Boolean(await prisma.rescueForceMember.findFirst({ where: { rescueSquadId: id, userId, isActive: true }, select: { id: true } }))
      : false;

    const [needs, recent] = await Promise.all([
      listNeeds(id, { userId: member ? userId : null, member }),
      recentNeedActivity(id, { userId }),
    ]);
    return NextResponse.json({ needs, recent });
  } catch (error) {
    console.error('Force needs failed:', error);
    return NextResponse.json({ error: 'Failed to load needs' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const need = await createNeed({ forceId: id, userId: session.user.id, body });
    return NextResponse.json({ need }, { status: 201 });
  } catch (error) {
    if (error instanceof NeedError) {
      return NextResponse.json({ error: error.message, ...(error.duplicate && { duplicate: error.duplicate }) }, { status: error.status });
    }
    console.error('Adding a need failed:', error);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }
}
