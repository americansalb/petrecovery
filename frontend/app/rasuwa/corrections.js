/**
 * Pure logic for public correction requests: anyone who spots a
 * mistake in a missing person's details can ask the coordinating
 * families to review it, no account needed. Shared by the public
 * submit route and the board, so the caps cannot drift apart.
 *
 * The site never edits the list from these. The task force reads them
 * on the board, corrects the letter document at its source, and the
 * next regeneration follows it.
 */

export const CORRECTION_CAPS = {
  personName: 160,
  message: 1000,
  contact: 200,
};

export const CORRECTION_ACTIONS = ['done', 'reopen'];

const text = (v) => (typeof v === 'string' ? v : '');
const clip = (v, max) => text(v).replace(/\s+/g, ' ').trim().slice(0, max);
const clipBlock = (v, max) => text(v).replace(/\r\n/g, '\n').trim().slice(0, max);

/**
 * A submittable request, or null when there is nothing to review.
 * The message is the request; the person and a way to reach the
 * sender are optional (a blank person means the letter overall).
 */
export function cleanCorrection({ personName, message, contact } = {}) {
  const cleanMessage = clipBlock(message, CORRECTION_CAPS.message);
  if (!cleanMessage) return null;
  return {
    personName: clip(personName, CORRECTION_CAPS.personName),
    message: cleanMessage,
    contact: clip(contact, CORRECTION_CAPS.contact),
  };
}
