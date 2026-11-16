/**
 * Writing to the finder of a found pet (app/lib/finderMessage.js).
 *
 * GET  /api/reports/[id]/message  what the page shows: the found pet, and
 *      whether its finder can be reached. Never the finder's email or phone.
 * POST /api/reports/[id]/message  { message, name?, replyTo? } sends the
 *      message to the finder by email, or by text when they gave only a
 *      phone. Answers { sent: true, via } only when it went.
 *
 * [id] is the found report's case number or id. Anyone may write: an owner
 * may see the found post shared on Facebook before they ever report. So it
 * is held to a few messages an hour from one address, and a few a day to
 * one finder, and the person writing must give the finder a way to write
 * back: an email or phone they choose to share, or a lost report of their
 * own (signed in, or this browser holds its key).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { sendEmail, renderBrandedEmail } from '@/app/lib/email';
import { sendSms } from '@/app/lib/sms';
import { getEmailBaseUrl } from '@/app/lib/config';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { withRateLimitAsync, checkRateLimitForKeyAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';
import { missionWhere } from '@/app/lib/shareMetadata';
import { casesHeldBy } from '@/app/lib/ownerKey';
import { OPEN_CASE_STATUSES, isCaseOpen } from '@/app/lib/caseStatus';
import { checkFinderMessage, finderReach, finderMessageEmail, finderMessageText, kindWord } from '@/app/lib/finderMessage';

export const dynamic = 'force-dynamic';

/** From one address to one finder, and to one finder from everyone. */
const PER_SENDER = { windowMs: 60 * 60 * 1000, maxRequests: 3, blockDurationMs: 60 * 60 * 1000 };
const PER_FINDER = { windowMs: 24 * 60 * 60 * 1000, maxRequests: 12, blockDurationMs: 60 * 60 * 1000 };

async function foundCase(param) {
  if (!param || typeof param !== 'string') return null;
  return prisma.case.findFirst({
    where: { ...missionWhere(param), reportType: 'FOUND' },
    select: {
      id: true,
      caseNumber: true,
      status: true,
      petName: true,
      petSpecies: true,
      petPhotoUrl: true,
      reporterId: true,
      ownerEmail: true,
      ownerPhone: true,
      reporter: { select: { email: true, phone: true } },
    },
  });
}

export async function GET(request, { params }) {
  const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_READ, 'reports:message:read');
  if (!rl.success) return rateLimitResponse(rl);
  const c = await foundCase((await params)?.id).catch(() => null);
  if (!c) return NextResponse.json({ error: 'There is no found-pet report at this link.' }, { status: 404 });
  return NextResponse.json({
    caseNumber: c.caseNumber,
    petName: c.petName,
    kind: kindWord(c.petSpecies),
    photo: c.petPhotoUrl || null,
    open: isCaseOpen(c.status),
    // Whether a message can go, and how, in a word. Never the address itself.
    reachBy: (() => {
      const reach = finderReach(c);
      return reach?.email ? 'email' : reach?.phone ? 'text' : null;
    })(),
  });
}

/** The newest open lost report of the person writing: theirs by session, or by the key this browser holds. */
async function ownLostReport(request, session) {
  if (session?.user?.id) {
    const mine = await prisma.case
      .findFirst({
        where: { reporterId: session.user.id, reportType: 'LOST', status: { in: [...OPEN_CASE_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        select: { caseNumber: true, petName: true },
      })
      .catch(() => null);
    if (mine) return mine;
  }
  const held = await casesHeldBy(request).catch(() => []);
  return held.find((c) => c.reportType === 'LOST' && isCaseOpen(c.status)) || null;
}

export async function POST(request, { params }) {
  const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'reports:message');
  if (!rl.success) return rateLimitResponse(rl);

  const body = await request.json().catch(() => null);
  const checked = checkFinderMessage(body || {});
  if (checked.error) return NextResponse.json({ error: checked.error, code: 'INVALID' }, { status: 400 });
  const { value } = checked;

  const c = await foundCase((await params)?.id).catch(() => null);
  if (!c) return NextResponse.json({ error: 'There is no found-pet report at this link.' }, { status: 404 });
  if (!isCaseOpen(c.status)) {
    return NextResponse.json({ error: 'This found-pet report is closed, so messages no longer go to the finder.', code: 'CLOSED' }, { status: 409 });
  }

  const session = await getServerSession(authOptions).catch(() => null);
  if (session?.user?.id && session.user.id === c.reporterId) {
    return NextResponse.json({ error: 'This is your own report.', code: 'OWN_REPORT' }, { status: 400 });
  }

  const baseUrl = getEmailBaseUrl();
  const mine = await ownLostReport(request, session);
  const fromReport = mine ? { petName: mine.petName, url: `${baseUrl}/cases/${encodeURIComponent(mine.caseNumber)}` } : null;
  if (!value.replyTo && !fromReport) {
    return NextResponse.json({ error: 'Add an email or phone number so the finder can write back.', code: 'NO_REPLY' }, { status: 400 });
  }

  const reach = finderReach(c);
  if (!reach) {
    return NextResponse.json({ error: 'This report has no email or phone we can send a message to.', code: 'FINDER_UNREACHABLE' }, { status: 409 });
  }

  // Counted only once the message is good: a typo does not use up a try.
  const perSender = await withRateLimitAsync(request, PER_SENDER, `reports:message:${c.id}`);
  if (!perSender.success) return rateLimitResponse(perSender);
  const perFinder = await checkRateLimitForKeyAsync(`reports:message:finder:${c.id}`, PER_FINDER);
  if (!perFinder.success) return rateLimitResponse(perFinder);

  const kind = kindWord(c.petSpecies);
  let sent;
  let via;
  if (reach.email) {
    via = 'email';
    const mail = finderMessageEmail({ value, kind, fromReport });
    sent = await sendEmail({
      to: reach.email,
      subject: mail.subject,
      html: renderBrandedEmail({
        preheader: value.message.slice(0, 90),
        heading: mail.heading,
        bodyHtml: mail.bodyHtml,
        ctaLabel: 'Open your report',
        ctaUrl: `${baseUrl}/cases/${encodeURIComponent(c.caseNumber)}`,
        footnote: "You're receiving this because you reported a found pet on ReunitePets.",
      }),
    }).catch(() => ({ success: false }));
  } else {
    via = 'text';
    sent = await sendSms(reach.phone, finderMessageText({ value, kind, fromReport }), { userId: c.reporterId, messageType: 'FINDER_MESSAGE' }).catch(() => ({ success: false }));
  }

  logEvent({
    event_type: 'finder_message.sent',
    resource_type: 'case',
    resource_id: c.id,
    action: 'create',
    result: sent?.success ? 'success' : 'failure',
    actor_user_id: session?.user?.id || null,
    metadata: { via, length: value.message.length, sharedReply: Boolean(value.replyTo), fromReport: Boolean(fromReport) },
  }).catch(() => {});

  if (!sent?.success) {
    return NextResponse.json({ error: 'The message did not send. Try again in a few minutes.', code: 'NOT_SENT' }, { status: 502 });
  }

  // And in the finder's bell, for when they sign in.
  createInAppNotification({
    userId: c.reporterId,
    type: 'FINDER_MESSAGE',
    title: `A message about the ${kind} you found`,
    message: [value.message.slice(0, 280), value.replyTo ? `Write back to ${value.replyTo.value}.` : fromReport ? `Their report: ${fromReport.url}` : ''].filter(Boolean).join(' '),
    actionUrl: `/cases/${encodeURIComponent(c.caseNumber)}`,
  }).catch(() => {});

  return NextResponse.json({ sent: true, via });
}
