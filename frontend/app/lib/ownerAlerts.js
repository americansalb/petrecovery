/**
 * Owner alerts for a new FOUND report.
 *
 * Founder direction (2026-08-08): owners hear about every found pet of their
 * species near their case, not only high-confidence matches. The cruelty gate
 * survives as copy, not as silence: below the push floor we say plainly that
 * it may not be their pet. Two tiers:
 *
 *   match  - band 'actionable': in-app notification + "possible match" email
 *            + Alert row (unchanged contract from the CRIT-A/B fixes).
 *   nearby - any other open LOST case of the same species within
 *            NEARBY_RADIUS_MILES: email only. No in-app push, so the bell
 *            keeps meaning "we think this is your pet".
 *
 * Robustness rules (docs/OWNER_ENGAGEMENT_PLAN.md):
 *   - one email per owner per found report, match tier wins
 *   - EmailPreference respected: skip when sightingAlerts is off or the
 *     owner unsubscribed; every email carries the one-click unsubscribe link
 *   - placeholder emails (phone-only reporters) are skipped
 *   - every send is recorded in EmailLog
 *   - each recipient is isolated: one failure never blocks the report save
 *     or the other recipients
 *
 * Both tiers link to the FOUND pet's case page - the owner lands on the photo
 * of the actual animal and can act, instead of on their own page (which does
 * not render matches yet; see MVP_LAUNCH_PLAN.md P0-2).
 */

import prisma from '@/app/lib/prisma';
import { sendEmail, renderBrandedEmail, escapeHtml } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { isPlaceholderEmail } from '@/app/lib/placeholderEmail';
import { calculateDistance, hasCoords, pickCoord } from '@/app/lib/matching';

export const NEARBY_RADIUS_MILES = 10;

/** Round a distance for copy: "about 2 miles away", "under a mile away". */
function distancePhrase(miles) {
  if (!Number.isFinite(miles)) return 'close to where your pet went missing';
  if (miles < 1) return 'under a mile from where your pet went missing';
  const n = Math.round(miles);
  return `about ${n} mile${n === 1 ? '' : 's'} from where your pet went missing`;
}

/**
 * Decide who gets told what. Pure - exported for tests.
 *
 * @param {Object[]} matches   scored results from findMatches (each has .band and .case)
 * @param {Object[]} lostCases the raw open LOST candidates (include reporter, pet)
 * @param {Object}   found     { latitude, longitude }
 * @returns {Map<reporterId, {tier: 'match'|'nearby', lostCase, distance}>}
 */
export function planOwnerAlerts({ matches, lostCases, found }) {
  const plan = new Map();

  for (const m of matches) {
    if (m.band !== 'actionable') continue;
    const c = m.case;
    if (!c?.reporterId) continue;
    if (!plan.has(c.reporterId)) {
      plan.set(c.reporterId, { tier: 'match', lostCase: c, distance: m.details?.distance ?? null });
    }
  }

  const foundLat = pickCoord(found?.latitude, found?.lastSeenLatitude);
  const foundLng = pickCoord(found?.longitude, found?.lastSeenLongitude);
  if (!hasCoords(foundLat, foundLng)) return plan; // can't honestly say "near you"

  for (const c of lostCases) {
    if (!c?.reporterId || plan.has(c.reporterId)) continue; // match tier wins; one email per owner
    const lat = pickCoord(c.latitude, c.lastSeenLatitude);
    const lng = pickCoord(c.longitude, c.lastSeenLongitude);
    if (!hasCoords(lat, lng)) continue;
    const distance = calculateDistance(foundLat, foundLng, lat, lng);
    if (distance <= NEARBY_RADIUS_MILES) {
      plan.set(c.reporterId, { tier: 'nearby', lostCase: c, distance });
    }
  }

  return plan;
}

/** May we email this owner? Missing pref row = default-on (schema defaults). */
function emailAllowed(pref) {
  if (!pref) return true;
  if (pref.unsubscribedAt) return false;
  return pref.sightingAlerts !== false;
}

function unsubscribeFootnote(pref, base) {
  if (!pref?.unsubscribeToken) return 'ReunitePets never asks for payment to reconnect you with your pet.';
  const url = `${base}/api/unsubscribe/${pref.unsubscribeToken}?type=sighting_alerts`;
  return `ReunitePets never asks for payment to reconnect you with your pet. ` +
    `<a href="${url}">Stop these found-pet emails</a>.`;
}

/**
 * Tell every relevant owner about a new FOUND report. Never throws.
 *
 * @param {Object} report    the created FOUND Case row (id, caseNumber, petPhotoUrl)
 * @param {number[]} [center] the found location as [lat, lng] straight from the
 *                            request - preferred over the report row so the
 *                            nearby tier never depends on which columns the
 *                            create returned
 * @param {Object[]} matches scored results from findMatches
 * @param {Object[]} lostCases raw open LOST candidates (include reporter, pet)
 * @param {string} petType   e.g. 'dog'
 * @returns {Promise<{matchesNotified: number, nearbyNotified: number}>}
 */
