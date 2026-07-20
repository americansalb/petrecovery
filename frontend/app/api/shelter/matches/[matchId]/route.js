/**
 * POST /api/shelter/matches/[matchId] - { action: 'confirm' | 'dismiss' }
 *
 * THE moment the product invariant flips: a human at the shelter looked
 * at the photos and said yes. Only then is the case owner notified
 * (in-app + branded email with the shelter's contact info + push + an
 * Alert receipt, each channel isolated so one failure never blocks the
 * rest). Dismiss is silent. 404 for matches that aren't the caller's
 * shelter's, so ids stay unprobeable.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { sendEmail, renderBrandedEmail } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendPushToUser } from '@/app/lib/push';
import { getShelterForUser } from '@/app/lib/shelterAuth';
import { logEvent } from '@/lib/logging';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const membership = await getShelterForUser(session.user.id, session.user.email);
    if (!membership) {
      return NextResponse.json({ error: 'You don\'t manage a shelter' }, { status: 403 });
    }
    const profile = { shelterId: membership.shelterId };

    const { matchId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    if (!['confirm', 'dismiss'].includes(action)) {
      return NextResponse.json({ error: 'action must be confirm or dismiss' }, { status: 400 });
    }

    const match = await prisma.shelterStrayMatch.findFirst({
      where: { id: matchId, shelterId: profile.shelterId, status: 'PENDING' },
      include: {
        pet: { select: { name: true, species: true, primaryPhotoUrl: true } },
        case: {
          select: {
            id: true, caseNumber: true, petName: true, reporterId: true,
            reporter: { select: { email: true, firstName: true } },
          },
        },
      },
    });
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (action === 'dismiss') {
      await prisma.shelterStrayMatch.update({
        where: { id: match.id },
        data: { status: 'DISMISSED', confirmedById: session.user.id, confirmedAt: new Date() },
      });
      return NextResponse.json({ ok: true, status: 'DISMISSED' });
    }

    // Confirm: mark first, then notify the owner through every channel.
    await prisma.shelterStrayMatch.update({
      where: { id: match.id },
      data: { status: 'CONFIRMED', confirmedById: session.user.id, confirmedAt: new Date() },
    });

    const shelter = await prisma.shelter.findUnique({
      where: { id: profile.shelterId },
      select: { name: true, address: true, city: true, state: true, phone: true, email: true },
    });

    const ownerId = match.case.reporterId;
    const caseUrl = `${getEmailBaseUrl()}/cases/${match.case.caseNumber}`;
    const petName = match.case.petName || 'your pet';
    let notified = 0;

    if (ownerId) {
      try {
        await createInAppNotification({
          userId: ownerId,
          type: 'SHELTER_MATCH_CONFIRMED',
          title: `A shelter believes they have ${petName}`,
          message: `${shelter?.name || 'A local shelter'} reviewed your report and believes an animal in their care may be ${petName}. Tap for their contact details.`,
          actionUrl: `/cases/${match.case.caseNumber}`,
          data: JSON.stringify({ type: 'SHELTER_MATCH', matchId: match.id }),
        });
        notified += 1;
      } catch (err) {
        console.error('[shelter-match] owner in-app failed:', err.message);
      }

      try {
        await sendPushToUser(prisma, ownerId, {
          title: `A shelter believes they have ${petName}`,
          body: `${shelter?.name || 'A local shelter'} thinks an animal in their care may be your pet. Tap to see their contact details.`,
          url: `/cases/${match.case.caseNumber}`,
          type: 'SHELTER_MATCH_CONFIRMED',
        });
      } catch (err) {
        console.error('[shelter-match] owner push failed:', err.message);
      }
    }

    if (match.case.reporter?.email && shelter) {
      const contactLines = [
        `<p><strong>${shelter.name}</strong><br/>${[shelter.address, `${shelter.city}, ${shelter.state}`].filter(Boolean).join('<br/>')}</p>`,
        shelter.phone ? `<p>Phone: <a href="tel:${shelter.phone}">${shelter.phone}</a></p>` : '',
        shelter.email ? `<p>Email: <a href="mailto:${shelter.email}">${shelter.email}</a></p>` : '',
      ].join('');
      try {
        await sendEmail({
          to: match.case.reporter.email,
          subject: `A shelter believes they have ${petName}`,
          html: renderBrandedEmail({
            preheader: `${shelter.name} reviewed your lost-pet report and thinks they may have ${petName}.`,
            heading: `${shelter.name} may have ${petName}`,
            bodyHtml: `<p>The shelter compared your report with an animal in their care and believes it could be ${petName}. Please contact them as soon as you can; bring proof of ownership (photos, vet records, or your microchip registration).</p>${contactLines}`,
            ctaLabel: 'View your case',
            ctaUrl: caseUrl,
            footnote: 'ReunitePets never asks for payment to reunite you with your pet.',
          }),
        });
      } catch (err) {
        console.error('[shelter-match] owner email failed:', err.message);
      }

      try {
        await prisma.alert.create({
          data: {
            caseId: match.case.id,
            userId: ownerId,
            method: 'EMAIL',
            deliveredAt: new Date(),
          },
        });
      } catch (err) {
        console.error('[shelter-match] alert receipt failed:', err.message);
      }
    }

    await prisma.shelterStrayMatch.update({
      where: { id: match.id },
      data: { ownerNotifiedAt: new Date() },
    });

    logEvent({
      event_type: 'shelter.stray_match.confirmed',
      resource_type: 'case',
      resource_id: match.case.id,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
    }).catch(() => {});

    return NextResponse.json({ ok: true, status: 'CONFIRMED', ownerNotified: notified > 0 });
  } catch (error) {
    console.error('[SHELTER-MATCHES] action failed:', error);
    return NextResponse.json({ error: 'Failed to update match' }, { status: 500 });
  }
}
