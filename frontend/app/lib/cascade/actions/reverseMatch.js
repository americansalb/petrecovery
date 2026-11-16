/**
 * reverse_match action (tier 0) - the instant "we may already have found your
 * pet" moment. Cross-checks the new lost report against ACTIVE found reports
 * (attribute + microchip). Surfaces coarsened, PII-free matches on the success
 * screen, and - for actionable-band matches - alerts the FINDER (in-app, push
 * and an email to the address they gave; no unsolicited third-party SMS).
 */

import prisma from '@/app/lib/prisma';
import { reverseMatch, formatMatch } from '../reverseMatch.js';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendPushToUser } from '@/app/lib/push';
import { sendEmail, renderBrandedEmail, escapeHtml } from '@/app/lib/email';
import { isDeliverableEmail } from '@/app/lib/placeholderEmail';
import { getEmailBaseUrl } from '@/app/lib/config';

export async function runReverseMatch(ctx) {
  const lost = ctx.case;
  const lostChip = lost.pet?.microchipId || null;

  // Found pets of the species within a box about 25 miles across around the
  // last-seen point (the scorer gates on 15 miles; this keeps the read off
  // every found pet in the world). A microchip match is identity and is
  // looked for everywhere.
  const lat = Number(lost.lastSeenLatitude);
  const lng = Number(lost.lastSeenLongitude);
  const hasSpot = Number.isFinite(lat) && Number.isFinite(lng);
  const latPad = 0.36;
  const lngPad = 0.36 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const nearby = hasSpot
    ? {
        petSpecies: lost.petSpecies,
        lastSeenLatitude: { gte: lat - latPad, lte: lat + latPad },
        lastSeenLongitude: { gte: lng - lngPad, lte: lng + lngPad },
      }
    : { petSpecies: lost.petSpecies };
  const candidates = await prisma.case.findMany({
    where: {
      reportType: 'FOUND',
      status: 'ACTIVE',
      OR: [nearby, ...(lostChip ? [{ pet: { microchipId: lostChip } }] : [])],
    },
    include: { pet: true },
    take: 300,
    orderBy: { createdAt: 'desc' },
  });

  const scored = reverseMatch(lost, candidates, { minScore: 35, maxResults: 8 });
  const matches = scored.map(formatMatch);

  // Alert finders of actionable-band matches: the bell, a push, and an email
  // to the address the finder gave for owners to reach them (never a text to
  // a stranger's number). Every link opens the LOST pet's page, with its
  // photo and the ways to reach the owner; it used to open the finder's own
  // report, which does not mention the lost pet.
  let notified = 0;
  const actionable = scored.filter((m) => m.band === 'actionable');
  const lostPath = `/cases/${encodeURIComponent(lost.caseNumber)}`;
  await Promise.allSettled(
    actionable.map(async (m) => {
      const finderId = m.case.reporterId;
      if (!finderId) return;
      const species = (lost.petSpecies || 'pet').toLowerCase();
      const name = lost.petName || `the ${species}`;
      const words = `${name} was reported lost near where you found a ${species}, and looks like it. If it is the same ${species}, tell the owner from ${name}'s page.`;
      try {
        await createInAppNotification({
          userId: finderId,
          type: 'MATCH_ALERT',
          title: `Is the ${species} you found ${name}?`,
          message: words,
          actionUrl: lostPath,
          data: JSON.stringify({ type: 'REVERSE_MATCH', lostCaseNumber: lost.caseNumber, foundCaseNumber: m.case.caseNumber }),
        });
        await sendPushToUser(prisma, finderId, {
          title: `Is the ${species} you found ${name}?`,
          body: words,
          url: lostPath,
          type: 'MATCH_ALERT',
          data: { type: 'REVERSE_MATCH' },
        }).catch(() => null);
        if (isDeliverableEmail(m.case.ownerEmail)) {
          await sendEmail({
            to: m.case.ownerEmail,
            subject: `Is the ${species} you found ${name}?`,
            html: renderBrandedEmail({
              preheader: words,
              heading: `Is the ${species} you found ${name}?`,
              bodyHtml: `<p>${escapeHtml(words)}</p><p style="color:#64748b; font-size:14px;">Before you hand the ${escapeHtml(species)} over, ask the owner to show it is theirs: photos of it at home, a vet record or the microchip number.</p>`,
              ctaLabel: `See ${name}'s page`,
              ctaUrl: `${getEmailBaseUrl()}${lostPath}`,
              footnote: "You're receiving this because you reported a found pet on ReunitePets.",
            }),
          }).catch(() => null);
        }
        notified += 1;
      } catch (err) {
        // one finder failing must not sink the others / the step
        console.error('[reverse_match] finder notify failed:', err.message);
      }
    })
  );

  return { count: matches.length, result: { matches, actionable: actionable.length, notified } };
}