export async function alertOwnersOfFoundReport({ report, center, matches, lostCases, petType }) {
  const species = String(petType || 'pet').toLowerCase();
  const base = getEmailBaseUrl();
  const foundUrl = `${base}/cases/${report.caseNumber}`;

  const plan = planOwnerAlerts({
    matches,
    lostCases,
    found: {
      latitude: pickCoord(Array.isArray(center) ? center[0] : null, report.lastSeenLatitude),
      longitude: pickCoord(Array.isArray(center) ? center[1] : null, report.lastSeenLongitude),
    },
  });

  if (plan.size === 0) return { matchesNotified: 0, nearbyNotified: 0 };

  // Preferences for everyone in one query; missing rows default to allowed.
  let prefByUser = new Map();
  try {
    const prefs = await prisma.emailPreference.findMany({
      where: { userId: { in: [...plan.keys()] } },
    });
    prefByUser = new Map(prefs.map((p) => [p.userId, p]));
  } catch (err) {
    console.error('Owner-alert preference load failed, defaulting to allowed:', err?.message);
  }

  let matchesNotified = 0;
  let nearbyNotified = 0;

  await Promise.all(
    [...plan.entries()].map(async ([ownerId, { tier, lostCase, distance }]) => {
      try {
        const petName = lostCase.pet?.name || lostCase.petName || 'your pet';
        const ownerEmail = lostCase.reporter?.email;
        const pref = prefByUser.get(ownerId);

        if (tier === 'match') {
          // In-app push is reserved for matches: the bell means "we think this
          // is your pet". Links to the FOUND case so tapping shows the animal.
          await createInAppNotification({
            userId: ownerId,
            type: 'FOUND_MATCH',
            title: `Possible match for ${petName}`,
            message: `Someone just reported a found ${species} that may match your lost pet. Tap to see it.`,
            actionUrl: `/cases/${report.caseNumber}`,
            data: { foundCaseId: report.id, lostCaseId: lostCase.id },
          });
        }

        let emailed = false;
        if (ownerEmail && !isPlaceholderEmail(ownerEmail) && emailAllowed(pref)) {
          const isMatch = tier === 'match';
          const subject = isMatch
            ? `Possible match for ${petName} - ReunitePets.org`
            : `A found ${species} was reported near where ${petName} went missing`;
          const heading = isMatch
            ? `A possible match for ${escapeHtml(petName)}`
            : `A found ${escapeHtml(species)} near your search area`;
          const bodyHtml = isMatch
            ? `<p>Someone just reported a found ${escapeHtml(species)} that may match ${escapeHtml(petName)}. Take a look and connect through the site.</p>`
            : `<p>Someone just reported a found ${escapeHtml(species)} ${escapeHtml(distancePhrase(distance))}.</p>` +
              `<p>It may not be ${escapeHtml(petName)}. We send one of these for every found ${escapeHtml(species)} close to your case, so you can check quickly. A photo is on the report.</p>`;

          const sendResult = await sendEmail({
            to: ownerEmail,
            subject,
            html: renderBrandedEmail({
              preheader: isMatch
                ? `A found ${species} may match ${petName}.`
                : `A found ${species} was reported near your search area.`,
              heading,
              bodyHtml,
              ctaLabel: isMatch ? 'See the possible match' : `See the found ${species}`,
              ctaUrl: foundUrl,
              footnote: unsubscribeFootnote(pref, base),
            }),
          });

          // sendEmail never throws: {success:false, skipped} when email is not
          // configured, {success:false, error} on provider failure. Only a
          // real send counts as "notified" or earns an EmailLog row.
          if (sendResult?.success) {
            emailed = true;
            // Audit trail - best-effort, never blocks the send path. Guarded
            // sync AND async: a throw here after a successful send must not
            // mark the recipient failed.
            try {
              prisma.emailLog
                .create({
                  data: {
                    userId: ownerId,
                    emailType: isMatch ? 'FOUND_MATCH' : 'NEARBY_FOUND_ALERT',
                    subject,
                    sentTo: ownerEmail,
                  },
                })
                .catch(() => {});
            } catch {
              // audit is optional; the alert already went out
            }
          }
        }

        if (tier === 'match') {
          // Alert row: the durable "this owner was told" record (CRIT-B shape:
          // the Alert model's field is caseId).
          await prisma.alert.create({
            data: {
              caseId: lostCase.id,
              userId: ownerId,
              method: 'EMAIL',
              deliveredAt: new Date(),
            },
          });
          matchesNotified++;
        } else if (emailed) {
          // Honest count: a nearby owner whose email was suppressed (prefs,
          // placeholder address) was NOT notified - email is that tier's only
          // channel. Match-tier owners always count: the in-app + Alert row
          // deliver even when their email is off.
          nearbyNotified++;
        }
      } catch (err) {
        console.error('Owner alert failed for owner', ownerId, err?.message);
        // Isolated - never fail the report save or block other recipients.
      }
    })
  );

  return { matchesNotified, nearbyNotified };
}
