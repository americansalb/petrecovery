/**
 * Pure display-shape normalizer shared by the flyer PDFs and the social cards.
 * Imports nothing heavy (no react-pdf / satori / resvg / sharp) so both render
 * paths reuse it without dragging native deps into each other's webpack trace.
 *
 * What the flyer says, in the order it is read: LOST DOG, the photo, the
 * phone; then the name, what to look for, what to do if you see the pet,
 * where and when, the QR code. Everything here is a fact from the report
 * or the owner's own words; nothing is invented to fill a box.
 */

import tzLookup from 'tz-lookup';
import { FLYER_THEME, SPECIES_LABEL, SPECIES_WORD } from './theme';
import { resolveFlyerCopy } from './copy';
import { isPlaceholderEmail } from '@/app/lib/placeholderEmail';
import { caseShortLabel } from '@/app/lib/caseShortLink';

function areaFromAddress(address) {
  if (!address) return 'this neighborhood';
  let parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  // Drop a trailing country and a bare trailing ZIP: "Carpentersville,
  // Illinois, 60110, United States" must read "Carpentersville, Illinois",
  // never "Illinois, 60110".
  if (parts.length > 1 && /^(united states( of america)?|usa|u\.s\.a?\.?|canada|m[eé]xico)$/i.test(parts[parts.length - 1])) {
    parts = parts.slice(0, -1);
  }
  if (parts.length > 2 && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) {
    parts = parts.slice(0, -1);
  }
  // Keep the MOST specific two segments (street + city, or city + state).
  return parts.slice(0, 2).join(', ') || address;
}

function formatPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone || '';
}

/** The IANA zone where the pet was lost, from the last-seen point; Central when there is none. */
export function zoneFor(caseData) {
  const lat = Number(caseData?.lastSeenLatitude);
  const lon = Number(caseData?.lastSeenLongitude);
  if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) {
    try {
      return tzLookup(lat, lon);
    } catch {
      /* fall through */
    }
  }
  return 'America/Chicago';
}

