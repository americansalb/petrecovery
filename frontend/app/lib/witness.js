/**
 * A sighting from a witness: someone holding the pet's link who has no
 * account and is not going to make one standing on a street corner. The
 * sighting goes everywhere a member's would: the pet's page ("What
 * happened"), the owner's phone, the bell and push of every force looking
 * for the pet (app/lib/wake.js), and the search screen. The Discussion
 * post needs an author, so a signed-in witness gets one and an anonymous
 * one does not.
 *
 * There is one thing a witness does: send a place and a time. If the pet
 * moves they send again from where it is now. The same place sent again
 * a few minutes later is the same sighting, still true, so its time is
 * moved up and nobody is alerted twice.
 *
 * The route: POST /api/public/missions/[caseNumber]/sighting.
 */

import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { placeFromStreets } from '@/app/lib/streetWalks';
import { distanceMeters } from '@/app/lib/searchGrid';
import { placeName } from '@/app/lib/needOptions';
import { feedPost, forcesOf, postToForces } from '@/app/lib/forceFeed';
import { wakeForces, WAKE_KINDS } from '@/app/lib/wake';
import { isPushConfigured, sendPushToUser } from '@/app/lib/push';
import { sendEmail, escapeHtml } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';
import { briefFor } from '@/app/lib/brief';

/** How sure the witness is, as the 1 to 5 certainty the sighting stores. */
export const SURE = { SURE: 5, LIKELY: 3, UNSURE: 1 };

const DIRECTIONS = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTHEAST', 'NORTHWEST', 'SOUTHEAST', 'SOUTHWEST'];
/** A sighting can be filed for earlier, up to a week back. */
const MAX_MINUTES_AGO = 7 * 24 * 60;
const NAME_MAX = 60;
const NOTE_MAX = 600;

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** A sighting sent this soon after the pet was seen is announced as "just seen". */
const LIVE_MINUTES = 10;
/** Sent again this soon, from this near, it is the same sighting and not a new one. */
const SAME_SIGHTING_MS = 10 * 60 * 1000;
const SAME_SIGHTING_METERS = 60;

