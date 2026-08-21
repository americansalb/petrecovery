/**
 * The one place CaseStatus becomes words a person reads.
 *
 * Pages had been inventing their own vocabularies, and /my-alerts invented
 * one that did not exist at all: it switched on OPEN, ACTIVE_SEARCH and
 * RESOLVED, none of which are CaseStatus values. The result was a badge
 * showing the raw enum, filter tabs that matched nothing, and a "Mark as
 * Found" button that never rendered.
 *
 * Wording follows what the rest of the site already shows: "Reunited!"
 * from the outcome modal, "Reunited" from the lost-and-found filter.
 *
 * Keep this in step with `enum CaseStatus` in prisma/schema.prisma.
 */

export const CASE_STATUSES = [
  'ACTIVE',
  'IN_PROGRESS',
  'SIGHTING_REPORTED',
  'REUNITED',
  'CLOSED_OTHER',
];

const LABELS = {
  ACTIVE: 'Reported',
  IN_PROGRESS: 'Search underway',
  SIGHTING_REPORTED: 'Sighting reported',
  REUNITED: 'Reunited',
  CLOSED_OTHER: 'Closed',
};

const COLORS = {
  ACTIVE: { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' },
  IN_PROGRESS: { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
  SIGHTING_REPORTED: { bg: '#dbeafe', border: '#2563eb', text: '#1e40af' },
  REUNITED: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  CLOSED_OTHER: { bg: '#f3f4f6', border: '#6b7280', text: '#374151' },
};

const NEUTRAL = { bg: '#f3f4f6', border: '#6b7280', text: '#374151' };

export function caseStatusLabel(status) {
  return LABELS[status] || 'Reported';
}

export function caseStatusColors(status) {
  return COLORS[status] || NEUTRAL;
}

/**
 * Still being searched for: the pet is not home and the case is not closed.
 * This is the group the public API calls LIVE.
 */
export function isCaseOpen(status) {
  return status === 'ACTIVE' || status === 'IN_PROGRESS' || status === 'SIGHTING_REPORTED';
}
