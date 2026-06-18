/**
 * Medication tracking — shared logic (no React, no Prisma).
 *
 * Design: all schedule math runs on the CLIENT in the owner's local timezone.
 * timesOfDay are "HH:MM" local strings; a dose slot's identity is the local
 * date + time turned into a Date and sent to the API as ISO. The server only
 * stores and uniques on (medicationId, scheduledFor) — it never does tz math.
 */

// ---------------------------------------------------------------------------
// Customization tokens (color + icon are owner-pickable per medication)
// ---------------------------------------------------------------------------

// Tailwind can't build dynamic class names, so each token carries the literal
// classes the UI needs.
export const MED_COLORS = {
  amber:  { label: 'Amber',  swatch: 'bg-amber-400',   chip: 'bg-amber-100 text-amber-800',     accent: 'border-l-amber-400',   ring: 'ring-amber-400',   iconBg: 'bg-amber-100 text-amber-700' },
  sky:    { label: 'Sky',    swatch: 'bg-sky-400',     chip: 'bg-sky-100 text-sky-800',         accent: 'border-l-sky-400',     ring: 'ring-sky-400',     iconBg: 'bg-sky-100 text-sky-700' },
  rose:   { label: 'Rose',   swatch: 'bg-rose-400',    chip: 'bg-rose-100 text-rose-800',       accent: 'border-l-rose-400',    ring: 'ring-rose-400',    iconBg: 'bg-rose-100 text-rose-700' },
  violet: { label: 'Violet', swatch: 'bg-violet-400',  chip: 'bg-violet-100 text-violet-800',   accent: 'border-l-violet-400',  ring: 'ring-violet-400',  iconBg: 'bg-violet-100 text-violet-700' },
  emerald:{ label: 'Emerald',swatch: 'bg-emerald-400', chip: 'bg-emerald-100 text-emerald-800', accent: 'border-l-emerald-400', ring: 'ring-emerald-400', iconBg: 'bg-emerald-100 text-emerald-700' },
  orange: { label: 'Orange', swatch: 'bg-orange-400',  chip: 'bg-orange-100 text-orange-800',   accent: 'border-l-orange-400',  ring: 'ring-orange-400',  iconBg: 'bg-orange-100 text-orange-700' },
  cyan:   { label: 'Cyan',   swatch: 'bg-cyan-400',    chip: 'bg-cyan-100 text-cyan-800',       accent: 'border-l-cyan-400',    ring: 'ring-cyan-400',    iconBg: 'bg-cyan-100 text-cyan-700' },
  slate:  { label: 'Slate',  swatch: 'bg-slate-400',   chip: 'bg-slate-200 text-slate-800',     accent: 'border-l-slate-400',   ring: 'ring-slate-400',   iconBg: 'bg-slate-200 text-slate-700' },
};

export const MED_COLOR_TOKENS = Object.keys(MED_COLORS);

export function medColor(token) {
  return MED_COLORS[token] || MED_COLORS.amber;
}

// Icon tokens — mapped to lucide components in the UI layer.
export const MED_ICON_TOKENS = [
  'pill', 'capsule', 'syringe', 'droplets', 'bone', 'heart', 'paw', 'leaf', 'sparkle',
];

export const FORM_OPTIONS = [
  { value: 'PILL',      label: 'Pill / Tablet' },
  { value: 'CAPSULE',   label: 'Capsule' },
  { value: 'CHEWABLE',  label: 'Chewable' },
  { value: 'LIQUID',    label: 'Liquid' },
  { value: 'INJECTION', label: 'Injection' },
  { value: 'TOPICAL',   label: 'Topical' },
  { value: 'DROPS',     label: 'Drops' },
  { value: 'POWDER',    label: 'Powder' },
  { value: 'OTHER',     label: 'Other' },
];

// Default icon per form, used when the owner hasn't picked one.
export const FORM_DEFAULT_ICON = {
  PILL: 'pill', CAPSULE: 'capsule', CHEWABLE: 'bone', LIQUID: 'droplets',
  INJECTION: 'syringe', TOPICAL: 'sparkle', DROPS: 'droplets', POWDER: 'sparkle', OTHER: 'pill',
};

export const SCHEDULE_OPTIONS = [
  { value: 'DAILY',         label: 'Every day' },
  { value: 'SPECIFIC_DAYS', label: 'Specific days' },
  { value: 'EVERY_N_DAYS',  label: 'Every N days' },
  { value: 'AS_NEEDED',     label: 'As needed (PRN)' },
];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** "08:00" -> "8:00 AM" */
export function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Local Date for a calendar day + "HH:MM" — the canonical slot identity. */
export function slotDate(day, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Midnight (local) for a date. */
export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

/** Parse a date defensively; returns null for missing/invalid input so the
 *  schedule engine can never silently miscompute (NaN) on corrupt data. */
function validDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || 'null');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Schedule engine
// ---------------------------------------------------------------------------

