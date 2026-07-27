/**
 * GET /api/account/modes - which worlds does this person belong to?
 *
 * One account can wear several hats: their own animals, a shelter they
 * help run, a rescue force they ride with. This endpoint answers "which
 * of those exist for me right now" so the switcher can offer them.
 *
 * PRESENTATION ONLY. Nothing here grants authority. Every guarded route
 * re-derives permission from the database on its own (see
 * docs/PERMISSIONS.md); a person who picks "shelter mode" without a
 * shelter hat simply gets redirected back out.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getShelterForUser } from '@/app/lib/shelterAuth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Owning animals needs no membership: it is what an account is for.
    const modes = [
      {
        id: 'owner',
        label: 'My pets',
        detail: 'Your own animals',
        href: '/pets',
      },
    ];

    const [membership, rescue] = await Promise.all([
      getShelterForUser(session.user.id, session.user.email),
      prisma.rescueForceMember.findFirst({
        where: { userId: session.user.id, isActive: true, leftAt: null },
        orderBy: { joinedAt: 'asc' },
        select: { rescueSquad: { select: { id: true, name: true } } },
      }),
    ]);

    if (membership) {
      const shelter = await prisma.shelter.findUnique({
        where: { id: membership.shelterId },
        select: { name: true },
      });
      modes.push({
        id: 'shelter',
        label: shelter?.name || 'Your shelter',
        detail: 'Shelter workspace',
        href: '/my-shelter',
      });
    }

    // The searcher door is ALWAYS offered - it is the recruitment door,
    // not a members-only area. Members land on their force; everyone
    // else lands on the network to find one.
    if (rescue?.rescueSquad) {
      modes.push({
        id: 'searcher',
        label: rescue.rescueSquad.name,
        detail: 'Searching · your rescue force',
        href: `/rescue-forces/${rescue.rescueSquad.id}`,
      });
    } else {
      modes.push({
        id: 'searcher',
        label: 'Searcher',
        detail: 'Help find pets near you',
        href: '/rescue-forces/search',
      });
    }

    return NextResponse.json({ modes });
  } catch (error) {
    console.error('[ACCOUNT-MODES] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load account modes' }, { status: 500 });
  }
}
