/**
 * Health Book status math (docs/HEALTH_BOOK_DESIGN.md).
 *
 * Status is pure expiry-date arithmetic on owner-entered dates; this
 * module never interprets health data. Shared by the Today glance, the
 * Health tab, and the public clinical face.
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
  // Species-appropriate suggestions only: a cockatiel offered a rabies
  // stamp reads as a data-entry app that doesn't know what a bird is.
  BIRD: [{ name: 'Polyomavirus', years: 1 }],
  RABBIT: [{ name: 'RHDV2', years: 1 }],
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

/**
 * The book keeps one live stamp per vaccine: the newest. Backfilling an
 * older same-name record (server-side retirement only runs forward) must
 * not create a second "Rabies" row contradicting the current one — the
 * older record stays in the timeline, not in the standing.
 */
export function latestPerName(vaccinations) {
  const byName = new Map();
  for (const v of vaccinations || []) {
    if (v.deletedAt) continue;
    const key = (v.name || '').trim().toLowerCase();
    const prev = byName.get(key);
    if (!prev || new Date(v.administeredAt) > new Date(prev.administeredAt)) byName.set(key, v);
  }
  return [...byName.values()];
}

const VAX_RANK = { EXPIRED: 0, DUE_SOON: 1, PROTECTED: 2, ON_FILE: 3 };

/** Worst standing first, then most recently given. "Is X OK?" must never
 *  bury an expired shot below three current ones. */
export function rankVaccinations(vaccinations, now = new Date()) {
  return [...(vaccinations || [])].sort(
    (a, b) =>
      (VAX_RANK[vaccinationStatus(a, now)] - VAX_RANK[vaccinationStatus(b, now)]) ||
      (new Date(b.administeredAt) - new Date(a.administeredAt))
  );
}

/** "Jul 17", growing a year ("May 16, 2025") once it isn't this year —
 *  a 14-month-old expiry must not read as two months old. */
function shortDate(d, now = new Date()) {
  const date = new Date(d);
  const opts = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString([], opts);
}

function timeUntil(d, now) {
  const months = Math.max(1, Math.round((new Date(d) - now) / (30 * 86400000)));
  if (months >= 18) {
    const years = Math.round(months / 12);
    return `${years} year${years === 1 ? '' : 's'}`;
  }
  return `${months} month${months === 1 ? '' : 's'}`;
}

function spanLabel(from, to) {
  const days = Math.max(1, Math.round((to - from) / 86400000));
  if (days < 45) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.round(days / 30);
  if (months < 18) return `${months} mo`;
  return `${Math.round(months / 12)} yr`;
}

/**
 * The headline weight with an honest trend: latest entry, compared to the
 * oldest entry inside the window (default 90 days), labelled with the real
 * span. Never claims a trend from a single point, and never quotes a
 * lifetime delta ("up 117.5 lb" on a grown Great Dane) as if it were news.
 * Expects weights sorted oldest→newest (the API order). Returns null when
 * empty, else { latest, delta, spanLabel } with delta null when no
 * baseline exists.
 */
export function weightTrendSummary(weights, { windowDays = 90, now = new Date() } = {}) {
  if (!weights || weights.length === 0) return null;
  const latest = weights[weights.length - 1];
  const cutoff = now - windowDays * 86400000;
  const baseline = weights.find((w) => new Date(w.recordedAt) >= cutoff);
  if (!baseline || baseline === latest) return { latest, delta: null, spanLabel: null };
  return {
    latest,
    delta: +(latest.weightLbs - baseline.weightLbs).toFixed(1),
    spanLabel: spanLabel(new Date(baseline.recordedAt), new Date(latest.recordedAt)),
  };
}

/**
 * One sentence, worst state first, on the latest stamp per vaccine.
 * Returns { tone, sentence, expiredCount, dueCount }:
 * tone 'bad' | 'warn' | 'good' | 'onfile' | 'empty'.
 */
export function healthBookStatus(vaccinations, petName, now = new Date()) {
  const live = latestPerName(vaccinations);
  if (live.length === 0) {
    return { tone: 'empty', sentence: `Start ${petName}'s Health Book with their first vaccine.`, expiredCount: 0, dueCount: 0 };
  }
  const byStatus = (s) => live.filter((v) => vaccinationStatus(v, now) === s);

  // Longest-expired first: the sentence must name the worst lapse (a
  // 14-month-dead rabies), not whichever record was stamped most recently.
  const expired = byStatus('EXPIRED').sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
  const due = byStatus('DUE_SOON').sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));

  if (expired.length) {
    const more = expired.length > 1 ? ` — ${expired.length - 1} more ${expired.length === 2 ? 'has' : 'have'} lapsed too` : '';
    return {
      tone: 'bad',
      sentence: `${expired[0].name} expired ${shortDate(expired[0].expiresAt, now)}${more}. One tap to update.`,
      expiredCount: expired.length,
      dueCount: due.length,
    };
  }
  if (due.length) {
    const more = due.length > 1 ? ` — ${due.length - 1} more due soon` : '';
    return {
      tone: 'warn',
      sentence: `${due[0].name} due by ${shortDate(due[0].expiresAt, now)}${more}.`,
      expiredCount: 0,
      dueCount: due.length,
    };
  }
  const upcoming = live
    .filter((v) => v.expiresAt)
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))[0];
  if (upcoming) {
    return { tone: 'good', sentence: `Protections current. Next: ${upcoming.name} in ${timeUntil(upcoming.expiresAt, now)}.`, expiredCount: 0, dueCount: 0 };
  }
  // Records without any expiry dates are on file, not proof of coverage:
  // "up to date" here would overclaim what the data can support.
  return {
    tone: 'onfile',
    sentence: `${live.length} record${live.length === 1 ? '' : 's'} on file — no expiry dates tracked yet.`,
    expiredCount: 0,
    dueCount: 0,
  };
}
