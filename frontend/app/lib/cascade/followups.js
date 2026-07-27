/**
 * Follow-up engine - the gentle day-1/3/7 check-ins that keep a search alive.
 *
 * At report time the `followups` action persists three PENDING CaseFollowUp
 * rows (dueAt in the future). They are delivered by draining due rows: a
 * secret-gated /api/cascade/sweep endpoint (wire a cron ping to it) AND an
 * opportunistic piggyback drain from runCascade + the case-page read, so the
 * reminders go out with zero extra infrastructure. Draining is idempotent: a
 * row is claimed atomically (PENDING -> SUCCESS) before it's sent, so two
 * concurrent drainers never double-send.
 */

import prisma from '@/app/lib/prisma';
import { sendEmail, renderBrandedEmail, escapeHtml } from '@/app/lib/email';
import { sendSms } from '@/app/lib/sms';
import { isPlaceholderEmail } from '@/app/lib/placeholderEmail';
import { getEmailBaseUrl } from '@/app/lib/config';

export const FOLLOWUP_DAYS = [1, 3, 7];

const DAY_MS = 24 * 60 * 60 * 1000;

/** A case is done receiving nudges once it's resolved in any way. */
export function isResolved(c) {
  return Boolean(
    c?.resolvedAt ||
      c?.resolution ||
      (c?.status && !['ACTIVE', 'PENDING'].includes(c.status))
  );
}

/** The right channel for a case: phone-only reporters get SMS, everyone else email. */
export function followUpChannel(c) {
  return isPlaceholderEmail(c?.ownerEmail) ? 'sms' : 'email';
}

/** Day-specific, encouraging copy. Never clinical - this is a hard week. */
export function followUpMessage(day, c) {
  const name = c?.petName || 'your pet';
  // subject/heading/preheader/smsText are plain text (heading is escaped in
  // renderBrandedEmail); bodyHtml is raw HTML, so it uses the escaped name.
  const nameHtml = escapeHtml(name);
  if (day <= 1) {
    return {
      subject: `Day one of the search for ${name}`,
      preheader: `Most pets are found close to home in the first 48 hours.`,
      heading: `Keep going. ${name} is likely still close`,
      bodyHtml: `<p style="margin:0 0 14px;">The first two days matter most, and most pets are found within a few blocks of where they went missing. Walk the immediate area again at dawn and dusk, when it's quiet. Bring their favorite treats and a familiar-smelling blanket.</p>
        <p style="margin:0 0 14px;">Your flyers and share images are ready on your case page. Print a few, post them at eye level on corners and mailboxes, and share the link one more time. The person who spots ${nameHtml} is often just one share away.</p>`,
      smsText: `Day 1 searching for ${name}: most pets are found close to home in the first 48h. Walk the area at dawn/dusk & re-share your case page:`,
    };
  }
  if (day <= 3) {
    return {
      subject: `Still searching for ${name}? Widen the net`,
      preheader: `A few days in. Time to widen the search and re-post.`,
      heading: `Three days in: widen the circle`,
      bodyHtml: `<p style="margin:0 0 14px;">If ${nameHtml} hasn't turned up nearby, it's time to widen the search radius and refresh your flyers so they don't blend into the background. Call every shelter and vet within ~20 miles and file a lost report in person if you can. Staff see dozens of animals a day.</p>
        <p style="margin:0 0 14px;">Re-posting on local groups now (not just the first day) reaches people who missed it. Your ready-to-post images and captions are still on your case page.</p>`,
      smsText: `Day 3 for ${name}: widen your radius, call shelters/vets within ~20mi & re-post your flyer. Everything's on your case page:`,
    };
  }
  return {
    subject: `One week in. Don't give up on ${name}`,
    preheader: `Pets are reunited weeks and even months later. Keep searching.`,
    heading: `One week in: keep the search alive`,
    bodyHtml: `<p style="margin:0 0 14px;">A week is hard, but pets are reunited with their families weeks and even months after going missing. Keep your flyers up and refresh the ones that have faded or come down. Visit the shelters again in person. Animals get transferred, and a photo on file isn't the same as your eyes on the kennels.</p>
      <p style="margin:0 0 14px;">Leave something with ${nameHtml}'s scent outside your door overnight. Keep sharing your case page. The community is still looking with you.</p>`,
    smsText: `Day 7 for ${name}: pets are found weeks later too. Refresh flyers, revisit shelters in person & keep sharing your case page:`,
  };
}

/** Deliver one follow-up over its channel. Throws on hard failure (caller records it). */
async function deliverFollowUp(fu, c) {
  const baseUrl = getEmailBaseUrl();
  const url = `${baseUrl}/cases/${c.caseNumber}`;
  const msg = followUpMessage(fu.day, c);

  if (fu.channel === 'sms') {
    if (!c.ownerPhone) throw new Error('no phone on file for SMS follow-up');
    await sendSms(c.ownerPhone, `${msg.smsText} ${url}`);
    return;
  }
  if (!c.ownerEmail || isPlaceholderEmail(c.ownerEmail)) {
    throw new Error('no deliverable email for follow-up');
  }
  const html = renderBrandedEmail({
    preheader: msg.preheader,
    heading: msg.heading,
    bodyHtml: msg.bodyHtml,
    ctaLabel: `Open ${c.petName || 'your'} case page`,
    ctaUrl: url,
    footnote: `You're getting this because you reported ${c.petName || 'a pet'} lost. It stops automatically once they're home.`,
  });
  await sendEmail({ to: c.ownerEmail, subject: msg.subject, html });
}

/**
 * Send every due follow-up (bounded, oldest first). Idempotent + concurrency
 * safe via an atomic PENDING->SUCCESS claim. Returns a small stats object.
 */
export async function drainDueFollowUps({ limit = 25 } = {}) {
  const now = new Date();
  const due = await prisma.caseFollowUp.findMany({
    where: { status: 'PENDING', dueAt: { lte: now } },
    orderBy: { dueAt: 'asc' },
    take: Math.max(1, Math.min(limit, 100)),
    include: { case: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const fu of due) {
    // Atomically claim the row so a concurrent drainer can't also send it.
    const claim = await prisma.caseFollowUp.updateMany({
      where: { id: fu.id, status: 'PENDING' },
      data: { status: 'SUCCESS', sentAt: now },
    });
    if (claim.count === 0) continue; // another drainer got it first

    const c = fu.case;
    if (!c || isResolved(c)) {
      await prisma.caseFollowUp.update({
        where: { id: fu.id },
        data: { status: 'SKIPPED', error: c ? 'case resolved' : 'case missing' },
      });
      skipped += 1;
      continue;
    }

    try {
      await deliverFollowUp(fu, c);
      sent += 1;
    } catch (err) {
      await prisma.caseFollowUp.update({
        where: { id: fu.id },
        data: { status: 'FAILED', error: String(err?.message || err).slice(0, 300) },
      });
      failed += 1;
    }
  }

  return { processed: due.length, sent, skipped, failed };
}

/** Fire-and-forget bounded drain for piggybacking on other requests. Never throws. */
export function piggybackDrain(limit = 5) {
  Promise.resolve()
    .then(() => drainDueFollowUps({ limit }))
    .catch(() => {});
}