/** Is this medication scheduled to be given on the given local day? */
export function isDueOn(med, day) {
  if (!med.isActive) return false;
  const d = startOfDay(day);
  if (med.startDate && d < startOfDay(new Date(med.startDate))) return false;
  if (med.endDate && d > startOfDay(new Date(med.endDate))) return false;

  switch (med.scheduleType) {
    case 'DAILY':
      return true;
    case 'SPECIFIC_DAYS': {
      const days = parseJsonArray(med.daysOfWeek);
      return days.includes(d.getDay());
    }
    case 'EVERY_N_DAYS': {
      const n = Math.max(1, med.intervalDays || 1);
      const anchor = validDate(med.startDate) || validDate(med.createdAt);
      // Corrupt schedule data must never SILENTLY hide a medication. With no
      // usable anchor, show it (visible, recoverable) rather than vanish it
      // (silent, dangerous); hasValidSchedule lets the UI flag the breakage.
      if (!anchor) return true;
      const elapsed = daysBetween(anchor, d);
      return elapsed >= 0 && elapsed % n === 0;
    }
    case 'AS_NEEDED':
    default:
      return false; // PRN has no scheduled slots
  }
}

/**
 * Does a scheduled med have the data its cadence needs? Lets the UI flag a
 * broken schedule loudly instead of silently mis-showing or hiding doses.
 */
export function hasValidSchedule(med) {
  switch (med.scheduleType) {
    case 'EVERY_N_DAYS':
      return validDate(med.startDate) != null && Number(med.intervalDays) >= 1;
    case 'SPECIFIC_DAYS':
      return parseJsonArray(med.daysOfWeek).length > 0;
    default:
      return true;
  }
}

/**
 * Scheduled slots for a medication on a local day.
 * Returns [{ time: "08:00", scheduledFor: Date }] sorted by time.
 */
export function slotsForDate(med, day) {
  if (!isDueOn(med, day)) return [];
  const times = parseJsonArray(med.timesOfDay);
  return [...times]
    .sort()
    .map((time) => ({ time, scheduledFor: slotDate(day, time) }));
}

/**
 * Join slots with dose logs. Each slot gains { status: 'GIVEN'|'SKIPPED'|null, dose }.
 * `doses` is the raw array from the API (scheduledFor as ISO strings).
 */
export function slotsWithStatus(med, doses, day) {
  const byTime = new Map(
    (doses || []).map((d) => [new Date(d.scheduledFor).getTime(), d])
  );
  return slotsForDate(med, day).map((slot) => {
    const dose = byTime.get(slot.scheduledFor.getTime()) || null;
    return { ...slot, dose, status: dose ? dose.status : null };
  });
}

/** {due, given, skipped} for one med on one day. */
export function adherenceForDay(med, doses, day) {
  const slots = slotsWithStatus(med, doses, day);
  return {
    due: slots.length,
    given: slots.filter((s) => s.status === 'GIVEN').length,
    skipped: slots.filter((s) => s.status === 'SKIPPED').length,
  };
}

/** Human summary: "Twice daily · 8:00 AM & 8:00 PM", "Every 3 days · 9:00 AM"… */
export function formatSchedule(med) {
  const times = parseJsonArray(med.timesOfDay).sort();
  const timeStr = times.map(formatTime).join(' & ');

  switch (med.scheduleType) {
    case 'DAILY': {
      const per = { 1: 'Once daily', 2: 'Twice daily', 3: '3× daily', 4: '4× daily' }[times.length] || `${times.length}× daily`;
      return timeStr ? `${per} · ${timeStr}` : per;
    }
    case 'SPECIFIC_DAYS': {
      const days = parseJsonArray(med.daysOfWeek).sort((a, b) => a - b).map((i) => WEEKDAYS[i]).join(', ');
      return [days || 'Specific days', timeStr].filter(Boolean).join(' · ');
    }
    case 'EVERY_N_DAYS': {
      const n = med.intervalDays || 1;
      const base = n === 1 ? 'Every day' : n === 2 ? 'Every other day' : n === 7 ? 'Every week' : n === 30 ? 'Every month' : `Every ${n} days`;
      return [base, timeStr].filter(Boolean).join(' · ');
    }
    case 'AS_NEEDED':
      return 'As needed';
    default:
      return '';
  }
}

