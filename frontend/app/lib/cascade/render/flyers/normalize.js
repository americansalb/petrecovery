/**
 * Pure display-shape normalizer shared by the flyer PDFs and the social cards.
 * Imports nothing heavy (no react-pdf / satori / resvg) so both render paths
 * reuse it without dragging native deps into each other's webpack trace.
 *
 * Computes the best-in-class flyer content: emotional hook, reward, multi-photo,
 * "look for" markings, an approach/safety line, microchip trust badge, and a
 * prominent scan CTA — the elements that actually drive sightings.
 */

import { format } from 'date-fns';
import { FLYER_THEME, SPECIES_LABEL } from './theme';
import { resolveFlyerCopy } from './copy';
import { isPlaceholderEmail } from '@/app/lib/placeholderEmail';

function areaFromAddress(address) {
  if (!address) return 'this neighborhood';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts.slice(-3, -1).join(', ');
  if (parts.length === 2) return parts.join(', ');
  return parts[0] || address;
}

function formatPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone || '';
}

function cap(str, n) {
  if (!str) return '';
  const t = String(str).trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

/**
 * @param {object} caseData a Case row (may include petPhotos:string[] and overrides)
 * @param {object} shared render inputs
 * @param {string} [shared.photoDataUrl] primary photo data url
 * @param {string[]} [shared.photoDataUrls] up to 3 photo data urls (face, body, markings)
 * @param {string} [shared.qrDataUrl]
 * @param {string} [shared.headline] AI emotional headline (PR4); falls back to a template
 * @param {string} [shared.description] AI description (PR4); falls back to petDescription
 */
export function normalizeFlyerData(caseData, shared = {}) {
  const theme = FLYER_THEME[caseData.reportType === 'FOUND' ? 'found' : 'lost'];
  const speciesLabel = SPECIES_LABEL[caseData.petSpecies] || 'PET';
  const name = caseData.petName || 'Unknown';

  const chips = [
    caseData.petBreed && caseData.petBreed !== 'Unknown' ? caseData.petBreed : null,
    caseData.petColor,
    caseData.petSize ? String(caseData.petSize).toLowerCase() : null,
  ].filter(Boolean);

  const hasPhone = caseData.ownerPhone && caseData.ownerPhone !== 'Not provided';
  const hasEmail =
    caseData.ownerEmail && !isPlaceholderEmail(caseData.ownerEmail) && caseData.ownerEmail !== 'Not provided';

  let contactVerb = 'CONTACT US';
  let contactValue = '';
  let contactSecondary = '';
  if (hasPhone) {
    contactVerb = 'CALL OR TEXT 24/7';
    contactValue = formatPhone(caseData.ownerPhone);
    if (hasEmail) contactSecondary = caseData.ownerEmail;
  } else if (hasEmail) {
    contactVerb = 'EMAIL US';
    contactValue = caseData.ownerEmail;
  }

  let reward = null;
  if (caseData.hasReward) {
    reward = caseData.rewardAmount ? `$${Number(caseData.rewardAmount).toLocaleString()}` : 'REWARD';
  }

  let lastSeenWhen = '';
  try {
    if (caseData.lastSeenAt) lastSeenWhen = format(new Date(caseData.lastSeenAt), 'MMM d, yyyy');
  } catch {
    /* leave blank */
  }

  // photos: prefer an explicit array, else the single primary.
  const photos = (shared.photoDataUrls && shared.photoDataUrls.filter(Boolean)) || [];
  if (!photos.length && shared.photoDataUrl) photos.push(shared.photoDataUrl);

  const markings = cap(caseData.distinctiveMarks || '', 120);
  const microchipped = Boolean(caseData.microchipId);

  // First-person emotional copy (pet voice + family), scenario-aware.
  const copy = resolveFlyerCopy(caseData, shared);

  return {
    // brand + semantics
    stamp: theme.stamp,
    accent: theme.accent,
    accentBg: theme.stampBg,
    speciesLabel,
    // emotional copy — the "cannot say no" heart of the flyer
    headline: copy.headline, // "{name} hasn't come home."
    plea: copy.plea, // first-person pet voice (full)
    pleaShort: copy.pleaShort, // shorter, for social cards
    familyLine: copy.familyLine, // the family, quietly waiting
    approachLine: copy.approachLine, // gentle scenario-aware guidance
    shareNudge: copy.shareNudge,
    scanCta: copy.scanCta,
    petName: name,
    chips,
    description: cap(shared.description || caseData.petDescription, 240),
    markings, // "LOOK FOR" line
    microchipped,
    lastSeenArea: areaFromAddress(caseData.lastSeenAddress),
    lastSeenWhen,
    reward, // e.g. "$500" or "REWARD" or null
    contactVerb,
    contactValue,
    contactSecondary: cap(contactSecondary, 48),
    caseNumber: caseData.caseNumber,
    photos: photos.slice(0, 3),
    photoDataUrl: photos[0] || null, // back-compat for social card
    qrDataUrl: shared.qrDataUrl || null,
  };
}
