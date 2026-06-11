/**
 * Validation + serialization shared by the medication API routes.
 */

const VALID_FORMS = ['PILL', 'CAPSULE', 'CHEWABLE', 'LIQUID', 'INJECTION', 'TOPICAL', 'DROPS', 'POWDER', 'OTHER'];
const VALID_SCHEDULES = ['DAILY', 'SPECIFIC_DAYS', 'EVERY_N_DAYS', 'AS_NEEDED'];
const VALID_COLORS = ['amber', 'sky', 'rose', 'violet', 'emerald', 'orange', 'cyan', 'slate'];
const VALID_ICONS = ['pill', 'capsule', 'syringe', 'droplets', 'bone', 'heart', 'paw', 'leaf', 'sparkle'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseMedication(med) {
  return {
    ...med,
    timesOfDay: JSON.parse(med.timesOfDay || '[]'),
    daysOfWeek: med.daysOfWeek ? JSON.parse(med.daysOfWeek) : null,
  };
}

/**
 * Validate + normalize medication fields from the request body.
 * `partial` allows missing fields (PATCH); returns { data } or { error }.
 */
export function validateMedicationInput(body, { partial = false } = {}) {
  const data = {};

  // MEDICATION (default) or CARE: walks, brushing, treats. Same engine,
  // different register in the UI.
  if (body.kind !== undefined) {
    if (!['MEDICATION', 'CARE'].includes(body.kind)) return { error: 'Invalid kind' };
    data.kind = body.kind;
  }

  if (body.name !== undefined || !partial) {
    const name = (body.name || '').trim();
    if (!name) return { error: 'Medication name is required' };
    if (name.length > 120) return { error: 'Medication name is too long' };
    data.name = name;
  }

  if (body.strength !== undefined) data.strength = (body.strength || '').trim().slice(0, 60) || null;
  if (body.purpose !== undefined) data.purpose = (body.purpose || '').trim().slice(0, 200) || null;
  if (body.prescribedBy !== undefined) data.prescribedBy = (body.prescribedBy || '').trim().slice(0, 120) || null;
  if (body.instructions !== undefined) data.instructions = (body.instructions || '').trim().slice(0, 500) || null;
  if (body.notes !== undefined) data.notes = (body.notes || '').trim().slice(0, 1000) || null;

  if (body.form !== undefined) {
    if (!VALID_FORMS.includes(body.form)) return { error: 'Invalid medication form' };
    data.form = body.form;
  }

  if (body.scheduleType !== undefined || !partial) {
    const scheduleType = body.scheduleType || 'DAILY';
    if (!VALID_SCHEDULES.includes(scheduleType)) return { error: 'Invalid schedule type' };
    data.scheduleType = scheduleType;
  }

  if (body.timesOfDay !== undefined) {
    const times = Array.isArray(body.timesOfDay) ? body.timesOfDay : [];
    if (times.length > 6) return { error: 'Too many times per day (max 6)' };
    if (times.some((t) => typeof t !== 'string' || !HHMM.test(t))) {
      return { error: 'Times must be in HH:MM format' };
    }
    data.timesOfDay = JSON.stringify([...new Set(times)].sort());
  }

  if (body.daysOfWeek !== undefined) {
    if (body.daysOfWeek === null) {
      data.daysOfWeek = null;
    } else {
      const days = Array.isArray(body.daysOfWeek) ? body.daysOfWeek : [];
      if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        return { error: 'Days of week must be 0-6' };
      }
      data.daysOfWeek = JSON.stringify([...new Set(days)].sort((a, b) => a - b));
    }
  }

  if (body.intervalDays !== undefined) {
    if (body.intervalDays === null) {
      data.intervalDays = null;
    } else {
      const n = parseInt(body.intervalDays, 10);
      if (Number.isNaN(n) || n < 1 || n > 365) return { error: 'Interval must be 1-365 days' };
      data.intervalDays = n;
    }
  }

  for (const key of ['startDate', 'endDate']) {
    if (body[key] !== undefined) {
      if (body[key] === null) {
        if (key === 'endDate') data.endDate = null;
      } else {
        const d = new Date(body[key]);
        if (Number.isNaN(d.getTime())) return { error: `Invalid ${key}` };
        data[key] = d;
      }
    }
  }

  for (const key of ['quantityRemaining', 'refillAlertAt']) {
    if (body[key] !== undefined) {
      if (body[key] === null || body[key] === '') {
        data[key] = null;
      } else {
        const n = parseFloat(body[key]);
        if (Number.isNaN(n) || n < 0 || n > 100000) return { error: `Invalid ${key}` };
        data[key] = n;
      }
    }
  }

  if (body.color !== undefined) {
    if (!VALID_COLORS.includes(body.color)) return { error: 'Invalid color' };
    data.color = body.color;
  }
  if (body.icon !== undefined) {
    if (!VALID_ICONS.includes(body.icon)) return { error: 'Invalid icon' };
    data.icon = body.icon;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  // Cross-field defaults
  const scheduleType = data.scheduleType;
  if (scheduleType === 'SPECIFIC_DAYS' && !data.daysOfWeek) {
    return { error: 'Pick at least one day of the week' };
  }
  if (scheduleType === 'EVERY_N_DAYS' && !data.intervalDays) {
    return { error: 'Set how many days between doses' };
  }
  if (scheduleType && scheduleType !== 'AS_NEEDED' && data.timesOfDay === undefined && !partial) {
    data.timesOfDay = JSON.stringify(['08:00']);
  }
  if (scheduleType && scheduleType !== 'AS_NEEDED' && data.timesOfDay === '[]') {
    return { error: 'Pick at least one time of day' };
  }

  return { data };
}