/** Grouping for the Today timeline. */
export function timeOfDayBucket(hhmm) {
  const h = Number(hhmm.split(':')[0]);
  if (h < 11) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

/** Low-supply check. */
export function isLowSupply(med) {
  return (
    med.quantityRemaining != null &&
    med.refillAlertAt != null &&
    med.quantityRemaining <= med.refillAlertAt
  );
}

// ---------------------------------------------------------------------------
// Heuristic free-text parser — the wizard's offline brain.
// Handles things like "Apoquel 16mg twice a day with food" without any AI.
// The AI endpoint uses the same output shape and falls back to this.
// ---------------------------------------------------------------------------

const FORM_PATTERNS = [
  [/\b(tablets?|pills?)\b/i, 'PILL'],
  [/\bcapsules?\b/i, 'CAPSULE'],
  [/\bchew(able|s)?\b/i, 'CHEWABLE'],
  [/\b(liquid|syrup|suspension|oral solution)\b/i, 'LIQUID'],
  [/\b(injection|injectable|insulin|shots?|syringe)\b/i, 'INJECTION'],
  [/\b(topical|cream|ointment|gel|spot[- ]on)\b/i, 'TOPICAL'],
  [/\bdrops?\b/i, 'DROPS'],
  [/\bpowder\b/i, 'POWDER'],
];

const DEFAULT_TIMES = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['06:00', '12:00', '17:00', '22:00'],
};

const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4 };

/**
 * Parse free text into wizard fields. Pure heuristics — safe offline fallback.
 * Returns { name, strength, form, scheduleType, timesOfDay, intervalDays,
 *           daysOfWeek, instructions, purpose, confidence }
 */
