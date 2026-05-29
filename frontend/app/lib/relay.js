/**
 * Relay / Connect broker helpers.
 *
 * The connect step is a BROKER, not a lookup: it relays messages between an
 * anonymous finder and a lost-pet owner without exposing either party's PII
 * (phone/email/exact coords) until both opt in.
 *
 * Contract: .vaak/vision.md §4c/§4d · docs/design/relay-connect-spec.md
 * The PII invariants here are asserted by the tester's §9 PII-leak test.
 */

import prisma from '@/app/lib/prisma';
import { getConfidenceBand } from '@/app/lib/matching';

/** Backend-authored, single source of truth — rendered verbatim by the UI. */
export const ANTI_SCAM_BANNER =
  'ReunitePets never asks for payment or a reward to reconnect you. Report anything that does.';

const HANDLE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

/** Anonymous, non-identifying finder handle, e.g. "Finder-7QX". */
export function generateFinderHandle() {
  let s = '';
  for (let i = 0; i < 3; i++) {
    s += HANDLE_ALPHABET[Math.floor(Math.random() * HANDLE_ALPHABET.length)];
  }
  return `Finder-${s}`;
}

/**
 * Snap a last-seen location to a COARSE, PII-safe string (~1km).
 * NEVER returns raw lat/lng. Prefers a human label (neighborhood/city) when we
 * have one; falls back to a vague distance phrase. The client must never round
 * sensitive geo — snapping is the backend's responsibility (contract §4c).
 *
 * @param {object} lostCase - Case row (lastSeenAddress / city / state may be present)
 * @returns {string}
 */
export function snapCoarseArea(lostCase) {
  if (!lostCase) return 'Near the last-seen area';
  // Derive a coarse human label without exposing a street address.
  // lastSeenAddress is typically "123 Oak St, Eastside, Chicago, IL" — we take a
  // non-numeric, non-leading component (neighborhood/city), never the street line.
  const label =
    coarseLabelFromAddress(lostCase.lastSeenAddress) ||
    lostCase.city ||
    null;
  return label ? `Near ${label} · ~1km` : 'Within ~1km of the last-seen area';
}

/** Extract a coarse area label (neighborhood/city) from a full address, dropping the street line. */
function coarseLabelFromAddress(address) {
  if (!address || typeof address !== 'string') return null;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  // Drop the first segment if it starts with a number (street address line).
  const candidates = /^\d/.test(parts[0]) ? parts.slice(1) : parts;
  // Prefer a segment that isn't a bare state/zip; take the first remaining.
  const label = candidates.find((p) => !/^\d/.test(p) && p.length > 2);
  return label || null;
}

/**
 * Idempotently create (or fetch) the broker connection for a (lost, found) pair.
 * Stores the match snapshot so the card never recomputes it.
 *
 * @returns {Promise<object>} the MatchConnection row
 */
export async function createMatchConnection({ lostCaseId, foundCaseId, matchScore, pTrueMatch, matchSource = 'attribute' }) {
  return prisma.matchConnection.upsert({
    where: { lostCaseId_foundCaseId: { lostCaseId, foundCaseId } },
    update: {}, // idempotent — never clobber an in-progress thread
    create: {
      lostCaseId,
      foundCaseId,
      matchScore: Math.round(matchScore ?? 0),
      pTrueMatch: pTrueMatch ?? 0,
      matchSource,
      finderHandle: generateFinderHandle(),
    },
  });
}

/**
 * Build the finder-facing match-card payload (§4d). PII-FREE by construction:
 * only pet identity + coarse area + the opaque token + calibrated confidence.
 * NO owner name / phone / email / exact coords ever appear here.
 *
 * @param {object} connection - MatchConnection row
 * @param {object} lostCase - the lost Case (for pet display fields + coarse area)
 */
export function toMatchCardPayload(connection, lostCase) {
  const band = getConfidenceBand(connection.pTrueMatch);
  return {
    matchId: connection.token, // opaque — never the case id
    petName: lostCase?.petName ?? null,
    species: lostCase?.petSpecies ?? lostCase?.species ?? null,
    petPhoto: lostCase?.petPhotoUrl ?? lostCase?.photoUrl ?? null,
    coarseArea: snapCoarseArea(lostCase),
    pTrueMatch: connection.pTrueMatch,
    matchSource: connection.matchSource,
    canConnect: band === 'actionable', // server-owned floor; the card trusts this
  };
}

/**
 * The relay-thread open payload (§4d). Also PII-free pre-opt-in: the owner is
 * referenced only by pet name, the finder only by anonymous handle.
 */
export function toRelayOpenPayload(connection, lostCase) {
  return {
    threadId: connection.token,
    status: connection.status,
    counterpartyHandle: lostCase?.petName ? `${lostCase.petName}'s owner` : 'the owner',
    coarseArea: snapCoarseArea(lostCase),
    antiScamBanner: ANTI_SCAM_BANNER,
    canDirectContact: connection.status === 'MUTUAL_OPTIN',
  };
}

/** Strip a relay message to its PII-free wire shape. */
export function toMessagePayload(message) {
  return {
    id: message.id,
    senderRole: message.senderRole,
    body: message.body,
    createdAt: message.createdAt,
  };
}
