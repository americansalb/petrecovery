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

import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { placeFromStreets } from '@/app/lib/streetWalks';
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
/** The pet did not go anywhere: it is staying where it was seen. */
const STAYING = 'STAYING';
/**
 * What the witness is doing about it, which they can change afterwards
 * from the same phone: still watching the pet, lost sight of it, had to
 * leave, it turned out not to be the pet, or the pet is with them.
 */
export const WITNESS_STATES = ['WATCHING', 'LOST_SIGHT', 'LEFT', 'NOT_THE_PET', 'WITH_WITNESS'];
/** A sighting can be filed for earlier, up to a week back. */
const MAX_MINUTES_AGO = 7 * 24 * 60;
const NAME_MAX = 60;
const NOTE_MAX = 600;

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** A sighting sent this soon after the pet was seen is announced as "just seen". */
const LIVE_MINUTES = 10;

/**
 * What is kept of a witness's key. Several older routes return whole
 * sighting rows to anyone, so the key itself is never stored: with only
 * its hash, whoever reads the row still cannot change the sighting.
 */
export function hashWitnessKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

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
  if (direction && direction !== STAYING && !DIRECTIONS.includes(direction)) return { error: 'Which way did the pet go? Pick a direction.' };
  const state = body.state ? String(body.state).toUpperCase() : null;
  if (state && state !== 'WATCHING' && state !== 'WITH_WITNESS') return { error: 'Say whether you can see the pet now.' };
  const minutesAgo = Math.max(0, Math.min(MAX_MINUTES_AGO, Math.round(Number(body.minutesAgo) || 0)));
  return {
    value: {
      lat,
      lng,
      sure,
      direction,
      toward: clean(body.toward, 80),
      state,
      minutesAgo,
      name: clean(body.name, NAME_MAX),
      note: clean(body.note, NOTE_MAX),
      address: clean(body.address, 200),
    },
  };
}

/** "Going toward Rosedale Ave." / "Heading north." / "Staying there." / '' */
export function headingWords({ direction = null, toward = '' } = {}) {
  if (direction === STAYING) return 'Staying there.';
  if (toward) return `Going toward ${toward}.`;
  if (direction) return `Heading ${direction.toLowerCase()}.`;
  return '';
}

/**
 * The streets of the pet's board, read once for a sighting: their lines,
 * to name the corner a point is on, and every street name on them, to
 * check a street the witness says the pet went toward.
 */
async function boardStreets(caseId) {
  const streets = [];
  const names = new Set();
  try {
    const rows = await prisma.searchStreet.findMany({ where: { caseId }, select: { name: true, fromName: true, toName: true, path: true } });
    for (const row of rows) {
      for (const name of [row.name, row.fromName, row.toName]) if (name) names.add(String(name).toLowerCase());
      try {
        streets.push({ name: row.name, path: JSON.parse(row.path) });
      } catch {
        /* a line that does not parse names no place */
      }
    }
  } catch {
    /* no board: nothing is named from it */
  }
  return { streets, names };
}

/**
 * The street a pet went toward is shown to everyone holding the link, so
 * it has to be one of the board's own street names. Anything else that
 * arrives in that field is dropped, and the compass word stands alone.
 */
function knownStreet(board, toward) {
  return toward && board.names.has(String(toward).toLowerCase()) ? toward : '';
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
  const board = await boardStreets(pet.id);
  // One tap sends a position and no address: the board's streets name it.
  const address = value.address || placeFromStreets(board.streets, { lat: value.lat, lng: value.lng }) || '';
  const place = placeName(address) || address || null;
  const who = value.name || null;
  const toward = knownStreet(board, value.toward);
  const heading = headingWords({ direction: value.direction, toward });
  const withThem = value.state === 'WITH_WITNESS';
  // A sighting can be sent for earlier. Only one sent as it happens is "just seen".
  const minutes = value.minutesAgo || 0;
  const live = minutes < LIVE_MINUTES;
  const description =
    [withThem ? `${who || 'The person who reported this'} has ${name} with them.` : '', value.note, heading].filter(Boolean).join(' ') ||
    `Seen by ${who || 'someone with the link'}.`;
  const key = crypto.randomBytes(18).toString('hex');

  const sighting = await prisma.caseSighting.create({
    data: {
      missionId: pet.id,
      reportedById: userId,
      reporterName: who,
      sightedAt: new Date(now.getTime() - (value.minutesAgo || 0) * 60000),
      latitude: value.lat,
      longitude: value.lng,
      address: address || 'Marked on the map',
      description,
      certaintyLevel: SURE[value.sure],
      photoUrls: '[]',
      isVerified: false,
      direction: value.direction || null,
      towardName: toward || null,
      witnessKeyHash: hashWitnessKey(key),
      witnessState: value.state || null,
      witnessStateAt: value.state ? now : null,
    },
  });

  if (pet.status === 'ACTIVE' || pet.status === 'IN_PROGRESS') {
    await prisma.case.update({ where: { id: pet.id }, data: { status: 'SIGHTING_REPORTED' } });
  }

  const told = { owner: false, bell: 0, pushed: 0 };
  // The search screen: where the sighting is on the map, and where the owner says "I am going".
  const url = `/mission-control?mission=${encodeURIComponent(pet.caseNumber)}`;
  const near = place ? `Near ${place}.` : 'Marked on the map.';
  const title = withThem ? `Someone has ${name} with them` : live ? `${name} was just seen` : `${name} was seen ${agoPhrase(minutes)}`;
  // What to do on seeing the pet is the searcher's brief's own first sentence, and only while the sighting is live.
  const never = briefFor({ way: 'foot', pet })[3] || '';
  const onSeeing = live && !withThem ? never.slice(0, never.indexOf('.') + 1) : '';
  const sureWords = withThem
    ? `${who || 'Someone'} has ${name} with them.`
    : value.sure === 'SURE'
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

  // Everyone with the board open, live.
  try {
    const { broadcast } = await import('@/app/lib/sse/missionStream');
    // The place and the time, as the picture gives them to anyone. Never who sent it, what they wrote, or their key.
    broadcast(pet.id, {
      type: 'SIGHTING_REPORTED',
      sighting: { id: sighting.id, latitude: sighting.latitude, longitude: sighting.longitude, place, sightedAt: sighting.sightedAt, direction: sighting.direction, towardName: sighting.towardName, witnessState: sighting.witnessState },
    });
  } catch (error) {
    console.warn('[witness] broadcast failed:', error?.message);
  }

  return { sighting: { id: sighting.id, sightedAt: sighting.sightedAt }, key, place, told, caseNumber: pet.caseNumber, ownerName: pet.reporter?.firstName || null };
}

