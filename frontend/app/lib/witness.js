/**
 * A sighting from a witness: someone holding the pet's share link
 * (/join/[id]) who has no account and is not going to make one standing
 * on a street corner. The sighting goes everywhere a member's would: the
 * pet's page ("What happened"), the owner's phone, the bell and push of
 * every force looking for the pet (app/lib/wake.js), and the Mission
 * Control board, live. The Discussion post needs an author, so a signed-in
 * witness gets one and an anonymous one does not.
 *
 * The route: POST /api/public/missions/[caseNumber]/sighting.
 */

import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { placeName } from '@/app/lib/needOptions';
import { feedPost, forcesOf, postToForces } from '@/app/lib/forceFeed';
import { wakeForces, WAKE_KINDS } from '@/app/lib/wake';
import { isPushConfigured, sendPushToUser } from '@/app/lib/push';
import { sendEmail } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';

/** How sure the witness is, as the 1 to 5 certainty the sighting stores. */
export const SURE = { SURE: 5, LIKELY: 3, UNSURE: 1 };

const DIRECTIONS = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTHEAST', 'NORTHWEST', 'SOUTHEAST', 'SOUTHWEST'];
const NAME_MAX = 60;
const NOTE_MAX = 600;

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Checks the body of a witness sighting. Returns { error } in words the
 * page shows, or { value } ready to record.
 */
export function checkWitnessSighting(body = {}) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: 'Mark where you saw the pet on the map.' };
  }
  const sure = String(body.sure || 'LIKELY').toUpperCase();
  if (!(sure in SURE)) return { error: 'Say how sure you are.' };
  const direction = body.direction ? String(body.direction).toUpperCase() : null;
  if (direction && !DIRECTIONS.includes(direction)) return { error: 'Which way did the pet go? Pick a direction.' };
  return {
    value: {
      lat,
      lng,
      sure,
      direction,
      name: clean(body.name, NAME_MAX),
      note: clean(body.note, NOTE_MAX),
      address: clean(body.address, 200),
    },
  };
}

/**
 * Records the sighting and tells everyone. `caseParam` is the case id or
 * number from the link. Returns { error: 'NOT_FOUND' | 'CLOSED' } or
 * { sighting, place, told }.
 */
export async function recordWitnessSighting(caseParam, value, { userId = null, now = new Date() } = {}) {
  const pet = await prisma.case.findFirst({
    where: missionWhere(caseParam),
    select: {
      id: true,
      caseNumber: true,
      status: true,
      petName: true,
      petSpecies: true,
      lastSeenAddress: true,
      reporter: { select: { id: true, email: true, firstName: true } },
    },
  });
  if (!pet) return { error: 'NOT_FOUND' };
  if (pet.status === 'REUNITED' || pet.status === 'CLOSED_OTHER') return { error: 'CLOSED' };

  const name = pet.petName || 'The pet';
  const place = placeName(value.address) || null;
  const who = value.name || null;
  const heading = value.direction ? `Heading ${value.direction.toLowerCase()}.` : '';
  const description = [value.note, heading].filter(Boolean).join(' ') || `Seen by ${who || 'someone with the link'}.`;

  const sighting = await prisma.caseSighting.create({
    data: {
      missionId: pet.id,
      reportedById: userId,
      reporterName: who,
      sightedAt: now,
      latitude: value.lat,
      longitude: value.lng,
      address: value.address || 'Marked on the map',
      description,
      certaintyLevel: SURE[value.sure],
      photoUrls: '[]',
      isVerified: false,
    },
  });

  if (pet.status === 'ACTIVE' || pet.status === 'IN_PROGRESS') {
    await prisma.case.update({ where: { id: pet.id }, data: { status: 'SIGHTING_REPORTED' } });
  }

  const told = { owner: false, bell: 0, pushed: 0 };
  const url = `/cases/${encodeURIComponent(pet.caseNumber)}`;
  const near = place ? `Near ${place}.` : 'Marked on the map.';
  const sureWords = value.sure === 'SURE' ? `${who || 'Someone'} is sure it was ${name}.` : value.sure === 'UNSURE' ? `${who || 'Someone'} is not sure it was ${name}.` : `${who || 'Someone'} thinks it was ${name}.`;

  // The forces looking for the pet: the Discussion post (signed-in witness
  // only; a post has an author) and the wake-up for everyone else.
  try {
    const forceIds = await forcesOf(pet.id);
    if (forceIds.length) {
      if (userId) {
        const seen = feedPost('SIGHTING', pet, { place, note: [value.note, heading].filter(Boolean).join(' ') });
        await postToForces({ forceIds, authorId: userId, caseId: pet.id, kind: 'SIGHTING', ...seen });
      }
      const woke = await wakeForces({
        forceIds,
        exceptUserId: userId,
        kind: WAKE_KINDS.SIGHTING,
        title: `${name} was just seen`,
        body: [near, heading, sureWords, "Don't chase. Say where it goes."].filter(Boolean).join(' '),
        url,
        data: { caseId: pet.id, sightingId: sighting.id },
        now,
      });
      told.bell = woke.bell;
      told.pushed = woke.pushed;
    }
  } catch (error) {
    console.error('[witness] force wake failed:', error?.message);
  }

  // The owner: the bell, a push, an email. Never the witness's own report.
  if (pet.reporter && pet.reporter.id !== userId) {
    told.owner = true;
    const title = `${name} was just seen`;
    const body = [near, heading, sureWords].filter(Boolean).join(' ');
    try {
      await prisma.notification.create({
        data: { userId: pet.reporter.id, type: 'SIGHTING', title, message: body, actionUrl: url, data: JSON.stringify({ caseId: pet.id, sightingId: sighting.id }) },
      });
    } catch (error) {
      console.error('[witness] owner bell failed:', error?.message);
    }
    if (isPushConfigured()) {
      sendPushToUser(prisma, pet.reporter.id, { title, body, url }).catch((e) => console.error('[witness] owner push failed:', e?.message));
    }
    if (pet.reporter.email) {
      const link = `${getEmailBaseUrl()}${url}`;
      sendEmail({
        to: pet.reporter.email,
        subject: `${name} was just seen${place ? ` near ${place}` : ''}`,
        html: `<p>Hi ${pet.reporter.firstName || 'there'},</p><p>${body}</p>${value.note ? `<p>"${value.note}"</p>` : ''}<p><a href="${link}">Open ${name}'s page</a> to see where, and tell everyone helping what to do.</p>`,
      }).catch((e) => console.error('[witness] owner email failed:', e?.message));
    }
  }

  // Everyone with the board open, live.
  try {
    const { broadcast } = await import('@/app/lib/sse/missionStream');
    broadcast(pet.id, {
      type: 'SIGHTING_REPORTED',
      sighting: { id: sighting.id, latitude: sighting.latitude, longitude: sighting.longitude, address: sighting.address, description: sighting.description, sightedAt: sighting.sightedAt, reportedByName: who },
    });
  } catch (error) {
    console.warn('[witness] broadcast failed:', error?.message);
  }

  return { sighting: { id: sighting.id, sightedAt: sighting.sightedAt }, place, told, caseNumber: pet.caseNumber, ownerName: pet.reporter?.firstName || null };
}
