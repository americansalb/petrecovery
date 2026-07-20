/**
 * One shelter seat.
 *
 * PATCH  /api/shelter/members/[memberId] - change role (OWNER/MANAGER;
 *        only the OWNER may touch a MANAGER's seat)
 * DELETE /api/shelter/members/[memberId] - revoke the seat, or the
 *        member themself declining/leaving. Rows are kept as REVOKED
 *        for audit, never deleted.
 *
 * Seats belonging to other shelters read as 404 so ids stay unprobeable.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getShelterForUser } from '@/app/lib/shelterAuth';
import { logEvent } from '@/lib/logging';

const ROLES = ['MANAGER', 'STAFF'];

async function loadContext(memberId) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: 'Authentication required', status: 401 };

  const member = await prisma.shelterMember.findUnique({ where: { id: memberId } });
  if (!member || member.status === 'REVOKED') return { error: 'Member not found', status: 404 };

  const email = (session.user.email || '').toLowerCase();
  const isSelf = member.userId === session.user.id || member.email === email;

  const membership = await getShelterForUser(session.user.id, session.user.email);
  const managesThisShelter = membership && membership.shelterId === member.shelterId;
  if (!managesThisShelter && !isSelf) return { error: 'Member not found', status: 404 };

  return { session, member, isSelf, myRole: managesThisShelter ? membership.role : null };
}

export async function PATCH(request, { params }) {
  try {
    const { memberId } = await params;
    const ctx = await loadContext(memberId);
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    if (!['OWNER', 'MANAGER'].includes(ctx.myRole || '')) {
      return NextResponse.json({ error: 'Only managers can change roles' }, { status: 403 });
    }
    if (ctx.member.role === 'MANAGER' && ctx.myRole !== 'OWNER') {
      return NextResponse.json({ error: 'Only the shelter owner can change a manager\'s seat' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    if (!ROLES.includes(body?.role)) {
      return NextResponse.json({ error: 'role must be MANAGER or STAFF' }, { status: 400 });
    }

    const updated = await prisma.shelterMember.update({
      where: { id: ctx.member.id },
      data: { role: body.role },
    });
    return NextResponse.json({ member: { id: updated.id, role: updated.role, status: updated.status } });
  } catch (error) {
    console.error('[SHELTER-MEMBER] PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { memberId } = await params;
    const ctx = await loadContext(memberId);
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const managerRevoking = ['OWNER', 'MANAGER'].includes(ctx.myRole || '');
    if (!ctx.isSelf) {
      if (!managerRevoking) {
        return NextResponse.json({ error: 'Only managers can remove staff' }, { status: 403 });
      }
      if (ctx.member.role === 'MANAGER' && ctx.myRole !== 'OWNER') {
        return NextResponse.json({ error: 'Only the shelter owner can remove a manager' }, { status: 403 });
      }
    }

    await prisma.shelterMember.update({
      where: { id: ctx.member.id },
      data: { status: 'REVOKED', respondedAt: new Date() },
    });

    logEvent({
      event_type: ctx.isSelf ? 'shelter.member.left' : 'shelter.member.revoked',
      resource_type: 'shelter',
      resource_id: ctx.member.shelterId,
      action: 'update',
      result: 'success',
      actor_user_id: ctx.session.user.id,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[SHELTER-MEMBER] DELETE failed:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
