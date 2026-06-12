/**
 * Health Book status math (docs/HEALTH_BOOK_DESIGN.md).
 *
 * Status is pure expiry-date arithmetic on owner-entered dates; this
 * module never interprets health data. Shared by the Health tab, the
 * Overview strip, and the public clinical face.
 */

export const DUE_SOON_DAYS = 60;

export const VACCINE_PRESETS = {
  DOG: [
    { name: 'Rabies', years: 3 },
    { name: 'DHPP', years: 1 },
    { name: 'Bordetella', years: 1 },
    { name: 'Leptospirosis', years: 1 },
    { name: 'Canine influenza', years: 1 },
    { name: 'Lyme', years: 1 },
  ],
  CAT: [
    { name: 'Rabies', years: 3 },
    { name: 'FVRCP', years: 1 },
    { name: 'FeLV', years: 1 },
  ],
  DEFAULT: [{ name: 'Rabies', years: 1 }],
};

export function vaccinePresetsFor(species) {
  return VACCINE_PRESETS[species] || VACCINE_PRESETS.DEFAULT;
}

/** 'PROTECTED' | 'DUE_SOON' | 'EXPIRED' | 'ON_FILE' (no expiry recorded) */
export function vaccinationStatus(vax, now = new Date()) {
  if (!vax.expiresAt) return 'ON_FILE';
  const expires = new Date(vax.expiresAt);
  if (expires <= now) return 'EXPIRED';
  if (expires - now <= DUE_SOON_DAYS * 86400000) return 'DUE_SOON';
  return 'PROTECTED';
}

function shortDate(d) {
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function timeUntil(d, now) {
  const months = Math.max(1, Math.round((new Date(d) - now) / (30 * 86400000)));
  if (months >= 18) {
    const years = Math.round(months / 12);
    return `${years} year${years === 1 ? '' : 's'}`;
  }
  return `${months} month${months === 1 ? '' : 's'}`;
}

/**
 * One sentence, worst state first. Returns { tone, sentence }:
 * tone 'bad' | 'warn' | 'good' | 'empty'.
 */
export function healthBookStatus(vaccinations, petName, now = new Date()) {
  const live = (vaccinations || []).filter((v) => !v.deletedAt);
  if (live.length === 0) {
    return { tone: 'empty', sentence: `Start ${petName}'s Health Book with their first vaccine.` };
  }
  const byStatus = (s) => live.filter((v) => vaccinationStatus(v, now) === s);
  const expired = byStatus('EXPIRED');
  if (expired.length) {
    return { tone: 'bad', sentence: `${expired[0].name} expired ${shortDate(expired[0].expiresAt)}. One tap to update.` };
  }
  const due = byStatus('DUE_SOON').sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
  if (due.length) {
    return { tone: 'warn', sentence: `${due[0].name} due by ${shortDate(due[0].expiresAt)}.` };
  }
  const upcoming = live
    .filter((v) => v.expiresAt)
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))[0];
  if (upcoming) {
    return { tone: 'good', sentence: `Protections current. Next: ${upcoming.name} in ${timeUntil(upcoming.expiresAt, now)}.` };
  }
  return { tone: 'good', sentence: 'Protections on file.' };
}