function cap(str, n) {
  if (!str) return '';
  const t = String(str).trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

const sentence = (s) => {
  const t = String(s || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const first = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(first) ? first : `${first}.`;
};

/**
 * Read intrinsic pixel dimensions from a PNG/JPEG data URL so a photo that
 * came without them still gets a frame of its own shape.
 * Returns {w,h} or null (unknown format).
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

/** Photos as objects with their shape and focal point, from either shared shape. */
function photosFrom(shared) {
  const out = [];
  const objs = Array.isArray(shared.photos) ? shared.photos.filter((p) => p && p.dataUrl) : [];
  for (const p of objs) {
    const dims = p.w > 0 && p.h > 0 ? { w: p.w, h: p.h } : imageDimsFromDataUrl(p.dataUrl);
    out.push({
      src: p.dataUrl,
      dataUrl: p.dataUrl,
      w: dims?.w || 0,
      h: dims?.h || 0,
      aspect: dims && dims.w > 0 && dims.h > 0 ? dims.w / dims.h : null,
      focal: p.focal || { x: 0.5, y: 0.45 },
    });
  }
  if (!out.length) {
    const urls = (shared.photoDataUrls && shared.photoDataUrls.filter(Boolean)) || [];
    if (!urls.length && shared.photoDataUrl) urls.push(shared.photoDataUrl);
    for (const u of urls) {
      const dims = imageDimsFromDataUrl(u);
      out.push({
        src: u,
        dataUrl: u,
        w: dims?.w || 0,
        h: dims?.h || 0,
        aspect: dims && dims.w > 0 && dims.h > 0 ? dims.w / dims.h : null,
        focal: { x: 0.5, y: 0.45 },
      });
    }
  }
  return out.slice(0, 3);
}

/** "Golden Retriever · Large · 4 years old · Microchipped" */
function factsLine(caseData, pet) {
  const sizeWord = caseData.petSize ? String(caseData.petSize).toLowerCase() : '';
  const age = Number(pet?.age);
  const bits = [
    caseData.petBreed && caseData.petBreed !== 'Unknown' ? caseData.petBreed : null,
    sizeWord ? sizeWord.charAt(0).toUpperCase() + sizeWord.slice(1) : null,
    Number.isFinite(age) && age > 0 ? `${age} ${age === 1 ? 'year' : 'years'} old` : null,
    pet?.microchipId || caseData.microchipId ? 'Microchipped' : null,
  ].filter(Boolean);
  return bits.join(' · ');
}

/** What to look for: the color, the markings, the collar, in the owner's words. */
function lookFor(caseData, pet) {
  const marks = String(caseData.distinctiveMarks || pet?.distinctiveMarks || '').trim();
  const collar = String(pet?.collarInfo || '').trim();
  const color = String(caseData.petColor || '').trim();
  const parts = [];
  if (color) parts.push(sentence(/\b(coat|fur|colou?r)\b/i.test(color) ? color : `${color} coat`));
  if (marks) parts.push(sentence(marks));
  if (collar) parts.push(sentence(/collar|harness|tag/i.test(collar) ? collar : `${collar} collar`));
  if (parts.length < 2 && caseData.petDescription) {
    // "White, brown, tabby Dog" says nothing the color did not: a description
    // made of the color and the species is left out.
    const desc = cap(caseData.petDescription, 140);
    const said = parts.join(' ').toLowerCase();
    const fresh = desc
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !/^(dog|cat|bird|rabbit|pet|a|an|the|and|with|is|very)$/.test(w) && !said.includes(w));
    if (fresh.length) parts.push(sentence(desc));
  }
  return cap(parts.join(' '), 180);
}

/** "If you see Max": the scenario's guidance with the real contact action. */
function ifYouSee(copy, { ownerFirstName, hasPhone }) {
  let s = String(copy.approachLine || '').trim();
  const verb = hasPhone ? (ownerFirstName ? `call or text ${ownerFirstName}` : 'call or text') : 'report it with the QR code';
  s = s.replace(/,?\s*and trying to get home/i, '');
  s = s.replace(/get in touch right away\.?/i, `${verb} right away.`);
  s = s.replace(/get in touch\.?/i, `${verb}.`);
  s = s.replace(/\s+/g, ' ').trim();
  return cap(s, 170);
}

/**
 * @param {object} caseData a Case row (+ pet, + optional overrides)
 * @param {object} shared render inputs
 * @param {Array<{dataUrl:string,w:number,h:number,focal:object}>} [shared.photos]
 * @param {string} [shared.photoDataUrl] primary photo data url (older shape)
 * @param {string[]} [shared.photoDataUrls] up to 3 photo data urls (older shape)
 * @param {string} [shared.qrDataUrl]
 * @param {string} [shared.headline] AI headline; falls back to a template
 * @param {string} [shared.description] AI description; falls back to petDescription
 */
export function normalizeFlyerData(caseData, shared = {}) {
  const theme = FLYER_THEME[caseData.reportType === 'FOUND' ? 'found' : 'lost'];
  const speciesLabel = SPECIES_LABEL[caseData.petSpecies] || 'PET';
  const name = caseData.petName || 'Unknown';
  const pet = caseData.pet || null;

  const sizeWord = caseData.petSize ? String(caseData.petSize).toLowerCase() : '';
  const chips = [
    caseData.petBreed && caseData.petBreed !== 'Unknown' ? caseData.petBreed : null,
    caseData.petColor,
    sizeWord ? sizeWord.charAt(0).toUpperCase() + sizeWord.slice(1) : null,
  ].filter(Boolean);

  // The human behind the number: "call or text Sarah" reads like a family,
  // not a call center.
  const ownerFirstName = (caseData.ownerName || '').trim().split(/\s+/)[0] || '';

  const hasPhone = Boolean(caseData.ownerPhone && caseData.ownerPhone !== 'Not provided');
  const hasEmail = Boolean(
    caseData.ownerEmail && !isPlaceholderEmail(caseData.ownerEmail) && caseData.ownerEmail !== 'Not provided'
  );

  // The line a stranger types: reunitepets.org/p/HF27J2 (app/lib/caseShortLink.js).
  // The QR code beside it carries the full case URL.
  const caseUrlLabel = caseShortLabel(caseData.caseNumber);

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

  // The sheet prints the DATE the pet was last seen, in the pet's own time
  // zone, never a clock time. The report wizard asks how long ago in bands
  // ("1 to 6 hours", "1 to 3 days") and stores the band's middle as
  // lastSeenAt (api/reports/create, calculateLastSeenTime), so "5:45 pm"
  // would be an invention. The zone comes from where the pet was lost: the
  // server runs in UTC, where an Austin evening is already tomorrow.
  const zone = zoneFor(caseData);
  let lastSeenWhen = '';
  let lastSeenDate = '';
  try {
    if (caseData.lastSeenAt) {
      const d = new Date(caseData.lastSeenAt);
      lastSeenWhen = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric' }).format(d);
      lastSeenDate = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric' }).format(d);
    }
  } catch {
    /* leave blank */
  }

  const photos = photosFrom(shared);
  const photoAspect = photos[0]?.aspect ? photos[0].h / photos[0].w : null; // h/w, the older field

  const markings = cap(caseData.distinctiveMarks || pet?.distinctiveMarks || '', 120);
  const microchipped = Boolean(caseData.microchipId || pet?.microchipId);

  const copy = resolveFlyerCopy(caseData, shared);

  // "Milo, a tabby cat": the line under LOST on the cover. The breed when
  // the report names one, else the species.
  const breedWord = caseData.petBreed && caseData.petBreed !== 'Unknown' ? String(caseData.petBreed).trim().toLowerCase() : '';
  const kindWord = breedWord || SPECIES_WORD[caseData.petSpecies] || 'pet';
  const coverLine = `${name}, ${/^[aeiou]/i.test(kindWord) ? 'an' : 'a'} ${kindWord}`;

  return {
    // brand + semantics
    stamp: theme.stamp,
    accent: theme.accent,
    accentBg: theme.stampBg,
    accentDeep: theme.accentDeep, // the word on paper
    speciesLabel,
    headlineBig: `${theme.stamp} ${speciesLabel}`, // LOST DOG
    coverLine, // "Milo, a tabby cat"
    // copy
    headline: copy.headline, // "Have you seen {name}?"
    plea: copy.plea,
    pleaShort: copy.pleaShort,
    approachLine: copy.approachLine,
    shareNudge: copy.shareNudge,
    scanCta: copy.scanCta,
    ifYouSee: ifYouSee(copy, { ownerFirstName, hasPhone }),
    lookFor: lookFor(caseData, pet),
    factsLine: factsLine(caseData, pet),
    petName: name,
    chips,
    description: sentence(cap(shared.description || caseData.petDescription, 240)).replace(/\.$/, ''),
    markings,
    microchipped,
    lastSeenArea: areaFromAddress(caseData.lastSeenAddress),
    lastSeenWhen, // "Sun Nov 2, 6:30 pm"
    lastSeenDate, // "Nov 2, 2026"
    reward, // "$500", "REWARD" or null
    contactVerb,
    contactValue,
    hasPhone,
    email: hasEmail ? cap(caseData.ownerEmail, 48) : '', // a real address, or nothing
    ownerFirstName,
    contactSecondary: cap(contactSecondary, 48),
    caseNumber: caseData.caseNumber,
    caseUrlLabel, // "reunitepets.org/p/HF27J2"
    map: shared.map || null, // stitched last-seen map spec (render/staticMap.js)
    photoAspect,
    photos, // [{src, w, h, aspect (w/h), focal}]
    photoDataUrl: photos[0]?.src || null,
    qrDataUrl: shared.qrDataUrl || null,
  };
}
