/**
 * Shelter staff seats (the PetShare invite pattern, shelter-wide).
 *
 * GET  /api/shelter/members - list the caller's shelter team
 * POST /api/shelter/members - invite a member by email (OWNER/MANAGER only)
 *
 * Invites stay PENDING until the invitee accepts; access is never granted
 * silently. Rate-limited because it emails arbitrary addresses.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getShelterForUser } from '@/app/lib/shelterAuth';
import { sendEmail, renderBrandedEmail, escapeHtml } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['MANAGER', 'STAFF'];
const MAX_MEMBERS_PER_SHELTER = 15;

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

    const [members, profile] = await Promise.all([
      prisma.shelterMember.findMany({
        where: { shelterId: membership.shelterId, status: { not: 'REVOKED' } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, email: true, role: true, status: true,
          userId: true, createdAt: true, respondedAt: true,
        },
      }),
      prisma.shelterProfile.findUnique({
        where: { shelterId: membership.shelterId },
        select: { claimedById: true, claimedAt: true },
      }),
    ]);

    // Names live on linked accounts; ShelterMember only stores the email.
    const ids = [...new Set(
      [profile?.claimedById, ...members.map((m) => m.userId)].filter(Boolean)
    )];
    const users = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const displayName = (u) => (u ? [u.firstName, u.lastName].filter(Boolean).join(' ') : '') || null;

    const claimer = profile?.claimedById ? byId.get(profile.claimedById) : null;
    const owner = claimer
      ? { name: displayName(claimer), email: claimer.email, claimedAt: profile.claimedAt }
      : null;

    return NextResponse.json({
      owner,
      members: members.map(({ userId, ...m }) => ({
        ...m,
        name: userId ? displayName(byId.get(userId)) : null,
      })),
      myRole: membership.role,
    });
  } catch (error) {
    console.error('[SHELTER-MEMBERS] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load team' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const membership = await getShelterForUser(session.user.id, session.user.email);
    if (!membership || !['OWNER', 'MANAGER'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only managers can invite staff' }, { status: 403 });
    }

    // Emails arbitrary addresses, so throttle like any public write.
    const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'shelter:member-invite');
    if (!rl.success) return rateLimitResponse(rl);

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const role = ROLES.includes(body?.role) ? body.role : 'STAFF';
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }
    if (email === (session.user.email || '').toLowerCase()) {
      return NextResponse.json({ error: 'That\'s already your own email' }, { status: 400 });
    }

    const activeCount = await prisma.shelterMember.count({
      where: { shelterId: membership.shelterId, status: { not: 'REVOKED' } },
    });
    if (activeCount >= MAX_MEMBERS_PER_SHELTER) {
      return NextResponse.json(
        { error: `A shelter team is capped at ${MAX_MEMBERS_PER_SHELTER} seats` },
        { status: 400 }
      );
    }

    const existing = await prisma.shelterMember.findUnique({
      where: { shelterId_email: { shelterId: membership.shelterId, email } },
    });
    if (existing && existing.status !== 'REVOKED') {
      return NextResponse.json({ error: 'That person is already on the team' }, { status: 409 });
    }

    // Link the account now if it exists; the seat still waits for accept.
    const invitee = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const data = {
      role,
      status: 'PENDING',
      userId: invitee?.id || null,
      invitedById: session.user.id,
      respondedAt: null,
    };
    const member = existing
      ? await prisma.shelterMember.update({ where: { id: existing.id }, data })
      : await prisma.shelterMember.create({
          data: { shelterId: membership.shelterId, email, ...data },
        });

    const shelter = await prisma.shelter.findUnique({
      where: { id: membership.shelterId },
      select: { name: true },
    });
    const baseUrl = getEmailBaseUrl();
    const ctaUrl = invitee
      ? `${baseUrl}/login?callbackUrl=${encodeURIComponent('/shelter/dashboard')}`
      : `${baseUrl}/register?callbackUrl=${encodeURIComponent('/shelter/dashboard')}`;
    try {
      await sendEmail({
        to: email,
        subject: `Help run ${shelter?.name || 'a shelter'} on ReunitePets`,
        html: renderBrandedEmail({
          preheader: `You've been invited to help manage ${shelter?.name || 'a shelter'} on ReunitePets.`,
          heading: `Join the ${shelter?.name || 'shelter'} team`,
          bodyHtml: `<p>You've been invited to help manage <strong>${escapeHtml(shelter?.name || 'a shelter')}</strong> on ReunitePets: animals in care, health records, adoptions, and lost-pet matches. Shelter accounts are free.</p><p>${invitee ? 'Sign in and accept the invite from your shelter dashboard.' : 'Create your free account with this email address, then accept the invite from your shelter dashboard.'}</p>`,
          ctaLabel: invitee ? 'Sign in to accept' : 'Create your free account',
          ctaUrl,
          footnote: `This invite was sent to ${email}. If you weren't expecting it, you can ignore this email.`,
        }),
      });
    } catch (e) {
      console.error('[SHELTER-MEMBERS] invite email failed:', e);
    }

    logEvent({
      event_type: 'shelter.member.invited',
      resource_type: 'shelter',
      resource_id: membership.shelterId,
      action: 'create',
      result: 'success',
      actor_user_id: session.user.id,
    }).catch(() => {});

    return NextResponse.json(
      { member: { id: member.id, email, role: member.role, status: member.status } },
      { status: 201 }
    );
  } catch (error) {
    console.error('[SHELTER-MEMBERS] POST failed:', error);
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
  }
}