/** "30 minutes ago", "about an hour ago", "3 hours ago", "yesterday", "2 days ago". */
export function agoPhrase(minutes) {
  if (minutes < 60) return `${minutes} minutes ago`;
  if (minutes < 90) return 'about an hour ago';
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} hours ago`;
  if (minutes < 48 * 60) return 'yesterday';
  return `${Math.round(minutes / (24 * 60))} days ago`;
}

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
  const minutesAgo = Math.max(0, Math.min(MAX_MINUTES_AGO, Math.round(Number(body.minutesAgo) || 0)));
  return {
    value: {
      lat,
      lng,
      sure,
      direction,
      minutesAgo,
      name: clean(body.name, NAME_MAX),
      note: clean(body.note, NOTE_MAX),
      address: clean(body.address, 200),
    },
  };
}

/** The lines of the pet's board, to call a point by the corner it is on. Empty where there is no board. */
async function boardStreets(caseId) {
  const streets = [];
  try {
    const rows = await prisma.searchStreet.findMany({ where: { caseId }, select: { name: true, path: true } });
    for (const row of rows) {
      try {
        streets.push({ name: row.name, path: JSON.parse(row.path) });
      } catch {
        /* a line that does not parse names no place */
      }
    }
  } catch {
    /* no board: nothing is named from it */
  }
  return streets;
}

/**
 * Records the sighting and tells everyone. `caseParam` is the case id or
 * number from the link. Returns { error: 'NOT_FOUND' | 'CLOSED' } or
 * { sighting, place, told }. `again: true` marks a sighting that was
 * already on the map and had its time moved up.
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
  const point = { lat: value.lat, lng: value.lng };
  // The board knows the streets, so its corner ("Ramsey Ave and W 40th St") names the place where the
  // point is on it. Off the board, the place is whatever the witness typed or the map lookup gave.
  const corner = placeFromStreets(await boardStreets(pet.id), point) || '';
  const address = corner || value.address || '';
  const place = placeName(address) || address || null;
  const who = value.name || null;
  const heading = value.direction ? `Heading ${value.direction.toLowerCase()}.` : '';
  // A sighting can be sent for earlier. Only one sent as it happens is "just seen".
  const minutes = value.minutesAgo || 0;
  const live = minutes < LIVE_MINUTES;
  const ownerName = pet.reporter?.firstName || null;

  // The same place a few minutes later is the same sighting, still true: its time moves up, and
  // the people who were told about it are not told again.
  if (live) {
    const recent = await prisma.caseSighting.findFirst({
      where: { missionId: pet.id, sightedAt: { gte: new Date(now.getTime() - SAME_SIGHTING_MS) } },
      orderBy: { sightedAt: 'desc' },
      select: { id: true, latitude: true, longitude: true },
    });
    if (recent && distanceMeters({ lat: recent.latitude, lng: recent.longitude }, point) <= SAME_SIGHTING_METERS) {
      const kept = await prisma.caseSighting.update({ where: { id: recent.id }, data: { sightedAt: now }, select: { id: true, sightedAt: true } });
      return { sighting: kept, place, told: { owner: false, bell: 0, pushed: 0 }, again: true, caseNumber: pet.caseNumber, ownerName };
    }
  }

  const description = [value.note, heading].filter(Boolean).join(' ') || `Seen by ${who || 'someone with the link'}.`;
  const sighting = await prisma.caseSighting.create({
    data: {
      missionId: pet.id,
      reportedById: userId,
      reporterName: who,
      sightedAt: new Date(now.getTime() - minutes * 60000),
      latitude: value.lat,
      longitude: value.lng,
      address: address || 'Marked on the map',
      description,
      certaintyLevel: SURE[value.sure],
      photoUrls: '[]',
      isVerified: false,
      direction: value.direction || null,
    },
  });

  if (pet.status === 'ACTIVE' || pet.status === 'IN_PROGRESS') {
    await prisma.case.update({ where: { id: pet.id }, data: { status: 'SIGHTING_REPORTED' } });
  }

  const told = { owner: false, bell: 0, pushed: 0 };
  // The search screen: where the sighting is on the map, and where the owner opens directions.
  const url = `/mission-control?mission=${encodeURIComponent(pet.caseNumber)}`;
  const near = place ? `Near ${place}.` : 'Marked on the map.';
  const title = live ? `${name} was just seen` : `${name} was seen ${agoPhrase(minutes)}`;
  // What to do on seeing the pet is the searcher's brief's own first sentence, and only while the sighting is live.
  const never = briefFor({ way: 'foot', pet })[3] || '';
  const onSeeing = live ? never.slice(0, never.indexOf('.') + 1) : '';
  const sureWords =
    value.sure === 'SURE'
      ? `${who || 'Someone'} is sure it was ${name}.`
      : value.sure === 'UNSURE'
        ? `${who || 'Someone'} is not sure it was ${name}.`
        : `${who || 'Someone'} thinks it was ${name}.`;

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
        title,
        body: [near, heading, sureWords, onSeeing].filter(Boolean).join(' '),
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
      // Every word that came from the witness or the report is escaped: the place and the note are typed by strangers.
      sendEmail({
        to: pet.reporter.email,
        subject: `${title}${place ? ` near ${place}` : ''}`,
        html: `<p>Hi ${escapeHtml(pet.reporter.firstName || 'there')},</p><p>${escapeHtml(body)}</p>${value.note ? `<p>"${escapeHtml(value.note)}"</p>` : ''}<p><a href="${link}">Open ${escapeHtml(name)}'s search</a> to see where on the map.</p>`,
      }).catch((e) => console.error('[witness] owner email failed:', e?.message));
    }
  }

  // Everyone with the search open, live.
  try {
    const { broadcast } = await import('@/app/lib/sse/missionStream');
    // The place and the time, as the picture gives them to anyone. Never who sent it or what they wrote.
    broadcast(pet.id, {
      type: 'SIGHTING_REPORTED',
      sighting: { id: sighting.id, latitude: sighting.latitude, longitude: sighting.longitude, place, sightedAt: sighting.sightedAt, direction: sighting.direction },
    });
  } catch (error) {
    console.warn('[witness] broadcast failed:', error?.message);
  }

  return { sighting: { id: sighting.id, sightedAt: sighting.sightedAt }, place, told, caseNumber: pet.caseNumber, ownerName };
}
