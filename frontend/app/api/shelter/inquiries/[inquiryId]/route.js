/**
 * PATCH /api/shelter/inquiries/[inquiryId] - work an inquiry: mark it
 * replied or closed (or back to new). Any team member; other shelters'
 * inquiries read as 404, non-probeable.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getShelterForUser } from '@/app/lib/shelterAuth';

const STATUSES = ['NEW', 'REPLIED', 'CLOSED'];

export async function PATCH(request, { params }) {
  try {
    const { inquiryId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const membership = await getShelterForUser(session.user.id, session.user.email);
    if (!membership) {
      return NextResponse.json({ error: 'You don\'t manage a shelter' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const status = body?.status;
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const inquiry = await prisma.shelterInquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, shelterId: true },
    });
    if (!inquiry || inquiry.shelterId !== membership.shelterId) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    await prisma.shelterInquiry.update({ where: { id: inquiryId }, data: { status } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[SHELTER-INQUIRIES] PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to update inquiry' }, { status: 500 });
  }
}
