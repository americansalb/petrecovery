/**
 * Pure display-shape normalizer shared by the flyer PDFs and the social cards.
 * Deliberately imports NOTHING heavy (no react-pdf, satori, or resvg) so both
 * render paths can reuse it without dragging native/binary deps into each
 * other's webpack trace.
 */

import { format } from 'date-fns';
import { FLYER_THEME, SPECIES_LABEL } from './theme';
import { isPlaceholderEmail } from '@/app/lib/placeholderEmail';

function areaFromAddress(address) {
  if (!address) return 'Location shared privately';
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

export function normalizeFlyerData(caseData, shared = {}) {
  const theme = FLYER_THEME[caseData.reportType === 'FOUND' ? 'found' : 'lost'];
  const speciesLabel = SPECIES_LABEL[caseData.petSpecies] || 'PET';

  const chips = [
    caseData.petBreed && caseData.petBreed !== 'Unknown' ? caseData.petBreed : null,
    caseData.petColor,
    caseData.petSize ? String(caseData.petSize).toLowerCase() : null,
  ].filter(Boolean);

  const hasPhone = caseData.ownerPhone && caseData.ownerPhone !== 'Not provided';
  const hasEmail =
    caseData.ownerEmail && !isPlaceholderEmail(caseData.ownerEmail) && caseData.ownerEmail !== 'Not provided';

  let contactVerb = 'CONTACT';
  let contactValue = '';
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
    reward = caseData.rewardAmount ? `$${caseData.rewardAmount} REWARD` : 'REWARD OFFERED';
  }

  let lastSeenWhen = '';
  try {
    if (caseData.lastSeenAt) lastSeenWhen = format(new Date(caseData.lastSeenAt), 'MMM d, yyyy');
  } catch {
    /* leave blank */
  }

  return {
    stamp: theme.stamp,
    accent: theme.accent,
    accentBg: theme.stampBg,
    speciesLabel,
    petName: caseData.petName || 'Unknown',
    chips,
    description: cap(shared.description || caseData.petDescription, 220),
    lastSeenArea: areaFromAddress(caseData.lastSeenAddress),
    lastSeenWhen,
    reward,
    contactVerb,
    contactValue,
    contactSecondary: cap(contactSecondary, 48),
    caseNumber: caseData.caseNumber,
    qrDataUrl: shared.qrDataUrl || null,
    photoDataUrl: shared.photoDataUrl || null,
  };
}
