/**
 * GET /api/rescue-forces/[id]/needs
 *
 * The force's open needs (app/lib/forceNeeds.js), what its Needs tab shows,
 * and the latest finished ones. Public, like the tab: a need's notes and
 * where the caller stands on each need come only for a member.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { listNeeds, recentNeedActivity } from '@/app/lib/forceNeeds';

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