export function parseMedicationText(raw) {
  const text = (raw || '').trim();
  const result = {
    name: '',
    strength: null,
    form: null,
    scheduleType: null,
    timesOfDay: null,
    intervalDays: null,
    daysOfWeek: null,
    instructions: null,
    purpose: null,
    confidence: 'low',
  };
  if (!text) return result;

  let matched = 0;

  // Strength: "16mg", "2.5 ml", "10 units", "0.5%"
  const strength = text.match(/(\d+(?:[.,]\d+)?)\s?(mg|mcg|µg|g|ml|cc|units?|iu|%)\b/i);
  if (strength) {
    result.strength = `${strength[1].replace(',', '.')} ${strength[2].toLowerCase()}`;
    matched++;
  }

  // Form
  for (const [re, form] of FORM_PATTERNS) {
    if (re.test(text)) { result.form = form; matched++; break; }
  }

  // Frequency / schedule
  const lower = text.toLowerCase();
  const everyN = lower.match(/every\s+(\d+|other)\s+(day|week|month)s?/);
  const everyHours = lower.match(/every\s+(\d+)\s+(?:hours|hrs|h)\b/);
  const perDay = lower.match(/\b(\d|one|two|three|four)\s?(?:x|times?)\s?(?:a|per|\/)?\s?(?:day|daily)\b/);

  if (/\b(as needed|when needed|prn|if needed)\b/.test(lower)) {
    result.scheduleType = 'AS_NEEDED';
    matched++;
  } else if (everyHours) {
    const h = Number(everyHours[1]);
    const perDayCount = Math.max(1, Math.min(4, Math.round(24 / h)));
    result.scheduleType = 'DAILY';
    result.timesOfDay = DEFAULT_TIMES[perDayCount];
    matched++;
  } else if (everyN) {
    const unit = everyN[2];
    const n = everyN[1] === 'other' ? 2 : Number(everyN[1]);
    result.scheduleType = 'EVERY_N_DAYS';
    result.intervalDays = unit === 'week' ? n * 7 : unit === 'month' ? n * 30 : n;
    result.timesOfDay = DEFAULT_TIMES[1];
    matched++;
  } else if (perDay) {
    const n = WORD_NUMBERS[perDay[1]] || Number(perDay[1]) || 1;
    result.scheduleType = 'DAILY';
    result.timesOfDay = DEFAULT_TIMES[Math.max(1, Math.min(4, n))];
    matched++;
  } else if (/\btwice\b/.test(lower)) {
    result.scheduleType = 'DAILY';
    result.timesOfDay = DEFAULT_TIMES[2];
    matched++;
  } else if (/\b(once\s+(?:a|per)\s+week|weekly)\b/.test(lower)) {
    result.scheduleType = 'EVERY_N_DAYS';
    result.intervalDays = 7;
    result.timesOfDay = DEFAULT_TIMES[1];
    matched++;
  } else if (/\b(once\s+(?:a|per)\s+month|monthly)\b/.test(lower)) {
    result.scheduleType = 'EVERY_N_DAYS';
    result.intervalDays = 30;
    result.timesOfDay = DEFAULT_TIMES[1];
    matched++;
  } else if (/\b(once\s+(?:a|per)\s+day|daily|every\s+day|once\s+daily)\b/.test(lower)) {
    result.scheduleType = 'DAILY';
    result.timesOfDay = DEFAULT_TIMES[1];
    matched++;
  }

  // Time-of-day words refine DAILY times
  if (result.scheduleType === 'DAILY' || result.scheduleType == null) {
    const tod = [];
    if (/\bmorning\b/.test(lower)) tod.push('08:00');
    if (/\b(noon|lunch|midday|afternoon)\b/.test(lower)) tod.push('14:00');
    if (/\b(evening|night|dinner)\b/.test(lower)) tod.push('20:00');
    if (/\bbedtime\b/.test(lower)) tod.push('21:30');
    if (tod.length) {
      result.scheduleType = 'DAILY';
      result.timesOfDay = [...new Set(tod)].sort();
      matched++;
    }
  }

  // Instructions
  const instructions = [];
  if (/\bwith\s+(food|meals?|breakfast|dinner)\b/.test(lower)) instructions.push('Give with food');
  if (/\b(empty stomach|before\s+meals?|before\s+food)\b/.test(lower)) instructions.push('Give on an empty stomach');
  if (instructions.length) { result.instructions = instructions.join('. '); matched++; }

  // Purpose: "for allergies", "for his heart" — stop at frequency-ish words
  const purpose = lower.match(/\bfor\s+(?:his|her|their|the)?\s*([a-z][a-z\s-]{2,30}?)(?=$|[,.]|\s+(?:every|once|twice|daily|weekly|monthly|as\b|with\b|\d))/);
  if (purpose) {
    const cleaned = purpose[1].trim();
    // ignore durations like "for 2 weeks"
    if (!/^\d/.test(cleaned) && !/^(now|a while)$/.test(cleaned)) {
      result.purpose = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      matched++;
    }
  }

  // Name: leading words before strength/form/frequency tokens
  const cut = text.search(/(\d+(?:[.,]\d+)?\s?(mg|mcg|µg|g|ml|cc|units?|iu|%)\b)|\b(once|twice|daily|every|tablets?|pills?|capsules?|chewables?|liquid|injection|drops?|topical|as needed|prn|with food|for\b|\dx)/i);
  let name = (cut > 0 ? text.slice(0, cut) : text).trim().replace(/[,.-]+$/, '').trim();
  // keep it to a few words max
  name = name.split(/\s+/).slice(0, 4).join(' ');
  if (name) {
    result.name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  result.confidence = matched >= 3 ? 'high' : matched >= 1 ? 'medium' : 'low';
  return result;
}

/* ------------------------------ Care routines ------------------------------
 * The light side of the tracker: walks, brushing, treats. Same schedule
 * engine and dose log as medications (kind: 'CARE' on PetMedication),
 * different register in the UI. Emoji are looked up by name here so the
 * data model stays plain strings. */

export const CARE_ACTIVITIES = [
  { id: 'WALK', label: 'Walk', emoji: '🦮', color: 'emerald', defaultTimes: ['08:00', '18:00'] },
  { id: 'BRUSH', label: 'Brushing', emoji: '🪮', color: 'violet', defaultTimes: ['19:00'] },
  { id: 'TREATS', label: 'Treats', emoji: '🦴', color: 'amber', defaultTimes: [] },
  { id: 'PLAY', label: 'Playtime', emoji: '🎾', color: 'sky', defaultTimes: ['17:00'] },
  { id: 'LITTER', label: 'Litter box', emoji: '🧹', color: 'slate', defaultTimes: ['09:00'] },
  { id: 'BATH', label: 'Bath', emoji: '🛁', color: 'cyan', defaultTimes: ['10:00'] },
  { id: 'NAILS', label: 'Nail trim', emoji: '✂️', color: 'rose', defaultTimes: ['10:00'] },
  { id: 'TRAINING', label: 'Training', emoji: '🎓', color: 'orange', defaultTimes: ['16:00'] },
];

export function careEmoji(name) {
  const found = CARE_ACTIVITIES.find(
    (a) => a.label.toLowerCase() === (name || '').toLowerCase()
  );
  return found?.emoji || '🐾';
}
