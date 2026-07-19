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
 * Read intrinsic pixel dimensions from a PNG/JPEG data URL so the flyer can
 * size the photo frame to the photo's real shape and show the WHOLE pet,
 * never a letterboxed crop. Returns {w,h} or null (unknown format).
 */
export function imageDimsFromDataUrl(dataUrl) {
  try {
    const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)/i.exec(dataUrl || '');
    if (!m) return null;
    // Decode only a header window; SOF/IHDR live near the front.
    const buf = Buffer.from(m[2].slice(0, 262144), 'base64');
    if (m[1].toLowerCase() === 'png') {
      if (buf.length < 24 || buf.readUInt32BE(12) !== 0x49484452) return null; // "IHDR"
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    // JPEG: walk markers to the first SOFn frame header.
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xff) {
        i += 1;
        continue;
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) return null;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
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

  const sizeWord = caseData.petSize ? String(caseData.petSize).toLowerCase() : '';
  const chips = [
    caseData.petBreed && caseData.petBreed !== 'Unknown' ? caseData.petBreed : null,
    caseData.petColor,
    sizeWord ? sizeWord.charAt(0).toUpperCase() + sizeWord.slice(1) : null,
  ].filter(Boolean);

  // The human behind the number: "CALL OR TEXT SARAH" reads like a family,
  // not a call center.
  const ownerFirstName = (caseData.ownerName || '').trim().split(/\s+/)[0] || '';

  const hasPhone = caseData.ownerPhone && caseData.ownerPhone !== 'Not provided';
  const hasEmail =
    caseData.ownerEmail && !isPlaceholderEmail(caseData.ownerEmail) && caseData.ownerEmail !== 'Not provided';

  // Display URL for the microfooter + the no-contact fallback (the QR encodes
  // the real absolute URL; this is the human-readable line).
  const caseUrlLabel = `reunitepets.org/cases/${caseData.caseNumber}`;

  let contactVerb = 'REPORT A SIGHTING AT';
  let contactValue = caseUrlLabel;
  let contactSecondary = '';
  if (hasPhone) {
    contactVerb = 'CALL OR TEXT';
    contactValue = formatPhone(caseData.ownerPhone);
    if (hasEmail) contactSecondary = caseData.ownerEmail;
  } else if (hasEmail) {
    contactVerb = 'EMAIL';
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

  // aspect (h/w) of the primary photo so layouts can frame the full image.
  const dims = photos.length ? imageDimsFromDataUrl(photos[0]) : null;
  const photoAspect = dims && dims.w > 0 && dims.h > 0 ? dims.h / dims.w : null;

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
    headline: copy.headline, // "Have you seen {name}?"
    plea: copy.plea, // one species-true supporting sentence
    pleaShort: copy.pleaShort, // shorter, for social cards
    approachLine: copy.approachLine, // scenario-aware "if you see them" guidance
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
    ownerFirstName,
    contactSecondary: cap(contactSecondary, 48),
    caseNumber: caseData.caseNumber,
    caseUrlLabel,
    map: shared.map || null, // stitched last-seen map spec (see render/staticMap.js)
    photoAspect,
    photos: photos.slice(0, 3),
    photoDataUrl: photos[0] || null, // back-compat for social card
    qrDataUrl: shared.qrDataUrl || null,
  };
}
