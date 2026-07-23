/**
 * GET /api/shelter/inquiries - the caller's shelter inbox: adoption
 * inquiries from the public page, newest first, any team member.
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
    const membership = await getShelterForUser(session.user.id, session.user.email);
    if (!membership) {
      return NextResponse.json({ error: 'You don\'t manage a shelter' }, { status: 403 });
    }

    const inquiries = await prisma.shelterInquiry.findMany({
      where: { shelterId: membership.shelterId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, name: true, email: true, phone: true, message: true,
        status: true, createdAt: true,
        pet: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ inquiries });
  } catch (error) {
    console.error('[SHELTER-INQUIRIES] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load inquiries' }, { status: 500 });
  }
}