/**
 * Checks what a witness sends to change their own sighting afterwards:
 * which way the pet went, or what they are doing now. Returns { error }
 * in words, or { value }.
 */
export function checkWitnessUpdate(body = {}) {
  const id = clean(body.id, 40);
  const key = clean(body.key, 80);
  if (!id || !key) return { error: 'That sighting cannot be changed from this phone.' };
  const out = { id, key };
  if (body.direction !== undefined || body.toward !== undefined) {
    const direction = body.direction ? String(body.direction).toUpperCase() : null;
    if (direction && direction !== STAYING && !DIRECTIONS.includes(direction)) return { error: 'Which way did the pet go? Pick a direction.' };
    out.direction = direction;
    out.toward = clean(body.toward, 80);
  }
  if (body.state !== undefined) {
    const state = String(body.state || '').toUpperCase();
    if (!WITNESS_STATES.includes(state)) return { error: 'Say what happened.' };
    out.state = state;
  }
  if (out.direction === undefined && out.state === undefined) return { error: 'Nothing to change.' };
  return { value: out };
}

/**
 * The witness changes their own sighting: the way the pet went, or that
 * they lost sight of it, had to go, or it was not the pet. Only the phone
 * that sent the sighting holds its key. Returns { error: 'NOT_FOUND' } or
 * { sighting }. Everyone with the board open hears it.
 */
export async function updateWitnessSighting(caseParam, value, { now = new Date() } = {}) {
  const pet = await prisma.case.findFirst({ where: missionWhere(caseParam), select: { id: true, petName: true } });
  if (!pet) return { error: 'NOT_FOUND' };
  const sighting = await prisma.caseSighting.findFirst({
    where: { id: value.id, missionId: pet.id, witnessKeyHash: hashWitnessKey(value.key) },
    select: { id: true, description: true, direction: true, towardName: true, reporterName: true },
  });
  if (!sighting) return { error: 'NOT_FOUND' };
  const data = {};
  if (value.direction !== undefined) {
    const toward = value.toward ? knownStreet(await boardStreets(pet.id), value.toward) : '';
    data.direction = value.direction;
    data.towardName = toward || null;
    // The sentence about the way it went is the last one of the description; replace it.
    const before = headingWords({ direction: sighting.direction, toward: sighting.towardName });
    const base = before && sighting.description.endsWith(before) ? sighting.description.slice(0, -before.length).trim() : sighting.description;
    const after = headingWords({ direction: value.direction, toward });
    // "Seen by someone with the link." stands in when the witness wrote nothing; the way the pet went replaces it.
    // Only that exact sentence: a note that happens to begin "Seen by the creek" is the witness's own and stays.
    const standIn = `Seen by ${sighting.reporterName || 'someone with the link'}.`;
    data.description = [base === standIn && after ? '' : base, after].filter(Boolean).join(' ') || standIn;
  }
  if (value.state !== undefined) {
    data.witnessState = value.state;
    data.witnessStateAt = now;
  }
  const updated = await prisma.caseSighting.update({
    where: { id: sighting.id },
    data,
    select: { id: true, direction: true, towardName: true, witnessState: true, witnessStateAt: true, description: true, sightedAt: true },
  });
  try {
    const { broadcast } = await import('@/app/lib/sse/missionStream');
    broadcast(pet.id, { type: 'SIGHTING_UPDATED', sighting: { id: updated.id, direction: updated.direction, towardName: updated.towardName, witnessState: updated.witnessState } });
  } catch (error) {
    console.warn('[witness] broadcast failed:', error?.message);
  }
  return { sighting: updated };
}
